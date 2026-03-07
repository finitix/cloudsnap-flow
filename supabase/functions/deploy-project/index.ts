import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function safeFetchJson(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";
  let data: any;
  if (contentType.includes("application/json")) {
    try { data = await res.json(); } catch { data = { _rawText: await res.text() || "(empty)" }; }
  } else {
    data = { _rawText: await res.text() || "(empty)" };
  }
  return { ok: res.ok, status: res.status, data };
}

async function sha1Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface ExtractedFile { path: string; data: Uint8Array; }

function extractZipFilesRaw(zipBuffer: ArrayBuffer): ExtractedFile[] {
  const zipData = new Uint8Array(zipBuffer);
  const unzipped = unzipSync(zipData);
  const files: ExtractedFile[] = [];
  for (const [path, content] of Object.entries(unzipped)) {
    if (path.endsWith("/") || path.startsWith("__MACOSX") || path.startsWith(".")) continue;
    if (content.length === 0) continue;
    let cleanPath = path;
    const parts = path.split("/");
    if (parts.length > 1) cleanPath = parts.slice(1).join("/");
    if (!cleanPath || cleanPath.endsWith("/")) continue;
    files.push({ path: cleanPath, data: content });
  }
  return files;
}

function detectBuildNeeded(files: ExtractedFile[]): boolean {
  return files.some((f) => f.path === "package.json" || f.path === "requirements.txt" || f.path === "Cargo.toml");
}

// ══════════════════════════════════════
// ── Deep Project Analysis ──
// ══════════════════════════════════════

interface StackAnalysis {
  hasFrontend: boolean;
  hasBackend: boolean;
  framework: string;
  buildCommand: string;
  outputDir: string;
  startCommand: string;
  frontendFramework: string;
  frontendBuildCommand: string;
  frontendOutputDir: string;
  backendFramework: string;
  backendBuildCommand: string;
  backendStartCommand: string;
  needsUserInput: boolean;
  missingInfo: string[];
  detectedFiles: { frontend: string[]; backend: string[] };
}

function detectProjectType(files: ExtractedFile[]): StackAnalysis {
  const allPaths = files.map((f) => f.path.toLowerCase());
  const allNames = files.map((f) => f.path);

  // Helper: check if file exists in root or any subfolder
  const hasFile = (name: string) => allPaths.some((p) => p === name || p.endsWith("/" + name));
  const hasFileInDir = (dir: string, name: string) => allPaths.some((p) => p.startsWith(dir.toLowerCase() + "/") && p.endsWith("/" + name) || p === (dir.toLowerCase() + "/" + name));
  const filesInDir = (dir: string) => allNames.filter((p) => p.toLowerCase().startsWith(dir.toLowerCase() + "/"));

  // Detect common directory structures for fullstack projects
  const frontendDirs = ["frontend", "client", "web", "app", "ui", "packages/frontend", "packages/client", "packages/web"];
  const backendDirs = ["backend", "server", "api", "services", "packages/backend", "packages/server", "packages/api"];

  let detectedFrontendDir = "";
  let detectedBackendDir = "";
  const frontendDetectedFiles: string[] = [];
  const backendDetectedFiles: string[] = [];

  // Check for explicit frontend/backend directories
  for (const dir of frontendDirs) {
    const dirFiles = filesInDir(dir);
    if (dirFiles.length > 0) {
      detectedFrontendDir = dir;
      frontendDetectedFiles.push(...dirFiles.slice(0, 5));
      break;
    }
  }
  for (const dir of backendDirs) {
    const dirFiles = filesInDir(dir);
    if (dirFiles.length > 0) {
      detectedBackendDir = dir;
      backendDetectedFiles.push(...dirFiles.slice(0, 5));
      break;
    }
  }

  // Root-level detection
  const hasPackageJson = hasFile("package.json");
  const hasIndexHtml = hasFile("index.html");
  const hasTsx = allPaths.some((f) => f.endsWith(".tsx") || f.endsWith(".jsx"));
  const hasVue = allPaths.some((f) => f.endsWith(".vue"));
  const hasSvelte = allPaths.some((f) => f.endsWith(".svelte"));
  const hasPython = hasFile("requirements.txt") || hasFile("main.py") || hasFile("app.py") || hasFile("manage.py") || hasFile("pyproject.toml");
  const hasGo = hasFile("go.mod");
  const hasRuby = hasFile("gemfile") || hasFile("Gemfile");
  const hasDocker = hasFile("dockerfile") || hasFile("Dockerfile");
  const hasProcfile = hasFile("procfile") || hasFile("Procfile");
  const hasServerFile = allPaths.some((f) => {
    const name = f.split("/").pop() || "";
    return ["server.js", "server.ts", "app.js", "app.ts", "index.js", "index.ts"].includes(name);
  });
  const hasNextConfig = allPaths.some((f) => f === "next.config.js" || f === "next.config.mjs" || f === "next.config.ts");
  const hasViteConfig = allPaths.some((f) => f === "vite.config.ts" || f === "vite.config.js");
  const hasAngular = hasFile("angular.json");
  const hasNuxt = hasFile("nuxt.config.ts") || hasFile("nuxt.config.js");

  // Check for monorepo configs
  const hasLerna = hasFile("lerna.json");
  const hasTurbo = hasFile("turbo.json");
  const hasNxJson = hasFile("nx.json");
  const isMonorepo = hasLerna || hasTurbo || hasNxJson || detectedFrontendDir !== "";

  // Determine frontend presence
  let hasFrontend = hasIndexHtml || hasTsx || hasVue || hasViteConfig || hasAngular || hasSvelte || hasNuxt || detectedFrontendDir !== "";
  // Determine backend presence
  let hasBackend = hasPython || hasGo || hasRuby || hasDocker || hasProcfile || hasServerFile || hasNextConfig || detectedBackendDir !== "";

  // If we have explicit frontend/backend dirs, that's strong evidence of fullstack
  if (detectedFrontendDir && detectedBackendDir) {
    hasFrontend = true;
    hasBackend = true;
  }

  // Parse package.json(s) for deeper analysis
  let rootPkgDeps: Record<string, string> = {};
  let rootPkgScripts: Record<string, string> = {};
  const pkgFile = files.find((f) => f.path === "package.json");
  if (pkgFile) {
    try {
      const pkg = JSON.parse(new TextDecoder().decode(pkgFile.data));
      rootPkgDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      rootPkgScripts = pkg.scripts || {};
    } catch {}
  }

  // Check for frontend/backend package.json separately
  let frontendPkgDeps: Record<string, string> = {};
  let backendPkgDeps: Record<string, string> = {};
  let backendPkgScripts: Record<string, string> = {};

  if (detectedFrontendDir) {
    const fpkg = files.find((f) => f.path.toLowerCase() === `${detectedFrontendDir}/package.json`.toLowerCase());
    if (fpkg) {
      try {
        const p = JSON.parse(new TextDecoder().decode(fpkg.data));
        frontendPkgDeps = { ...p.dependencies, ...p.devDependencies };
      } catch {}
    }
  }
  if (detectedBackendDir) {
    const bpkg = files.find((f) => f.path.toLowerCase() === `${detectedBackendDir}/package.json`.toLowerCase());
    if (bpkg) {
      try {
        const p = JSON.parse(new TextDecoder().decode(bpkg.data));
        backendPkgDeps = { ...p.dependencies, ...p.devDependencies };
        backendPkgScripts = p.scripts || {};
      } catch {}
    }
  }

  // Merge all deps for detection
  const allDeps = { ...rootPkgDeps, ...frontendPkgDeps, ...backendPkgDeps };

  // Detect frontend framework
  let frontendFramework = "Unknown";
  let frontendBuildCommand = "npm run build";
  let frontendOutputDir = "dist";

  if (hasNextConfig || allDeps["next"]) {
    frontendFramework = "Next.js"; frontendOutputDir = ".next";
  } else if (hasNuxt || allDeps["nuxt"]) {
    frontendFramework = "Nuxt"; frontendOutputDir = ".output";
  } else if (hasAngular) {
    frontendFramework = "Angular"; frontendOutputDir = "dist";
  } else if (hasViteConfig && hasTsx) {
    frontendFramework = allDeps["react"] ? "React (Vite)" : "Vite";
  } else if (allDeps["react"]) {
    frontendFramework = "React";
  } else if (hasVue || allDeps["vue"]) {
    frontendFramework = "Vue";
  } else if (hasSvelte || allDeps["svelte"]) {
    frontendFramework = "Svelte";
  } else if (hasIndexHtml && !hasPackageJson) {
    frontendFramework = "Static HTML"; frontendBuildCommand = ""; frontendOutputDir = ".";
  }

  if (detectedFrontendDir && frontendBuildCommand === "npm run build") {
    frontendBuildCommand = `cd ${detectedFrontendDir} && npm install && npm run build`;
  }

  // Detect backend framework
  let backendFramework = "Unknown";
  let backendBuildCommand = "npm install";
  let backendStartCommand = "npm start";

  if (hasNextConfig || allDeps["next"]) {
    backendFramework = "Next.js"; backendBuildCommand = "npm run build"; backendStartCommand = "npm start";
  } else if (hasPython) {
    backendFramework = "Python";
    const hasDjango = hasFile("manage.py");
    const hasFlask = allPaths.some((p) => p.includes("flask") || p === "app.py");
    const hasFastAPI = allPaths.some((p) => p.includes("fastapi") || p === "main.py");
    if (hasDjango) { backendFramework = "Python (Django)"; backendStartCommand = "python manage.py runserver 0.0.0.0:$PORT"; }
    else if (hasFastAPI) { backendFramework = "Python (FastAPI)"; backendStartCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"; }
    else if (hasFlask) { backendFramework = "Python (Flask)"; backendStartCommand = "python app.py"; }
    else { backendStartCommand = "python main.py"; }
    backendBuildCommand = hasFile("pyproject.toml") ? "pip install ." : "pip install -r requirements.txt";
  } else if (hasGo) {
    backendFramework = "Go"; backendBuildCommand = "go build -o main ."; backendStartCommand = "./main";
  } else if (hasRuby) {
    backendFramework = "Ruby"; backendBuildCommand = "bundle install"; backendStartCommand = "bundle exec rails server -p $PORT";
  } else if (hasDocker) {
    backendFramework = "Docker"; backendBuildCommand = ""; backendStartCommand = "";
  } else if (hasServerFile || allDeps["express"] || allDeps["fastify"] || allDeps["koa"] || allDeps["hapi"] || allDeps["nestjs"] || allDeps["@nestjs/core"]) {
    const serverLib = allDeps["express"] ? "Express" : allDeps["fastify"] ? "Fastify" : allDeps["koa"] ? "Koa" : allDeps["@nestjs/core"] ? "NestJS" : allDeps["hapi"] ? "Hapi" : "Node.js";
    backendFramework = `Node.js (${serverLib})`;
    const entryFile = ["server.js", "server.ts", "app.js", "app.ts", "index.js", "index.ts"]
      .find((f) => allPaths.includes(f) || allPaths.some((p) => p.endsWith("/" + f))) || "server.js";
    backendStartCommand = rootPkgScripts["start"] ? "npm start" : `node ${entryFile}`;
    backendBuildCommand = rootPkgScripts["build"] ? "npm install && npm run build" : "npm install";
    hasBackend = true;
  }

  if (detectedBackendDir && !hasPython && !hasGo && !hasRuby) {
    backendBuildCommand = `cd ${detectedBackendDir} && npm install`;
    if (backendPkgScripts["start"]) backendStartCommand = `cd ${detectedBackendDir} && npm start`;
    else if (backendPkgScripts["dev"]) backendStartCommand = `cd ${detectedBackendDir} && npm run dev`;
  }

  // If we only see backend indicators (express etc) but also have React, it's fullstack
  if (allDeps["express"] && allDeps["react"]) { hasFrontend = true; hasBackend = true; }

  // Missing info detection
  const missingInfo: string[] = [];
  if (hasBackend && backendStartCommand === "npm start" && !rootPkgScripts["start"] && !backendPkgScripts["start"]) {
    missingInfo.push("start_command");
  }
  if (hasBackend && hasPython && !hasFile("requirements.txt") && !hasFile("pyproject.toml")) {
    missingInfo.push("requirements_file");
  }

  let framework = hasFrontend ? frontendFramework : backendFramework;
  if (framework === "Unknown" && hasBackend) framework = backendFramework;

  return {
    hasFrontend,
    hasBackend,
    framework,
    buildCommand: hasFrontend ? frontendBuildCommand : backendBuildCommand,
    outputDir: frontendOutputDir,
    startCommand: backendStartCommand,
    frontendFramework: hasFrontend ? frontendFramework : "",
    frontendBuildCommand: hasFrontend ? frontendBuildCommand : "",
    frontendOutputDir: hasFrontend ? frontendOutputDir : "",
    backendFramework: hasBackend ? backendFramework : "",
    backendBuildCommand: hasBackend ? backendBuildCommand : "",
    backendStartCommand: hasBackend ? backendStartCommand : "",
    needsUserInput: missingInfo.length > 0,
    missingInfo,
    detectedFiles: {
      frontend: frontendDetectedFiles,
      backend: backendDetectedFiles,
    },
  };
}

// ══════════════════════════════════════
// ── Auto-Heal: Error Analyzer ──
// ══════════════════════════════════════

type ErrorCategory = "dependency_error" | "build_error" | "port_error" | "env_error" | "missing_files_error" | "timeout_error" | "project_settings_error" | "framework_detection_error" | "permission_error" | "rate_limit_error" | "unknown_error";

interface ErrorAnalysis {
  category: ErrorCategory;
  description: string;
  suggestedFix: string;
  extractedDetails?: Record<string, any>;
}

function analyzeError(errorMessage: string): ErrorAnalysis {
  const msg = (errorMessage || "").toLowerCase();

  // Vercel missing_project_settings — the #1 issue
  if (msg.includes("missing_project_settings") || msg.includes("projectsettings") && msg.includes("required")) {
    // Try to extract suggested framework from the error
    let detectedFramework: string | null = null;
    try {
      const match = errorMessage.match(/"framework"\s*:\s*\{[^}]*"slug"\s*:\s*"?(\w+)"?/);
      if (match) detectedFramework = match[1];
    } catch {}
    return {
      category: "project_settings_error",
      description: "Vercel requires projectSettings with build/output configuration for new projects",
      suggestedFix: "Add projectSettings with auto-detected framework, buildCommand, and outputDirectory",
      extractedDetails: { detectedFramework },
    };
  }

  // Framework detection / auto-detection confirmation
  if (msg.includes("skipautodetectionconfirmation") || msg.includes("automatic framework detection")) {
    return {
      category: "framework_detection_error",
      description: "Vercel cannot auto-detect the framework and needs explicit settings",
      suggestedFix: "Provide explicit framework and build settings in projectSettings",
    };
  }

  // Permission / auth errors
  if (msg.includes("forbidden") || msg.includes("401") || msg.includes("403") || msg.includes("not_authorized") || msg.includes("invalid_token")) {
    return {
      category: "permission_error",
      description: "Authentication or permission error with the provider",
      suggestedFix: "Check API token validity and permissions",
    };
  }

  // Rate limit
  if (msg.includes("rate_limit") || msg.includes("too many requests") || msg.includes("429")) {
    return {
      category: "rate_limit_error",
      description: "Provider rate limit exceeded",
      suggestedFix: "Wait and retry after cooldown period",
    };
  }

  // Dependency errors
  if (msg.includes("module not found") || msg.includes("cannot find module") || msg.includes("npm err") ||
      msg.includes("package not found") || msg.includes("enoent") || msg.includes("missing dependency") ||
      msg.includes("no such file or directory") && (msg.includes("node_modules") || msg.includes("package"))) {
    return {
      category: "dependency_error",
      description: "Missing or failed dependency installation",
      suggestedFix: "Reinstall dependencies with --legacy-peer-deps and retry",
    };
  }

  // Build errors
  if (msg.includes("build failed") || msg.includes("compilation error") || msg.includes("syntax error") ||
      msg.includes("type error") || msg.includes("tsc") || msg.includes("webpack") ||
      msg.includes("rollup") || msg.includes("vite") && msg.includes("error") ||
      msg.includes("exit code 1") || msg.includes("command failed")) {
    return {
      category: "build_error",
      description: "Build process failed",
      suggestedFix: "Retry build step with clean cache",
    };
  }

  // Port errors
  if (msg.includes("eaddrinuse") || msg.includes("port") && (msg.includes("already in use") || msg.includes("not available")) ||
      msg.includes("listen") && msg.includes("error") || msg.includes("wrong port")) {
    return {
      category: "port_error",
      description: "Port conflict or misconfiguration",
      suggestedFix: "Change to default port (3000 or 8000)",
    };
  }

  // Environment variable errors
  if (msg.includes("env") && (msg.includes("missing") || msg.includes("undefined") || msg.includes("not set")) ||
      msg.includes("environment variable") || msg.includes("config") && msg.includes("not found") ||
      msg.includes("api_key") || msg.includes("secret") && msg.includes("missing")) {
    return {
      category: "env_error",
      description: "Missing environment variable or configuration",
      suggestedFix: "Inject default environment variables",
    };
  }

  // Missing files (Vercel specific)
  if (msg.includes("missing_files") || msg.includes("missing files")) {
    return {
      category: "missing_files_error",
      description: "File upload incomplete — provider reports missing files",
      suggestedFix: "Re-upload missing files and retry deployment",
    };
  }

  // Timeout errors
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("deadline exceeded")) {
    return {
      category: "timeout_error",
      description: "Deployment timed out",
      suggestedFix: "Retry deployment with extended timeout",
    };
  }

  return {
    category: "unknown_error",
    description: "Unknown deployment error",
    suggestedFix: "Retry deployment once",
  };
}

// ══════════════════════════════════════
// ── Auto-Heal: Fix Engine ──
// ══════════════════════════════════════

interface FixAction {
  fixApplied: string;
  modifiedBuildCommand?: string;
  modifiedStartCommand?: string;
  modifiedEnvVars?: Array<{ key: string; value: string }>;
  modifiedOutputDir?: string;
  shouldRetry: boolean;
}

function applyFix(category: ErrorCategory, project: any, files?: ExtractedFile[]): FixAction {
  switch (category) {
    case "project_settings_error":
    case "framework_detection_error": {
      // Re-analyze the project to get correct framework settings
      const analysis = files?.length ? detectProjectType(files) : null;
      const fw = analysis?.frontendFramework || project.frontend_framework || project.framework || "";
      const fwLower = fw.toLowerCase();
      let vercelFramework: string | null = null;
      let buildCmd = "npm run build";
      let outputDir = "dist";
      let installCmd = "npm install --legacy-peer-deps";

      if (fwLower.includes("next")) { vercelFramework = "nextjs"; outputDir = ".next"; }
      else if (fwLower.includes("vite") || fwLower.includes("react")) { vercelFramework = "vite"; outputDir = "dist"; }
      else if (fwLower.includes("nuxt")) { vercelFramework = "nuxtjs"; outputDir = ".output"; }
      else if (fwLower.includes("vue")) { vercelFramework = "vue"; outputDir = "dist"; }
      else if (fwLower.includes("svelte")) { vercelFramework = "svelte"; outputDir = "build"; }
      else if (fwLower.includes("angular")) { vercelFramework = "angular"; outputDir = "dist"; }
      else if (fwLower.includes("static")) { vercelFramework = null; buildCmd = ""; outputDir = "."; }

      return {
        fixApplied: `Set projectSettings with framework=${vercelFramework || "auto"}, buildCommand=${buildCmd}, outputDirectory=${outputDir}`,
        modifiedBuildCommand: buildCmd,
        modifiedOutputDir: outputDir,
        shouldRetry: true,
        _vercelFramework: vercelFramework,
        _installCommand: installCmd,
      } as any;
    }
    case "dependency_error":
      return {
        fixApplied: "Reinstall dependencies with --legacy-peer-deps flag",
        modifiedBuildCommand: "npm install --legacy-peer-deps && npm run build",
        shouldRetry: true,
      };
    case "build_error":
      return {
        fixApplied: "Retry build with CI=false to ignore warnings as errors",
        modifiedBuildCommand: "CI=false npm run build",
        shouldRetry: true,
      };
    case "port_error":
      return {
        fixApplied: "Set PORT to 3000 via environment variable",
        modifiedEnvVars: [{ key: "PORT", value: "3000" }],
        modifiedStartCommand: project.backend_start_command || "npm start",
        shouldRetry: true,
      };
    case "env_error":
      return {
        fixApplied: "Inject default NODE_ENV and PORT environment variables",
        modifiedEnvVars: [
          { key: "NODE_ENV", value: "production" },
          { key: "PORT", value: "3000" },
        ],
        shouldRetry: true,
      };
    case "missing_files_error":
      return {
        fixApplied: "Re-upload all files to provider and retry",
        shouldRetry: true,
      };
    case "timeout_error":
      return {
        fixApplied: "Retry deployment (timeouts are often transient)",
        shouldRetry: true,
      };
    case "rate_limit_error":
      return {
        fixApplied: "Wait 60s for rate limit to reset, then retry",
        shouldRetry: true,
      };
    case "permission_error":
      return {
        fixApplied: "Permission error — cannot auto-fix, check API token",
        shouldRetry: false,
      };
    case "unknown_error":
    default:
      return {
        fixApplied: "Generic retry — re-download source and redeploy",
        shouldRetry: true,
      };
  }
}

// ══════════════════════════════════════
// ── GitHub & Vercel & Render helpers ──
// ══════════════════════════════════════

async function downloadGitHubRepoZip(githubUrl: string): Promise<ArrayBuffer> {
  const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error("Invalid GitHub URL");
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, "");
  let res = await fetch(`https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`, { redirect: "follow" });
  if (!res.ok) res = await fetch(`https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`, { redirect: "follow" });
  if (!res.ok) throw new Error(`Failed to download repo: HTTP ${res.status}`);
  return await res.arrayBuffer();
}

async function deployToVercel(
  token: string, projectName: string, files: ExtractedFile[], needsBuild: boolean,
  buildCommand: string | null, outputDir: string | null, framework: string | null,
  appendLog: (msg: string, extra?: Record<string, any>) => Promise<void>
): Promise<{ deployId: string; liveUrl: string }> {
  await appendLog("Checking Vercel project...");
  const checkRes = await safeFetchJson(`https://api.vercel.com/v9/projects/${projectName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (checkRes.status === 404) {
    await appendLog(`Creating Vercel project "${projectName}"...`);
    const createRes = await safeFetchJson("https://api.vercel.com/v10/projects", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName }),
    });
    if (!createRes.ok && createRes.data?.error?.code !== "project_already_exists") {
      await appendLog(`Project create warning: ${JSON.stringify(createRes.data)}`);
    }
  }

  await appendLog(`Preparing ${files.length} files...`, { status: "deploying" });
  const fileShaMap: Map<string, ExtractedFile> = new Map();
  const fileEntries: Array<{ file: string; sha: string; size: number }> = [];
  for (const f of files) {
    const sha = await sha1Hex(f.data);
    fileShaMap.set(sha, f);
    fileEntries.push({ file: f.path, sha, size: f.data.length });
  }

  async function uploadFileBySha(sha: string): Promise<boolean> {
    const f = fileShaMap.get(sha);
    if (!f) return false;
    try {
      const r = await fetch("https://api.vercel.com/v2/files", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream", "x-vercel-digest": sha, "Content-Length": String(f.data.length) },
        body: f.data,
      });
      await r.text();
      return r.ok || r.status === 409;
    } catch { return false; }
  }

  // Bulk upload
  const batchSize = 10;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(batch.map(async (f) => { await uploadFileBySha(await sha1Hex(f.data)); }));
  }
  await appendLog(`All ${files.length} files uploaded ✓`);

  const deployPayload: any = { name: projectName, project: projectName, files: fileEntries, target: "production" };
  if (needsBuild) {
    deployPayload.projectSettings = {
      buildCommand: buildCommand || "npm run build",
      outputDirectory: outputDir || "dist",
      framework: framework?.toLowerCase()?.includes("react") ? "vite" : framework?.toLowerCase() === "next.js" ? "nextjs" : null,
      installCommand: "npm install --legacy-peer-deps",
    };
  }

  let dr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    await appendLog(attempt === 0 ? "Creating deployment..." : `Retrying deployment (attempt ${attempt + 1})...`);
    dr = await safeFetchJson("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(deployPayload),
    });
    if (dr.ok) break;
    if (dr.data?.error?.code === "missing_files" && dr.data?.error?.missing) {
      const missing: string[] = dr.data.error.missing;
      await appendLog(`Re-uploading ${missing.length} missing files...`);
      for (let i = 0; i < missing.length; i += batchSize) {
        await Promise.all(missing.slice(i, i + batchSize).map((sha) => uploadFileBySha(sha)));
      }
      continue;
    }
    break;
  }

  if (!dr.ok) {
    if (needsBuild) {
      await appendLog("Build setup failed — retrying as static...");
      delete deployPayload.projectSettings;
      dr = await safeFetchJson("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(deployPayload),
      });
      if (!dr.ok) throw new Error(`Deploy failed: ${JSON.stringify(dr.data)}`);
    } else {
      throw new Error(`Deploy failed: ${JSON.stringify(dr.data)}`);
    }
  }

  const deployId = dr.data.id;
  let liveUrl = `https://${dr.data.url}`;

  let attempts = 0;
  while (attempts < 60) {
    await new Promise((r) => setTimeout(r, 5000));
    const sr = await safeFetchJson(`https://api.vercel.com/v13/deployments/${deployId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sd = sr.data;
    await appendLog(`Build: ${sd.readyState}`);
    if (sd.readyState === "READY") { liveUrl = `https://${projectName}.vercel.app`; break; }
    if (sd.readyState === "ERROR" || sd.readyState === "CANCELED") throw new Error(`Build failed: ${sd.errorMessage || sd.readyState}`);
    attempts++;
  }

  return { deployId, liveUrl };
}

async function deployToRender(
  token: string, serviceName: string, githubUrl: string | null, files: ExtractedFile[],
  appendLog: (msg: string, extra?: Record<string, any>) => Promise<void>,
  envVars?: Array<{ key: string; value: string }>,
  userStartCommand?: string, userBuildCommand?: string,
): Promise<{ deployId: string; liveUrl: string }> {
  const RENDER_API = "https://api.render.com/v1";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const ownerRes = await safeFetchJson(`${RENDER_API}/owners`, { headers });
  if (!ownerRes.ok || !ownerRes.data?.length) throw new Error("Failed to fetch Render owner info");
  const ownerId = ownerRes.data[0]?.owner?.id || ownerRes.data[0]?.id;

  const listRes = await safeFetchJson(`${RENDER_API}/services?name=${encodeURIComponent(serviceName)}&limit=1`, { headers });
  let serviceId = "";
  let serviceUrl = "";

  if (listRes.data?.length > 0 && listRes.data[0]?.service) {
    serviceId = listRes.data[0].service.id;
    serviceUrl = `https://${listRes.data[0].service.serviceDetails?.url || serviceName + ".onrender.com"}`;
    if (envVars?.length) {
      await safeFetchJson(`${RENDER_API}/services/${serviceId}/env-vars`, {
        method: "PUT", headers, body: JSON.stringify(envVars.map((e) => ({ key: e.key, value: e.value }))),
      });
    }
  }

  if (!serviceId) {
    let runtime = "node", startCommand = "npm start", buildCommand = "npm install";
    const hasPython = files.some((f) => f.path === "requirements.txt" || f.path === "main.py" || f.path === "app.py");
    const hasGo = files.some((f) => f.path === "go.mod");
    const hasDocker = files.some((f) => f.path === "Dockerfile");

    if (hasPython) { runtime = "python"; startCommand = "python main.py"; buildCommand = "pip install -r requirements.txt"; }
    else if (hasGo) { runtime = "go"; startCommand = "./main"; buildCommand = "go build -o main ."; }
    else if (hasDocker) { runtime = "docker"; startCommand = ""; buildCommand = ""; }
    else {
      const pkgFile = files.find((f) => f.path === "package.json");
      if (pkgFile) {
        try {
          const pkg = JSON.parse(new TextDecoder().decode(pkgFile.data));
          if (pkg.scripts?.start) startCommand = "npm start";
          if (pkg.scripts?.build) buildCommand = "npm install && npm run build";
        } catch {}
      }
    }

    if (userStartCommand) startCommand = userStartCommand;
    if (userBuildCommand) buildCommand = userBuildCommand;

    if (!githubUrl) throw new Error("Render deployment requires a GitHub URL.");
    const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Invalid GitHub URL for Render");

    const createPayload: any = {
      type: "web_service", name: serviceName, ownerId,
      repo: `https://github.com/${match[1]}/${match[2].replace(/\.git$/, "")}`,
      autoDeploy: "yes", branch: "main",
      serviceDetails: { runtime, plan: "free", region: "oregon", envSpecificDetails: runtime !== "docker" ? { buildCommand, startCommand } : {} },
    };
    if (envVars?.length) createPayload.envVars = envVars.map((e) => ({ key: e.key, value: e.value }));

    let createRes = await safeFetchJson(`${RENDER_API}/services`, { method: "POST", headers, body: JSON.stringify(createPayload) });
    if (!createRes.ok) {
      createPayload.branch = "master";
      createRes = await safeFetchJson(`${RENDER_API}/services`, { method: "POST", headers, body: JSON.stringify(createPayload) });
      if (!createRes.ok) throw new Error(`Render create failed: ${JSON.stringify(createRes.data)}`);
    }
    serviceId = createRes.data.service?.id || createRes.data.id;
    serviceUrl = `https://${serviceName}.onrender.com`;
  }

  await appendLog("Triggering Render deploy...", { status: "deploying" });
  const deployRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys`, {
    method: "POST", headers, body: JSON.stringify({ clearCache: "do_not_clear" }),
  });
  let deployId = deployRes.ok ? (deployRes.data.id || deployRes.data.deploy?.id || serviceId) : serviceId;

  let attempts = 0;
  while (attempts < 90) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const statusRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys?limit=1`, { headers });
      if (statusRes.ok && statusRes.data?.length > 0) {
        const latest = statusRes.data[0]?.deploy || statusRes.data[0];
        await appendLog(`Render build: ${latest.status}`);
        if (latest.status === "live") { await appendLog(`Live ✓ → ${serviceUrl}`); break; }
        if (["deactivated", "build_failed", "update_failed", "canceled"].includes(latest.status)) {
          if (latest.id) {
            const logRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys/${latest.id}/logs`, { headers });
            if (logRes.ok && Array.isArray(logRes.data)) {
              await appendLog(`Build logs:\n${logRes.data.map((l: any) => l.message || JSON.stringify(l)).join("\n").slice(-2000)}`);
            }
          }
          throw new Error(`Render deploy failed: ${latest.status}`);
        }
      }
    } catch (e: any) {
      if (e.message.includes("Render deploy failed")) throw e;
    }
    attempts++;
  }

  return { deployId, liveUrl: serviceUrl || `https://${serviceName}.onrender.com` };
}

// ══════════════════════════════════════
// ── Auto-Heal Orchestrator ──
// ══════════════════════════════════════

async function runAutoHeal(
  supabase: any, deploymentId: string, errorMessage: string,
  appendLog: (msg: string, extra?: Record<string, any>) => Promise<void>
): Promise<{ healed: boolean; retryCount: number; finalStatus: string }> {
  const { data: dep } = await supabase.from("deployments").select("*, projects(*), cloud_connections(*)").eq("id", deploymentId).single();
  if (!dep) return { healed: false, retryCount: 0, finalStatus: "error" };

  const project = (dep as any).projects;
  const connection = (dep as any).cloud_connections;
  if (!project || !connection) return { healed: false, retryCount: 0, finalStatus: "error" };

  const MAX_RETRIES = dep.max_retries || 3;
  let currentRetry = dep.retry_count || 0;

  if (currentRetry >= MAX_RETRIES) {
    // All retries exhausted → FAILED_FINAL
    await supabase.from("deployments").update({
      status: "error",
      error_message: `Auto-heal exhausted after ${MAX_RETRIES} retries: ${errorMessage}`,
      last_error_category: "exhausted",
    }).eq("id", deploymentId);

    // Create alert
    await supabase.from("deployment_alerts").insert({
      deployment_id: deploymentId,
      project_id: project.id,
      user_id: dep.user_id,
      alert_type: "autoheal_failed",
      message: `Deployment for "${project.name}" failed after ${MAX_RETRIES} auto-heal attempts. Last error: ${errorMessage.slice(0, 200)}`,
    });

    await appendLog(`❌ All ${MAX_RETRIES} auto-heal retries exhausted. Alert created.`);
    return { healed: false, retryCount: currentRetry, finalStatus: "error" };
  }

  // Analyze the error
  const analysis = analyzeError(errorMessage);
  currentRetry++;

  await appendLog(`🔍 [AUTO-HEAL] Error Analysis: ${analysis.category} — ${analysis.description}`);
  await appendLog(`🔧 [AUTO-HEAL] Suggested Fix: ${analysis.suggestedFix}`);

  // Log the heal attempt
  await supabase.from("deployment_heal_logs").insert({
    deployment_id: deploymentId,
    user_id: dep.user_id,
    attempt_number: currentRetry,
    error_category: analysis.category,
    error_message: errorMessage.slice(0, 500),
    fix_applied: analysis.suggestedFix,
    result: "in_progress",
  });

  // Apply fix
  const fix = applyFix(analysis.category, project);
  await appendLog(`🛠️ [AUTO-HEAL] Applying fix: ${fix.fixApplied}`);

  // Update deployment with retry info
  const waitSec = currentRetry * 10;
  await supabase.from("deployments").update({
    status: "building",
    retry_count: currentRetry,
    last_error_category: analysis.category,
    error_message: null,
  }).eq("id", deploymentId);

  await appendLog(`⏳ [AUTO-HEAL] Retry ${currentRetry}/${MAX_RETRIES} — waiting ${waitSec}s...`);
  await new Promise((r) => setTimeout(r, waitSec * 1000));

  try {
    // Re-download source
    let retryFiles: ExtractedFile[] = [];
    if (project.source_type === "github" && project.github_url) {
      const zipBuf = await downloadGitHubRepoZip(project.github_url);
      retryFiles = extractZipFilesRaw(zipBuf);
    } else if (project.source_type === "zip") {
      const { data: fList } = await supabase.storage.from("project-uploads").list(project.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });
      if (fList?.length > 0) {
        const { data: fd } = await supabase.storage.from("project-uploads").download(`${project.user_id}/${fList[0].name}`);
        if (fd) retryFiles = extractZipFilesRaw(await fd.arrayBuffer());
      }
    }

    if (retryFiles.length === 0) throw new Error("No source files found for retry");

    const needsBuild = detectBuildNeeded(retryFiles);
    const sub = dep.live_url
      ? dep.live_url.replace(/^https?:\/\//, "").replace(/\.(vercel\.app|onrender\.com).*$/, "")
      : project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    // Apply fix modifications
    const effectiveBuildCmd = fix.modifiedBuildCommand || project.build_command;
    const effectiveStartCmd = fix.modifiedStartCommand || project.backend_start_command;
    const effectiveEnvVars = fix.modifiedEnvVars || [];

    let result: { deployId: string; liveUrl: string };
    if (connection.provider === "vercel") {
      result = await deployToVercel(connection.token, sub, retryFiles, needsBuild, effectiveBuildCmd, project.output_dir, project.framework, appendLog);
    } else if (connection.provider === "render") {
      result = await deployToRender(connection.token, sub, project.github_url, retryFiles, appendLog, effectiveEnvVars, effectiveStartCmd, effectiveBuildCmd);
    } else {
      throw new Error("Unsupported provider");
    }

    // Success!
    await appendLog(`✅ [AUTO-HEAL] Retry ${currentRetry} succeeded!`, { status: "live", live_url: result.liveUrl, deploy_id: result.deployId });
    await supabase.from("projects").update({ status: "live" }).eq("id", project.id);

    // Update heal log
    await supabase.from("deployment_heal_logs")
      .update({ result: "success" })
      .eq("deployment_id", deploymentId)
      .eq("attempt_number", currentRetry);

    return { healed: true, retryCount: currentRetry, finalStatus: "live" };

  } catch (retryErr: any) {
    await appendLog(`⚠️ [AUTO-HEAL] Retry ${currentRetry} failed: ${retryErr.message}`);

    // Update heal log
    await supabase.from("deployment_heal_logs")
      .update({ result: "failed", fix_details: { error: retryErr.message } })
      .eq("deployment_id", deploymentId)
      .eq("attempt_number", currentRetry);

    // Recursively try next retry
    return runAutoHeal(supabase, deploymentId, retryErr.message, appendLog);
  }
}

// ══════════════════════════════════════
// ── Main Server ──
// ══════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let deploymentId: string | undefined;

  try {
    const body = await req.json();
    const { action } = body;

    // ── GET autoheal status ──
    if (action === "autoheal-status") {
      const { deploymentId: depId } = body;
      if (!depId) throw new Error("Missing deploymentId");

      const { data: dep } = await supabase.from("deployments").select("*").eq("id", depId).single();
      if (!dep) throw new Error("Deployment not found");

      const { data: healLogs } = await supabase.from("deployment_heal_logs")
        .select("*")
        .eq("deployment_id", depId)
        .order("attempt_number", { ascending: true });

      const { data: alerts } = await supabase.from("deployment_alerts")
        .select("*")
        .eq("deployment_id", depId)
        .order("created_at", { ascending: false })
        .limit(5);

      return json({
        success: true,
        deploymentId: depId,
        status: dep.status,
        retryCount: dep.retry_count || 0,
        maxRetries: dep.max_retries || 3,
        lastErrorCategory: dep.last_error_category,
        errorMessage: dep.error_message,
        healLogs: healLogs || [],
        alerts: alerts || [],
      });
    }

    // ── Manually trigger autoheal ──
    if (action === "trigger-autoheal") {
      const { deploymentId: depId } = body;
      if (!depId) throw new Error("Missing deploymentId");

      const { data: dep } = await supabase.from("deployments").select("*").eq("id", depId).single();
      if (!dep) throw new Error("Deployment not found");
      if (dep.status !== "error") return json({ success: false, error: "Deployment is not in error state" });

      // Reset retry count for manual trigger
      await supabase.from("deployments").update({ retry_count: 0 }).eq("id", depId);

      const appendLog = async (log: string, extra?: Record<string, any>) => {
        const { data: cur } = await supabase.from("deployments").select("logs").eq("id", depId).single();
        const ts = new Date().toISOString().slice(11, 19);
        await supabase.from("deployments").update({ logs: (cur?.logs || "") + `[${ts}] ${log}\n`, ...extra }).eq("id", depId);
      };

      const result = await runAutoHeal(supabase, depId, dep.error_message || "Unknown error", appendLog);
      return json({ success: result.healed, ...result });
    }

    // ── Get project alerts ──
    if (action === "get-alerts") {
      const { projectId, userId } = body;
      const query = supabase.from("deployment_alerts").select("*").order("created_at", { ascending: false }).limit(20);
      if (projectId) query.eq("project_id", projectId);
      if (userId) query.eq("user_id", userId);
      const { data } = await query;
      return json({ success: true, alerts: data || [] });
    }

    // ── Mark alert as read ──
    if (action === "mark-alert-read") {
      const { alertId } = body;
      if (!alertId) throw new Error("Missing alertId");
      await supabase.from("deployment_alerts").update({ is_read: true }).eq("id", alertId);
      return json({ success: true });
    }

    // ── Fetch Render service logs ──
    if (action === "fetch-logs") {
      const { deploymentId: depId } = body;
      if (!depId) throw new Error("Missing deploymentId");
      const { data: dep } = await supabase.from("deployments").select("*, cloud_connections(*)").eq("id", depId).single();
      if (!dep) throw new Error("Deployment not found");
      const connection = (dep as any).cloud_connections;
      if (!connection) throw new Error("Connection not found");
      const token = connection.token;
      const RENDER_API = "https://api.render.com/v1";
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      let serviceId = dep.deploy_id;
      if (!serviceId && dep.live_url) {
        const svcName = dep.live_url.replace(/^https?:\/\//, "").replace(/\.onrender\.com.*$/, "");
        const listRes = await safeFetchJson(`${RENDER_API}/services?name=${encodeURIComponent(svcName)}&limit=1`, { headers });
        if (listRes.ok && listRes.data?.length > 0) serviceId = listRes.data[0].service?.id;
      }
      if (!serviceId) throw new Error("Could not find Render service ID");

      const deploysRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys?limit=1`, { headers });
      let deployLogs: any[] = [];
      if (deploysRes.ok && deploysRes.data?.length > 0) {
        const latestId = deploysRes.data[0]?.deploy?.id || deploysRes.data[0]?.id;
        if (latestId) {
          const logRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys/${latestId}/logs`, { headers });
          if (logRes.ok && Array.isArray(logRes.data)) {
            deployLogs = logRes.data.map((l: any) => ({ timestamp: l.timestamp || new Date().toISOString(), message: l.message || JSON.stringify(l), level: l.level || "info" }));
          }
        }
      }
      return json({ success: true, logs: deployLogs });
    }

    // ── Fetch health ──
    if (action === "fetch-health") {
      const { deploymentId: depId } = body;
      if (!depId) throw new Error("Missing deploymentId");
      const { data: dep } = await supabase.from("deployments").select("*, cloud_connections(*)").eq("id", depId).single();
      if (!dep) throw new Error("Deployment not found");
      const connection = (dep as any).cloud_connections;
      if (!connection) throw new Error("Connection not found");

      let healthCheck = { reachable: false, statusCode: 0, responseTime: 0, error: "" };
      if (dep.live_url) {
        const start = Date.now();
        try {
          const hRes = await fetch(dep.live_url, { signal: AbortSignal.timeout(15000) });
          healthCheck = { reachable: hRes.ok, statusCode: hRes.status, responseTime: Date.now() - start, error: hRes.ok ? "" : `HTTP ${hRes.status}` };
        } catch (e: any) {
          healthCheck = { reachable: false, statusCode: 0, responseTime: Date.now() - start, error: e.message };
        }
      }
      return json({ success: true, healthCheck });
    }

    // ── Delete deployment ──
    if (action === "delete") {
      const { deploymentId: delId } = body;
      if (!delId) throw new Error("Missing deploymentId");
      await supabase.from("deployments").delete().eq("id", delId);
      return json({ success: true });
    }

    // ── Delete connection ──
    if (action === "delete-connection") {
      const { connectionId } = body;
      if (!connectionId) throw new Error("Missing connectionId");
      await supabase.from("deployments").delete().eq("cloud_connection_id", connectionId);
      await supabase.from("cloud_connections").delete().eq("id", connectionId);
      return json({ success: true });
    }

    // ── Delete project ──
    if (action === "delete-project") {
      const { projectId, userId } = body;
      if (!projectId) throw new Error("Missing projectId");
      await supabase.from("deployments").delete().eq("project_id", projectId);
      if (userId) {
        const { data: sf } = await supabase.storage.from("project-uploads").list(userId);
        if (sf?.length) await supabase.storage.from("project-uploads").remove(sf.map((f: any) => `${userId}/${f.name}`));
      }
      await supabase.from("projects").delete().eq("id", projectId);
      return json({ success: true });
    }

    // ── Update env vars ──
    if (action === "update-env-vars") {
      const { deploymentId: depId, envVars } = body;
      if (!depId || !envVars) throw new Error("Missing deploymentId or envVars");
      const { data: dep } = await supabase.from("deployments").select("*, cloud_connections(*)").eq("id", depId).single();
      if (!dep) throw new Error("Deployment not found");
      const connection = (dep as any).cloud_connections;
      if (!connection || connection.provider !== "render") throw new Error("Only Render supports env vars editing");

      const RENDER_API = "https://api.render.com/v1";
      const headers = { Authorization: `Bearer ${connection.token}`, "Content-Type": "application/json" };
      let serviceId = dep.deploy_id;
      if (!serviceId && dep.live_url) {
        const svcName = dep.live_url.replace(/^https?:\/\//, "").replace(/\.onrender\.com.*$/, "");
        const listRes = await safeFetchJson(`${RENDER_API}/services?name=${encodeURIComponent(svcName)}&limit=1`, { headers });
        if (listRes.ok && listRes.data?.length > 0) serviceId = listRes.data[0].service?.id;
      }
      if (!serviceId) throw new Error("Could not find Render service ID");

      const envRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/env-vars`, {
        method: "PUT", headers, body: JSON.stringify(envVars.map((e: any) => ({ key: e.key, value: e.value }))),
      });
      if (!envRes.ok) throw new Error(`Failed: ${JSON.stringify(envRes.data)}`);
      return json({ success: true });
    }

    // ── Analyze project ──
    if (action === "analyze") {
      const { projectId: analyzeProjectId } = body;
      if (!analyzeProjectId) throw new Error("Missing projectId");
      const { data: proj } = await supabase.from("projects").select("*").eq("id", analyzeProjectId).single();
      if (!proj) throw new Error("Project not found");

      let extractedFiles: ExtractedFile[] = [];
      if (proj.source_type === "github" && proj.github_url) {
        extractedFiles = extractZipFilesRaw(await downloadGitHubRepoZip(proj.github_url));
      } else if (proj.source_type === "zip") {
        const { data: fileList } = await supabase.storage.from("project-uploads").list(proj.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });
        if (fileList?.length > 0) {
          const { data: fileData } = await supabase.storage.from("project-uploads").download(`${proj.user_id}/${fileList[0].name}`);
          if (fileData) extractedFiles = extractZipFilesRaw(await fileData.arrayBuffer());
        }
      }

      if (extractedFiles.length === 0) {
        await supabase.from("projects").update({ status: "ready", framework: "Unknown", project_type: "frontend" }).eq("id", analyzeProjectId);
        return json({ success: true, projectType: "frontend" });
      }

      const analysis = detectProjectType(extractedFiles);
      let projectType = "frontend";
      if (analysis.hasBackend && analysis.hasFrontend) projectType = "fullstack";
      else if (analysis.hasBackend) projectType = "backend";

      // Build a file tree summary for deep analysis display
      const fileSummary = extractedFiles.map((f) => f.path).sort();
      const directories = [...new Set(fileSummary.map((f) => f.split("/")[0]))];

      await supabase.from("projects").update({
        status: "ready",
        framework: analysis.framework,
        project_type: projectType,
        build_command: analysis.buildCommand || "npm run build",
        output_dir: analysis.outputDir || "dist",
        frontend_framework: analysis.frontendFramework || null,
        frontend_build_command: analysis.frontendBuildCommand || null,
        frontend_output_dir: analysis.frontendOutputDir || null,
        backend_framework: analysis.backendFramework || null,
        backend_build_command: analysis.backendBuildCommand || null,
        backend_start_command: analysis.backendStartCommand || null,
      }).eq("id", analyzeProjectId);

      return json({
        success: true, projectType, framework: analysis.framework,
        hasFrontend: analysis.hasFrontend, hasBackend: analysis.hasBackend,
        frontendFramework: analysis.frontendFramework, backendFramework: analysis.backendFramework,
        backendStartCommand: analysis.backendStartCommand,
        needsUserInput: analysis.needsUserInput, missingInfo: analysis.missingInfo,
        detectedFiles: analysis.detectedFiles,
        directories, totalFiles: extractedFiles.length,
      });
    }

    // ── Check project-name availability ──
    if (action === "check-name") {
      const { name, provider, token } = body;
      if (!name || !token) throw new Error("Missing name or token");
      const projectName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      if (provider === "vercel") {
        const res = await safeFetchJson(`https://api.vercel.com/v9/projects/${projectName}`, { headers: { Authorization: `Bearer ${token}` } });
        return json({ success: true, available: res.status === 404, projectName });
      }
      if (provider === "render") {
        const res = await safeFetchJson(`https://api.render.com/v1/services?name=${encodeURIComponent(projectName)}&limit=1`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        return json({ success: true, available: !res.data?.length, projectName });
      }
      return json({ success: true, available: true, projectName });
    }

    // ── Check domain ──
    if (action === "check-domain") {
      const { domain, provider, token } = body;
      if (!domain || !token) throw new Error("Missing domain or token");
      if (provider === "vercel") {
        const projName = domain.replace(/\.vercel\.app$/, "");
        const res = await safeFetchJson(`https://api.vercel.com/v9/projects/${projName}`, { headers: { Authorization: `Bearer ${token}` } });
        return json({ success: true, domain, available: res.status === 404 });
      }
      if (provider === "render") {
        const svcName = domain.replace(/\.onrender\.com$/, "");
        const res = await safeFetchJson(`https://api.render.com/v1/services?name=${encodeURIComponent(svcName)}&limit=1`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        return json({ success: true, domain, available: !res.data?.length });
      }
      return json({ success: true, domain, available: true });
    }

    // ── Redeploy ──
    if (action === "redeploy") {
      const { deploymentId: redeployId } = body;
      if (!redeployId) throw new Error("Missing deploymentId");
      const { data: dep } = await supabase.from("deployments").select("*, projects(*), cloud_connections(*)").eq("id", redeployId).single();
      if (!dep) throw new Error("Deployment not found");

      await supabase.from("deployments").update({ status: "building", error_message: null, retry_count: 0, logs: "[Redeploy] Triggered...\n" }).eq("id", redeployId);

      const project = (dep as any).projects;
      const connection = (dep as any).cloud_connections;
      if (!project || !connection) throw new Error("Project or connection not found");

      const appendLog = async (log: string, extra?: Record<string, any>) => {
        const { data: cur } = await supabase.from("deployments").select("logs").eq("id", redeployId).single();
        const ts = new Date().toISOString().slice(11, 19);
        await supabase.from("deployments").update({ logs: (cur?.logs || "") + `[${ts}] ${log}\n`, ...extra }).eq("id", redeployId);
      };

      let extractedFiles: ExtractedFile[] = [];
      if (project.source_type === "github" && project.github_url) {
        extractedFiles = extractZipFilesRaw(await downloadGitHubRepoZip(project.github_url));
      } else if (project.source_type === "zip") {
        const { data: fList } = await supabase.storage.from("project-uploads").list(project.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });
        if (fList?.length > 0) {
          const { data: fd } = await supabase.storage.from("project-uploads").download(`${project.user_id}/${fList[0].name}`);
          if (fd) extractedFiles = extractZipFilesRaw(await fd.arrayBuffer());
        }
      }

      const needsBuild = detectBuildNeeded(extractedFiles);
      const sub = dep.live_url
        ? dep.live_url.replace(/^https?:\/\//, "").replace(/\.(vercel\.app|onrender\.com).*$/, "")
        : project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

      let result: { deployId: string; liveUrl: string };
      if (connection.provider === "vercel") {
        result = await deployToVercel(connection.token, sub, extractedFiles, needsBuild, project.build_command, project.output_dir, project.framework, appendLog);
      } else {
        result = await deployToRender(connection.token, sub, project.github_url, extractedFiles, appendLog);
      }

      await appendLog("Redeployment successful! ✅", { status: "live", live_url: result.liveUrl, deploy_id: result.deployId });
      return json({ success: true, url: result.liveUrl });
    }

    // ══════════════════════════════════════
    // ── Deploy (main flow) ──
    // ══════════════════════════════════════
    deploymentId = body.deploymentId;
    const { projectId, connectionId, customDomain, envVars: bodyEnvVars, customStartCommand, customBuildCommand } = body;

    if (!deploymentId || !projectId || !connectionId) {
      throw new Error(`Missing: deploymentId=${deploymentId}, projectId=${projectId}, connectionId=${connectionId}`);
    }

    const appendLog = async (log: string, extra?: Record<string, any>) => {
      const { data: cur } = await supabase.from("deployments").select("logs").eq("id", deploymentId!).single();
      const ts = new Date().toISOString().slice(11, 19);
      await supabase.from("deployments").update({ logs: (cur?.logs || "") + `[${ts}] ${log}\n`, ...extra }).eq("id", deploymentId!);
    };

    await appendLog("Fetching deployment details...", { status: "building" });

    const [projRes, connRes] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("cloud_connections").select("*").eq("id", connectionId).single(),
    ]);
    if (projRes.error) throw new Error(projRes.error.message);
    if (connRes.error) throw new Error(connRes.error.message);

    const project = projRes.data!;
    const connection = connRes.data!;
    const provider = connection.provider;
    const token = connection.token;

    let desiredSubdomain = customDomain
      ? customDomain.replace(/\.(vercel\.app|onrender\.com)$/, "").toLowerCase().replace(/[^a-z0-9-]/g, "-")
      : project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    await appendLog(`Provider: ${provider} | Project: ${project.name} | Source: ${project.source_type}`);

    let extractedFiles: ExtractedFile[] = [];
    if (project.source_type === "github" && project.github_url) {
      await appendLog("Cloning GitHub repository...");
      const zipBuffer = await downloadGitHubRepoZip(project.github_url);
      await appendLog(`Downloaded ${(zipBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
      const storagePath = `${project.user_id}/${desiredSubdomain}-github.zip`;
      await supabase.storage.from("project-uploads").upload(storagePath, new Blob([zipBuffer], { type: "application/zip" }), { upsert: true });
      extractedFiles = extractZipFilesRaw(zipBuffer);
    } else if (project.source_type === "zip") {
      await appendLog("Processing ZIP upload...");
      const { data: fileList } = await supabase.storage.from("project-uploads").list(project.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });
      if (!fileList?.length) throw new Error("No uploaded files found");
      const filePath = `${project.user_id}/${fileList[0].name}`;
      const { data: fileData, error: dlErr } = await supabase.storage.from("project-uploads").download(filePath);
      if (dlErr || !fileData) throw new Error(`Download failed: ${dlErr?.message}`);
      extractedFiles = extractZipFilesRaw(await fileData.arrayBuffer());
    } else {
      throw new Error(`Unsupported source type: ${project.source_type}`);
    }

    await appendLog(`Extracted ${extractedFiles.length} files`);

    const needsBuild = detectBuildNeeded(extractedFiles);
    const projectAnalysis = detectProjectType(extractedFiles);
    await appendLog(`Analysis: frontend=${projectAnalysis.hasFrontend} (${projectAnalysis.frontendFramework}), backend=${projectAnalysis.hasBackend} (${projectAnalysis.backendFramework})`);

    let result: { deployId: string; liveUrl: string };
    if (provider === "vercel") {
      result = await deployToVercel(token, desiredSubdomain, extractedFiles, needsBuild, project.build_command, project.output_dir, project.framework, appendLog);
    } else if (provider === "render") {
      result = await deployToRender(token, desiredSubdomain, project.github_url, extractedFiles, appendLog, bodyEnvVars, customStartCommand, customBuildCommand);
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    await appendLog("Deployment successful! ✅", { status: "live", live_url: result.liveUrl, deploy_id: result.deployId });
    await supabase.from("projects").update({ status: "live" }).eq("id", projectId);
    return json({ success: true, url: result.liveUrl });

  } catch (error: any) {
    console.error("Deployment error:", error);
    if (deploymentId) {
      const ts = new Date().toISOString().slice(11, 19);
      const { data: cur } = await supabase.from("deployments").select("logs").eq("id", deploymentId).single();
      await supabase.from("deployments").update({
        logs: (cur?.logs || "") + `[${ts}] ❌ ERROR: ${error.message}\n[${ts}] 🔄 Starting auto-heal...\n`,
        error_message: error.message,
      }).eq("id", deploymentId);

      // Trigger auto-heal
      const appendLog = async (log: string, extra?: Record<string, any>) => {
        const { data: c } = await supabase.from("deployments").select("logs").eq("id", deploymentId!).single();
        const t = new Date().toISOString().slice(11, 19);
        await supabase.from("deployments").update({ logs: (c?.logs || "") + `[${t}] ${log}\n`, ...extra }).eq("id", deploymentId!);
      };

      try {
        const healResult = await runAutoHeal(supabase, deploymentId, error.message, appendLog);
        if (healResult.healed) {
          return json({ success: true, autoHealed: true, retryCount: healResult.retryCount });
        }
      } catch (healErr: any) {
        console.error("Auto-heal error:", healErr);
      }

      // If we get here, auto-heal failed or was exhausted
      const { data: finalCur } = await supabase.from("deployments").select("logs").eq("id", deploymentId).single();
      await supabase.from("deployments").update({
        status: "error",
        error_message: error.message,
        logs: (finalCur?.logs || "") + `[${ts}] ❌ Auto-heal could not resolve the issue.\n`,
      }).eq("id", deploymentId);
    }
    return json({ success: false, error: error.message }, 500);
  }
});
