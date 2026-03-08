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
  const ct = res.headers.get("content-type") || "";
  let data: any;
  if (ct.includes("application/json")) {
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
  return files.some((f) =>
    f.path === "package.json" || f.path === "requirements.txt" || f.path === "Cargo.toml" ||
    f.path === "pom.xml" || f.path === "build.gradle" || f.path === "go.mod" ||
    f.path === "Gemfile" || f.path === "composer.json"
  );
}

// ══════════════════════════════════════
// ── Deep Project Analysis ──
// ══════════════════════════════════════

interface DetectionRule {
  name: string;
  trigger: string; // human-readable trigger description
}

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
  frontendRootDir: string;
  backendFramework: string;
  backendBuildCommand: string;
  backendStartCommand: string;
  backendRootDir: string;
  backendRuntime: string;
  needsUserInput: boolean;
  missingInfo: string[];
  detectedFiles: { frontend: string[]; backend: string[] };
  detectionRules: DetectionRule[];
  deploymentType: "frontend" | "backend" | "fullstack";
}

function readFileText(files: ExtractedFile[], filePath: string): string {
  const f = files.find((x) => x.path.toLowerCase() === filePath.toLowerCase());
  if (!f) return "";
  try { return new TextDecoder().decode(f.data); } catch { return ""; }
}

function detectProjectType(files: ExtractedFile[]): StackAnalysis {
  const allPaths = files.map((f) => f.path.toLowerCase());
  const allNames = files.map((f) => f.path);
  const rules: DetectionRule[] = [];

  const hasFile = (name: string) => allPaths.some((p) => p === name.toLowerCase() || p.endsWith("/" + name.toLowerCase()));
  const hasFileInRoot = (name: string) => allPaths.some((p) => p === name.toLowerCase());
  const filesInDir = (dir: string) => allNames.filter((p) => p.toLowerCase().startsWith(dir.toLowerCase() + "/"));

  const frontendDirs = ["frontend", "client", "web", "app", "ui", "packages/frontend", "packages/client", "packages/web"];
  const backendDirs = ["backend", "server", "api", "services", "packages/backend", "packages/server", "packages/api"];

  let detectedFrontendDir = "";
  let detectedBackendDir = "";
  const frontendDetectedFiles: string[] = [];
  const backendDetectedFiles: string[] = [];

  for (const dir of frontendDirs) {
    const dirFiles = filesInDir(dir);
    if (dirFiles.length > 0) {
      detectedFrontendDir = dir;
      frontendDetectedFiles.push(...dirFiles.slice(0, 5));
      rules.push({ name: "frontend_dir", trigger: `Found frontend directory: ${dir}` });
      break;
    }
  }
  for (const dir of backendDirs) {
    const dirFiles = filesInDir(dir);
    if (dirFiles.length > 0) {
      detectedBackendDir = dir;
      backendDetectedFiles.push(...dirFiles.slice(0, 5));
      rules.push({ name: "backend_dir", trigger: `Found backend directory: ${dir}` });
      break;
    }
  }

  // ── Parse package.json files ──
  let rootPkgDeps: Record<string, string> = {};
  let rootPkgScripts: Record<string, string> = {};
  const pkgText = readFileText(files, "package.json");
  if (pkgText) {
    try {
      const pkg = JSON.parse(pkgText);
      rootPkgDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      rootPkgScripts = pkg.scripts || {};
    } catch {}
  }

  let frontendPkgDeps: Record<string, string> = {};
  let frontendPkgScripts: Record<string, string> = {};
  let backendPkgDeps: Record<string, string> = {};
  let backendPkgScripts: Record<string, string> = {};

  if (detectedFrontendDir) {
    const t = readFileText(files, `${detectedFrontendDir}/package.json`);
    if (t) { try { const p = JSON.parse(t); frontendPkgDeps = { ...p.dependencies, ...p.devDependencies }; frontendPkgScripts = p.scripts || {}; } catch {} }
  }
  if (detectedBackendDir) {
    const t = readFileText(files, `${detectedBackendDir}/package.json`);
    if (t) { try { const p = JSON.parse(t); backendPkgDeps = { ...p.dependencies, ...p.devDependencies }; backendPkgScripts = p.scripts || {}; } catch {} }
  }

  const allDeps = { ...rootPkgDeps, ...frontendPkgDeps, ...backendPkgDeps };

  // ── File existence checks ──
  const hasPackageJson = hasFile("package.json");
  const hasIndexHtml = hasFile("index.html");
  const hasTsx = allPaths.some((f) => f.endsWith(".tsx") || f.endsWith(".jsx"));
  const hasVueFiles = allPaths.some((f) => f.endsWith(".vue"));
  const hasSvelteFiles = allPaths.some((f) => f.endsWith(".svelte"));
  const hasNextConfig = allPaths.some((f) => /^(.*\/)?next\.config\.(js|mjs|ts)$/.test(f));
  const hasViteConfig = allPaths.some((f) => /^(.*\/)?vite\.config\.(ts|js)$/.test(f));
  const hasAngularJson = hasFile("angular.json");
  const hasNuxtConfig = hasFile("nuxt.config.ts") || hasFile("nuxt.config.js");

  // Python
  const hasRequirementsTxt = hasFile("requirements.txt");
  const hasManagePy = hasFile("manage.py");
  const hasAppPy = hasFile("app.py");
  const hasMainPy = hasFile("main.py");
  const hasPyprojectToml = hasFile("pyproject.toml");
  const hasPython = hasRequirementsTxt || hasManagePy || hasAppPy || hasMainPy || hasPyprojectToml;

  // Check Python file contents for framework imports
  let pythonHasFlask = false;
  let pythonHasFastAPI = false;
  let pythonHasDjango = hasManagePy;
  if (hasPython) {
    for (const f of files) {
      if (f.path.endsWith(".py")) {
        const content = readFileText(files, f.path);
        if (content.includes("from flask") || content.includes("import flask") || content.includes("Flask(")) pythonHasFlask = true;
        if (content.includes("from fastapi") || content.includes("import fastapi") || content.includes("FastAPI(")) pythonHasFastAPI = true;
        if (content.includes("django")) pythonHasDjango = true;
      }
    }
    // Also check requirements.txt
    const reqContent = readFileText(files, "requirements.txt");
    if (reqContent.includes("flask") || reqContent.includes("Flask")) pythonHasFlask = true;
    if (reqContent.includes("fastapi") || reqContent.includes("FastAPI")) pythonHasFastAPI = true;
    if (reqContent.includes("django") || reqContent.includes("Django")) pythonHasDjango = true;
  }

  // Java
  const hasPomXml = hasFile("pom.xml");
  const hasBuildGradle = hasFile("build.gradle") || hasFile("build.gradle.kts");
  const hasJava = hasPomXml || hasBuildGradle;

  // Go
  const hasGoMod = hasFile("go.mod");

  // PHP
  const hasComposerJson = hasFile("composer.json");
  const hasIndexPhp = hasFile("index.php");
  const hasPhp = hasComposerJson || hasIndexPhp;

  // Ruby
  const hasGemfile = hasFile("Gemfile") || hasFile("gemfile");

  // Docker
  const hasDocker = hasFile("Dockerfile") || hasFile("dockerfile");
  const hasProcfile = hasFile("Procfile") || hasFile("procfile");

  // Server files (Node.js backend indicator)
  const serverFileNames = ["server.js", "server.ts", "app.js", "app.ts", "index.js", "index.ts"];
  const hasServerFile = allPaths.some((f) => {
    const name = f.split("/").pop() || "";
    return serverFileNames.includes(name);
  });
  const hasNodeBackendDep = !!(allDeps["express"] || allDeps["fastify"] || allDeps["koa"] || allDeps["hapi"] || allDeps["@nestjs/core"] || allDeps["nest"]);

  // ── Determine Frontend ──
  let hasFrontend = false;
  let frontendFramework = "";
  let frontendBuildCommand = "npm run build";
  let frontendOutputDir = "dist";

  // Next.js (can be frontend or fullstack, deploy to Vercel)
  if (hasNextConfig || allDeps["next"]) {
    hasFrontend = true;
    frontendFramework = "Next.js";
    frontendOutputDir = ".next";
    rules.push({ name: "nextjs", trigger: allDeps["next"] ? 'package.json contains "next"' : "next.config.js exists" });
  }
  // Nuxt
  else if (hasNuxtConfig || allDeps["nuxt"]) {
    hasFrontend = true;
    frontendFramework = "Nuxt";
    frontendOutputDir = ".output";
    rules.push({ name: "nuxt", trigger: "nuxt.config detected" });
  }
  // Angular
  else if (hasAngularJson) {
    hasFrontend = true;
    frontendFramework = "Angular";
    frontendOutputDir = "dist";
    rules.push({ name: "angular", trigger: "angular.json exists" });
  }
  // React (Vite or CRA)
  else if (allDeps["react"]) {
    hasFrontend = true;
    frontendFramework = hasViteConfig ? "React (Vite)" : "React";
    frontendOutputDir = hasViteConfig ? "dist" : "build";
    rules.push({ name: "react", trigger: 'package.json contains "react"' });
  }
  // Vue
  else if (hasVueFiles || allDeps["vue"]) {
    hasFrontend = true;
    frontendFramework = "Vue";
    frontendOutputDir = "dist";
    rules.push({ name: "vue", trigger: allDeps["vue"] ? 'package.json contains "vue"' : ".vue files detected" });
  }
  // Svelte
  else if (hasSvelteFiles || allDeps["svelte"]) {
    hasFrontend = true;
    frontendFramework = "Svelte";
    frontendOutputDir = allDeps["@sveltejs/kit"] ? ".svelte-kit" : "public/build";
    rules.push({ name: "svelte", trigger: allDeps["svelte"] ? 'package.json contains "svelte"' : ".svelte files detected" });
  }
  // Static HTML
  else if (hasIndexHtml && !hasPackageJson && !hasPython && !hasJava && !hasGoMod && !hasPhp && !hasGemfile) {
    hasFrontend = true;
    frontendFramework = "Static HTML";
    frontendBuildCommand = "";
    frontendOutputDir = ".";
    rules.push({ name: "static", trigger: "index.html in root with no build tools" });
  }
  // Frontend directory detected
  else if (detectedFrontendDir) {
    hasFrontend = true;
    if (frontendPkgDeps["react"]) frontendFramework = "React";
    else if (frontendPkgDeps["vue"]) frontendFramework = "Vue";
    else if (frontendPkgDeps["svelte"]) frontendFramework = "Svelte";
    else if (frontendPkgDeps["next"]) { frontendFramework = "Next.js"; frontendOutputDir = ".next"; }
    else frontendFramework = "Unknown Frontend";
  }

  // Adjust build command for frontend subdir
  if (detectedFrontendDir && frontendBuildCommand === "npm run build") {
    frontendBuildCommand = `cd ${detectedFrontendDir} && npm install && npm run build`;
  }

  // ── Determine Backend ──
  let hasBackend = false;
  let backendFramework = "";
  let backendBuildCommand = "npm install";
  let backendStartCommand = "npm start";
  let backendRuntime = "node";

  // Python
  if (hasPython) {
    hasBackend = true;
    backendRuntime = "python";
    if (pythonHasDjango) {
      backendFramework = "Python (Django)";
      backendBuildCommand = hasRequirementsTxt ? "pip install -r requirements.txt" : "pip install .";
      backendStartCommand = "gunicorn --bind 0.0.0.0:$PORT $(grep -l 'wsgi' **/settings.py 2>/dev/null | head -1 | sed 's/\\/settings.py/.wsgi:application/') || python manage.py runserver 0.0.0.0:$PORT";
      // Simplified:
      backendStartCommand = "python manage.py runserver 0.0.0.0:$PORT";
      rules.push({ name: "django", trigger: "manage.py detected" });
    } else if (pythonHasFastAPI) {
      backendFramework = "Python (FastAPI)";
      backendBuildCommand = hasRequirementsTxt ? "pip install -r requirements.txt" : "pip install .";
      const entryFile = hasMainPy ? "main" : "app";
      backendStartCommand = `uvicorn ${entryFile}:app --host 0.0.0.0 --port $PORT`;
      rules.push({ name: "fastapi", trigger: "FastAPI import detected in Python files" });
    } else if (pythonHasFlask) {
      backendFramework = "Python (Flask)";
      backendBuildCommand = hasRequirementsTxt ? "pip install -r requirements.txt" : "pip install .";
      const entryFile = hasAppPy ? "app" : "main";
      backendStartCommand = `python ${entryFile}.py`;
      rules.push({ name: "flask", trigger: "Flask import detected in Python files" });
    } else {
      backendFramework = "Python";
      backendBuildCommand = hasRequirementsTxt ? "pip install -r requirements.txt" : "pip install .";
      backendStartCommand = hasMainPy ? "python main.py" : "python app.py";
      rules.push({ name: "python", trigger: "Python files detected (requirements.txt/main.py/app.py)" });
    }
  }
  // Java (Spring Boot)
  else if (hasJava) {
    hasBackend = true;
    backendRuntime = "docker"; // Java on Render typically uses Docker
    if (hasPomXml) {
      backendFramework = "Java (Maven/Spring Boot)";
      backendBuildCommand = "./mvnw clean package -DskipTests || mvn clean package -DskipTests";
      backendStartCommand = "java -jar target/*.jar";
      rules.push({ name: "java_maven", trigger: "pom.xml detected" });
    } else {
      backendFramework = "Java (Gradle/Spring Boot)";
      backendBuildCommand = "./gradlew build -x test || gradle build -x test";
      backendStartCommand = "java -jar build/libs/*.jar";
      rules.push({ name: "java_gradle", trigger: "build.gradle detected" });
    }
  }
  // Go
  else if (hasGoMod) {
    hasBackend = true;
    backendRuntime = "go";
    backendFramework = "Go";
    backendBuildCommand = "go build -o main .";
    backendStartCommand = "./main";
    rules.push({ name: "go", trigger: "go.mod detected" });
  }
  // PHP
  else if (hasPhp) {
    hasBackend = true;
    backendRuntime = "docker"; // PHP on Render uses Docker
    backendFramework = hasComposerJson ? "PHP (Composer)" : "PHP";
    backendBuildCommand = hasComposerJson ? "composer install" : "";
    backendStartCommand = "php -S 0.0.0.0:$PORT";
    rules.push({ name: "php", trigger: hasComposerJson ? "composer.json detected" : "index.php detected" });
  }
  // Ruby
  else if (hasGemfile) {
    hasBackend = true;
    backendRuntime = "ruby";
    backendFramework = "Ruby";
    backendBuildCommand = "bundle install";
    // Check if Rails
    const gemContent = readFileText(files, "Gemfile") || readFileText(files, "gemfile");
    if (gemContent.includes("rails")) {
      backendFramework = "Ruby (Rails)";
      backendStartCommand = "bundle exec rails server -p $PORT -b 0.0.0.0";
      rules.push({ name: "ruby_rails", trigger: "Gemfile contains 'rails'" });
    } else {
      backendStartCommand = "bundle exec ruby app.rb";
      rules.push({ name: "ruby", trigger: "Gemfile detected" });
    }
  }
  // Node.js backend
  else if (hasNodeBackendDep || (hasServerFile && !hasFrontend)) {
    hasBackend = true;
    backendRuntime = "node";
    const serverLib = allDeps["express"] ? "Express" : allDeps["fastify"] ? "Fastify" : allDeps["koa"] ? "Koa" :
      allDeps["@nestjs/core"] ? "NestJS" : allDeps["hapi"] ? "Hapi" : "Node.js";
    backendFramework = `Node.js (${serverLib})`;

    const entryFile = serverFileNames.find((f) => allPaths.includes(f) || allPaths.some((p) => p.endsWith("/" + f))) || "server.js";
    backendStartCommand = rootPkgScripts["start"] ? "npm start" : `node ${entryFile}`;
    backendBuildCommand = rootPkgScripts["build"] ? "npm install && npm run build" : "npm install";
    rules.push({ name: "nodejs", trigger: `Node.js backend detected (${serverLib})` });
  }
  // Docker
  else if (hasDocker) {
    hasBackend = true;
    backendRuntime = "docker";
    backendFramework = "Docker";
    backendBuildCommand = "";
    backendStartCommand = "";
    rules.push({ name: "docker", trigger: "Dockerfile detected" });
  }

  // Fullstack from directories
  if (detectedFrontendDir && detectedBackendDir) {
    hasFrontend = true;
    hasBackend = true;
  }

  // Fullstack from mixed deps (e.g., express + react in same package.json)
  if (allDeps["express"] && allDeps["react"] && !detectedFrontendDir && !detectedBackendDir) {
    hasFrontend = true;
    hasBackend = true;
    if (!frontendFramework) frontendFramework = "React";
    if (!backendFramework) backendFramework = "Node.js (Express)";
    rules.push({ name: "mixed_fullstack", trigger: "Both express and react in package.json" });
  }

  // Adjust backend commands for subdir
  if (detectedBackendDir && backendRuntime === "node") {
    backendBuildCommand = `cd ${detectedBackendDir} && npm install`;
    if (backendPkgScripts["start"]) backendStartCommand = `cd ${detectedBackendDir} && npm start`;
    else if (backendPkgScripts["dev"]) backendStartCommand = `cd ${detectedBackendDir} && npm run dev`;
    else backendStartCommand = `cd ${detectedBackendDir} && node server.js`;
  }

  const missingInfo: string[] = [];
  if (hasBackend && backendRuntime === "node" && backendStartCommand === "npm start" && !rootPkgScripts["start"] && !backendPkgScripts["start"]) {
    missingInfo.push("start_command");
  }

  let framework = hasFrontend ? frontendFramework : backendFramework;
  if (framework === "" && hasBackend) framework = backendFramework;

  const deploymentType = (hasFrontend && hasBackend) ? "fullstack" : hasBackend ? "backend" : "frontend";

  return {
    hasFrontend,
    hasBackend,
    framework: framework || "Unknown",
    buildCommand: hasFrontend ? frontendBuildCommand : backendBuildCommand,
    outputDir: frontendOutputDir,
    startCommand: backendStartCommand,
    frontendFramework: hasFrontend ? (frontendFramework || "Unknown") : "",
    frontendBuildCommand: hasFrontend ? frontendBuildCommand : "",
    frontendOutputDir: hasFrontend ? frontendOutputDir : "",
    frontendRootDir: detectedFrontendDir,
    backendFramework: hasBackend ? (backendFramework || "Unknown") : "",
    backendBuildCommand: hasBackend ? backendBuildCommand : "",
    backendStartCommand: hasBackend ? backendStartCommand : "",
    backendRootDir: detectedBackendDir,
    backendRuntime: hasBackend ? backendRuntime : "",
    needsUserInput: missingInfo.length > 0,
    missingInfo,
    detectedFiles: { frontend: frontendDetectedFiles, backend: backendDetectedFiles },
    detectionRules: rules,
    deploymentType,
  };
}

// ══════════════════════════════════════
// ── Auto-Heal: Error Analyzer ──
// ══════════════════════════════════════

type ErrorCategory =
  | "dependency_error" | "build_error" | "port_error" | "env_error"
  | "missing_files_error" | "timeout_error" | "project_settings_error"
  | "framework_detection_error" | "permission_error" | "rate_limit_error"
  | "command_not_found_error" | "root_directory_error" | "render_build_error"
  | "runtime_error" | "unknown_error";

interface ErrorAnalysis {
  category: ErrorCategory;
  description: string;
  suggestedFix: string;
  extractedDetails?: Record<string, any>;
}

function analyzeError(errorMessage: string): ErrorAnalysis {
  const msg = (errorMessage || "").toLowerCase();

  // Exit code 127 = command not found
  if (msg.includes("exited with 127") || msg.includes("exit code 127") || msg.includes("command not found") || msg.includes("not found: ")) {
    const cmdMatch = errorMessage.match(/command\s+"([^"]+)"\s+exited/i) || errorMessage.match(/"([^"]+)"\s+exited with 127/i);
    return {
      category: "command_not_found_error",
      description: `Build command "${cmdMatch?.[1] || "unknown"}" not found — dependencies need install`,
      suggestedFix: "Install dependencies before build",
      extractedDetails: { failedCommand: cmdMatch?.[1] || "unknown" },
    };
  }

  // Vercel missing_project_settings
  if (msg.includes("missing_project_settings") || (msg.includes("projectsettings") && msg.includes("required"))) {
    return {
      category: "project_settings_error",
      description: "Vercel requires projectSettings with framework config",
      suggestedFix: "Add projectSettings with detected framework, buildCommand, outputDirectory",
    };
  }

  // Framework auto-detection
  if (msg.includes("skipautodetectionconfirmation") || msg.includes("automatic framework detection")) {
    return {
      category: "framework_detection_error",
      description: "Vercel cannot auto-detect framework",
      suggestedFix: "Provide explicit framework settings",
    };
  }

  // Render build_failed
  if (msg.includes("render deploy failed") || msg.includes("render_build_failed") || (msg.includes("render") && msg.includes("build_failed"))) {
    // Try to extract useful info from build logs
    const logMatch = errorMessage.match(/Logs:\s*(.+)/s);
    const logSnippet = logMatch?.[1]?.slice(0, 300) || "";
    let subCategory = "general_render_build";
    let fix = "Re-analyze project, fix build/start commands";

    if (logSnippet.includes("command not found") || logSnippet.includes("not found")) {
      subCategory = "render_command_not_found";
      fix = "Fix startCommand — binary or script not found";
    } else if (logSnippet.includes("ModuleNotFoundError") || logSnippet.includes("No module named")) {
      subCategory = "render_missing_module";
      fix = "Install missing Python module";
    } else if (logSnippet.includes("npm ERR") || logSnippet.includes("ERESOLVE")) {
      subCategory = "render_npm_error";
      fix = "Use --legacy-peer-deps for npm install";
    }

    return {
      category: "render_build_error",
      description: `Render build failed (${subCategory})`,
      suggestedFix: fix,
      extractedDetails: { subCategory, logSnippet },
    };
  }

  // Runtime errors
  if (msg.includes("runtime_error") || msg.includes("runtime error") || msg.includes("uncaught exception") ||
      msg.includes("unhandledrejection") || msg.includes("cannot read properties")) {
    return {
      category: "runtime_error",
      description: "Runtime error during deployment or execution",
      suggestedFix: "Analyze runtime error with AI and apply targeted fix",
    };
  }

  // Permission / auth
  if (msg.includes("forbidden") || msg.includes("401") || msg.includes("403") || msg.includes("not_authorized") || msg.includes("invalid_token")) {
    return { category: "permission_error", description: "Auth/permission error", suggestedFix: "Check API token" };
  }

  // Rate limit
  if (msg.includes("rate_limit") || msg.includes("too many requests") || msg.includes("429")) {
    return { category: "rate_limit_error", description: "Rate limit exceeded", suggestedFix: "Wait and retry" };
  }

  // Dependency errors
  if (msg.includes("module not found") || msg.includes("cannot find module") || msg.includes("npm err") ||
      msg.includes("package not found") || msg.includes("enoent") || msg.includes("missing dependency") ||
      msg.includes("eresolve") || msg.includes("peer dep") ||
      (msg.includes("no such file or directory") && (msg.includes("node_modules") || msg.includes("package")))) {
    return { category: "dependency_error", description: "Missing/failed dependency", suggestedFix: "Reinstall with --legacy-peer-deps" };
  }

  // Build errors (NOT exit 127)
  if ((msg.includes("build failed") || msg.includes("compilation error") || msg.includes("syntax error") ||
       msg.includes("type error") || msg.includes("tsc") || msg.includes("webpack") ||
       msg.includes("rollup") || (msg.includes("vite") && msg.includes("error")) ||
       msg.includes("exit code 1") || msg.includes("command failed")) &&
      !msg.includes("exited with 127")) {
    return { category: "build_error", description: "Build process failed", suggestedFix: "Retry with CI=false and clean install" };
  }

  // Port errors
  if (msg.includes("eaddrinuse") || (msg.includes("port") && (msg.includes("already in use") || msg.includes("not available"))) ||
      (msg.includes("listen") && msg.includes("error"))) {
    return { category: "port_error", description: "Port conflict", suggestedFix: "Change to default port 3000/8000" };
  }

  // Env errors
  if ((msg.includes("env") && (msg.includes("missing") || msg.includes("undefined") || msg.includes("not set"))) ||
      msg.includes("environment variable") || msg.includes("api_key") || (msg.includes("secret") && msg.includes("missing"))) {
    return { category: "env_error", description: "Missing env variable", suggestedFix: "Inject defaults" };
  }

  // Missing files
  if (msg.includes("missing_files") || msg.includes("missing files")) {
    return { category: "missing_files_error", description: "File upload incomplete", suggestedFix: "Re-upload and retry" };
  }

  // Timeout
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("deadline exceeded")) {
    return { category: "timeout_error", description: "Deployment timed out", suggestedFix: "Retry" };
  }

  return { category: "unknown_error", description: "Unknown deployment error", suggestedFix: "Analyze with AI and retry" };
}

// ══════════════════════════════════════
// ── AI-Powered Error Analysis ──
// ══════════════════════════════════════

async function analyzeErrorWithAI(errorMessage: string, projectContext: any): Promise<ErrorAnalysis> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return analyzeError(errorMessage);

  try {
    const retryAttempt = projectContext.retryAttempt || 0;
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a deployment error analyzer for cloud platforms (Vercel, Render). You must analyze the EXACT error and provide SPECIFIC, ACTIONABLE fix commands — not generic retries.

For Render Node.js: build command should include "npm install", start command should point to the correct entry file. Default port on Render is 10000, use PORT env var.
For Render Python: build should "pip install -r requirements.txt", start should use correct runner (gunicorn/uvicorn/python).
For Vercel: fix framework detection, install commands, output directories.

IMPORTANT: This is retry attempt ${retryAttempt}. Previous fixes FAILED. You MUST suggest DIFFERENT commands than standard defaults. Analyze the actual error text carefully.

Common Render issues:
- "exited with code 1" during build = npm install failed, try --legacy-peer-deps or check node version
- "exited with code 127" = command not found, wrong start command
- Build succeeds but deploy fails = wrong start command or missing PORT binding
- Python: missing gunicorn/uvicorn in requirements.txt`
          },
          {
            role: "user",
            content: `Error: ${errorMessage.slice(0, 3000)}\n\nProject context: framework=${projectContext.framework || "unknown"}, type=${projectContext.project_type || "unknown"}, frontend=${projectContext.frontend_framework || "none"}, backend=${projectContext.backend_framework || "none"}, provider=${projectContext.provider || "unknown"}, runtime=${projectContext.backendRuntime || "node"}, backend_build="${projectContext.backend_build_command || ""}", backend_start="${projectContext.backend_start_command || ""}", retry=${retryAttempt}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_error",
            description: "Analyze deployment error and provide specific fix commands",
            parameters: {
              type: "object",
              properties: {
                category: { type: "string", enum: ["dependency_error", "build_error", "port_error", "env_error", "command_not_found_error", "root_directory_error", "render_build_error", "project_settings_error", "framework_detection_error", "permission_error", "rate_limit_error", "timeout_error", "missing_files_error", "runtime_error", "unknown_error"] },
                description: { type: "string", description: "Specific description of what went wrong" },
                suggestedFix: { type: "string", description: "Human-readable explanation of the fix" },
                modifiedBuildCommand: { type: "string", description: "Exact build command to use (e.g. 'cd services && npm install --legacy-peer-deps')" },
                modifiedStartCommand: { type: "string", description: "Exact start command to use (e.g. 'cd services && node index.js')" },
                modifiedInstallCommand: { type: "string", description: "Install command override" },
              },
              required: ["category", "description", "suggestedFix", "modifiedBuildCommand", "modifiedStartCommand"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_error" } },
      }),
    });

    if (!response.ok) {
      console.error("AI gateway returned", response.status);
      return analyzeError(errorMessage);
    }
    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return {
        category: parsed.category as ErrorCategory,
        description: parsed.description || "AI-analyzed error",
        suggestedFix: parsed.suggestedFix || "Apply AI-suggested fix",
        extractedDetails: {
          aiAnalyzed: true,
          modifiedBuildCommand: parsed.modifiedBuildCommand,
          modifiedStartCommand: parsed.modifiedStartCommand,
          modifiedInstallCommand: parsed.modifiedInstallCommand,
        },
      };
    }
  } catch (e) {
    console.error("AI analysis error:", e);
  }
  return analyzeError(errorMessage);
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
  modifiedInstallCommand?: string;
  modifiedRootDir?: string;
  shouldRetry: boolean;
  _vercelFramework?: string | null;
}

function applyFix(category: ErrorCategory, project: any, analysis?: StackAnalysis, errorAnalysis?: ErrorAnalysis): FixAction {
  switch (category) {
    case "command_not_found_error": {
      const failedCmd = errorAnalysis?.extractedDetails?.failedCommand || "";
      const frontendDir = analysis?.frontendRootDir || "";
      if (failedCmd.includes("vite") || failedCmd.includes("react-scripts") || failedCmd.includes("next") || failedCmd.includes("ng") || failedCmd.includes("nuxt") || failedCmd.includes("svelte")) {
        return {
          fixApplied: `"${failedCmd}" not found — install deps first, set rootDirectory`,
          modifiedInstallCommand: frontendDir ? `cd ${frontendDir} && npm install --legacy-peer-deps` : "npm install --legacy-peer-deps",
          modifiedBuildCommand: frontendDir ? `cd ${frontendDir} && npm run build` : "npm run build",
          modifiedRootDir: frontendDir || undefined,
          shouldRetry: true,
        };
      }
      return {
        fixApplied: `"${failedCmd}" not found — reinstall all deps`,
        modifiedInstallCommand: "npm install --legacy-peer-deps",
        modifiedBuildCommand: "npm install --legacy-peer-deps && npm run build",
        shouldRetry: true,
      };
    }

    case "project_settings_error":
    case "framework_detection_error": {
      const fw = analysis?.frontendFramework || project.frontend_framework || project.framework || "";
      const fwLower = fw.toLowerCase();
      let vf: string | null = null;
      let outDir = "dist";
      if (fwLower.includes("next")) { vf = "nextjs"; outDir = ".next"; }
      else if (fwLower.includes("vite") || fwLower.includes("react")) { vf = "vite"; outDir = "dist"; }
      else if (fwLower.includes("nuxt")) { vf = "nuxtjs"; outDir = ".output"; }
      else if (fwLower.includes("vue")) { vf = "vue"; outDir = "dist"; }
      else if (fwLower.includes("svelte")) { vf = "svelte"; outDir = "build"; }
      else if (fwLower.includes("angular")) { vf = "angular"; outDir = "dist"; }
      else if (fwLower.includes("static")) { vf = null; outDir = "."; }
      return {
        fixApplied: `Set projectSettings: framework=${vf || "auto"}, output=${outDir}`,
        modifiedBuildCommand: vf ? "npm run build" : "",
        modifiedOutputDir: outDir,
        modifiedInstallCommand: "npm install --legacy-peer-deps",
        modifiedRootDir: analysis?.frontendRootDir || undefined,
        _vercelFramework: vf,
        shouldRetry: true,
      };
    }

    case "render_build_error": {
      const backendDir = analysis?.backendRootDir || "";
      let buildCmd = "npm install";
      let startCmd = "npm start";
      const bf = (analysis?.backendFramework || "").toLowerCase();

      if (bf.includes("python") || bf.includes("django") || bf.includes("flask") || bf.includes("fastapi")) {
        buildCmd = backendDir ? `cd ${backendDir} && pip install -r requirements.txt` : "pip install -r requirements.txt";
        if (bf.includes("django")) startCmd = backendDir ? `cd ${backendDir} && python manage.py runserver 0.0.0.0:$PORT` : "python manage.py runserver 0.0.0.0:$PORT";
        else if (bf.includes("fastapi")) startCmd = backendDir ? `cd ${backendDir} && uvicorn main:app --host 0.0.0.0 --port $PORT` : "uvicorn main:app --host 0.0.0.0 --port $PORT";
        else startCmd = backendDir ? `cd ${backendDir} && python app.py` : "python app.py";
      } else if (bf.includes("go")) {
        buildCmd = backendDir ? `cd ${backendDir} && go build -o main .` : "go build -o main .";
        startCmd = backendDir ? `cd ${backendDir} && ./main` : "./main";
      } else if (bf.includes("ruby")) {
        buildCmd = backendDir ? `cd ${backendDir} && bundle install` : "bundle install";
        startCmd = backendDir ? `cd ${backendDir} && bundle exec rails server -p $PORT` : "bundle exec rails server -p $PORT";
      } else {
        if (backendDir) {
          buildCmd = `cd ${backendDir} && npm install --legacy-peer-deps`;
          startCmd = `cd ${backendDir} && npm start`;
        } else {
          buildCmd = "npm install --legacy-peer-deps";
        }
      }
      if (project.backend_build_command) buildCmd = project.backend_build_command;
      if (project.backend_start_command) startCmd = project.backend_start_command;

      return { fixApplied: `Fix Render: build="${buildCmd}", start="${startCmd}"`, modifiedBuildCommand: buildCmd, modifiedStartCommand: startCmd, modifiedRootDir: backendDir || undefined, shouldRetry: true };
    }

    case "dependency_error":
      return { fixApplied: "Reinstall with --legacy-peer-deps", modifiedInstallCommand: "npm install --legacy-peer-deps", modifiedBuildCommand: "npm install --legacy-peer-deps && npm run build", shouldRetry: true };

    case "build_error":
      return { fixApplied: "Retry with CI=false", modifiedInstallCommand: "npm install --legacy-peer-deps", modifiedBuildCommand: "CI=false npm run build", modifiedEnvVars: [{ key: "CI", value: "false" }], shouldRetry: true };

    case "port_error":
      return { fixApplied: "Set PORT=3000", modifiedEnvVars: [{ key: "PORT", value: "3000" }], shouldRetry: true };

    case "env_error":
      return { fixApplied: "Inject NODE_ENV=production, PORT=3000", modifiedEnvVars: [{ key: "NODE_ENV", value: "production" }, { key: "PORT", value: "3000" }], shouldRetry: true };

    case "runtime_error":
      return { fixApplied: "Runtime error — retry with clean build", modifiedInstallCommand: "npm install --legacy-peer-deps", modifiedBuildCommand: "CI=false npm run build", modifiedEnvVars: [{ key: "CI", value: "false" }, { key: "NODE_ENV", value: "production" }], shouldRetry: true };

    case "root_directory_error":
      return { fixApplied: `Set rootDirectory to "${analysis?.frontendRootDir || analysis?.backendRootDir || ""}"`, modifiedRootDir: analysis?.frontendRootDir || analysis?.backendRootDir || "", shouldRetry: true };

    case "missing_files_error":
      return { fixApplied: "Re-upload all files", shouldRetry: true };

    case "timeout_error":
      return { fixApplied: "Retry (transient timeout)", shouldRetry: true };

    case "rate_limit_error":
      return { fixApplied: "Wait 60s then retry", shouldRetry: true };

    case "permission_error":
      return { fixApplied: "Permission error — check API token", shouldRetry: false };

    case "unknown_error":
    default: {
      if (errorAnalysis?.extractedDetails?.aiAnalyzed) {
        return {
          fixApplied: `AI fix: ${errorAnalysis.suggestedFix}`,
          modifiedBuildCommand: errorAnalysis.extractedDetails.modifiedBuildCommand || undefined,
          modifiedStartCommand: errorAnalysis.extractedDetails.modifiedStartCommand || undefined,
          modifiedInstallCommand: errorAnalysis.extractedDetails.modifiedInstallCommand || undefined,
          shouldRetry: true,
        };
      }
      return { fixApplied: "Generic retry", shouldRetry: true };
    }
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

function getVercelFrameworkSlug(framework: string): string | null {
  const fw = (framework || "").toLowerCase();
  if (fw.includes("next")) return "nextjs";
  if (fw.includes("vite") || (fw.includes("react") && !fw.includes("next"))) return "vite";
  if (fw.includes("nuxt")) return "nuxtjs";
  if (fw.includes("vue") && !fw.includes("nuxt")) return "vue";
  if (fw.includes("svelte")) return "svelte";
  if (fw.includes("angular")) return "angular";
  if (fw.includes("static")) return null;
  return null;
}

function getVercelOutputDir(framework: string): string {
  const fw = (framework || "").toLowerCase();
  if (fw.includes("next")) return ".next";
  if (fw.includes("nuxt")) return ".output";
  if (fw.includes("svelte") && fw.includes("kit")) return ".svelte-kit";
  if (fw.includes("static")) return ".";
  if (fw.includes("angular")) return "dist";
  return "dist";
}

async function deployToVercel(
  token: string, projectName: string, files: ExtractedFile[], needsBuild: boolean,
  buildCommand: string | null, outputDir: string | null, framework: string | null,
  appendLog: (msg: string, extra?: Record<string, any>) => Promise<void>,
  overrides?: { installCommand?: string; rootDirectory?: string; vercelFramework?: string | null; envVars?: Array<{ key: string; value: string }> }
): Promise<{ deployId: string; liveUrl: string }> {
  await appendLog("Checking Vercel project...");

  const vercelFw = overrides?.vercelFramework ?? getVercelFrameworkSlug(framework || "");
  const effectiveOutputDir = outputDir || getVercelOutputDir(framework || "");

  const checkRes = await safeFetchJson(`https://api.vercel.com/v9/projects/${projectName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (checkRes.status === 404) {
    await appendLog(`Creating Vercel project "${projectName}"...`);
    const createPayload: any = { name: projectName };
    if (overrides?.rootDirectory) createPayload.rootDirectory = overrides.rootDirectory;
    if (vercelFw) createPayload.framework = vercelFw;

    const createRes = await safeFetchJson("https://api.vercel.com/v10/projects", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
    });
    if (!createRes.ok && createRes.data?.error?.code !== "project_already_exists") {
      await appendLog(`Project create warning: ${JSON.stringify(createRes.data)}`);
    }

    if (overrides?.envVars?.length) {
      await safeFetchJson(`https://api.vercel.com/v10/projects/${projectName}/env`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(overrides.envVars.map(e => ({
          key: e.key, value: e.value, target: ["production", "preview", "development"], type: "plain",
        }))),
      });
    }
  }

  // Filter files for rootDirectory
  let deployFiles = files;
  if (overrides?.rootDirectory) {
    const rootDir = overrides.rootDirectory;
    const filtered = files
      .filter(f => f.path.startsWith(rootDir + "/"))
      .map(f => ({ ...f, path: f.path.slice(rootDir.length + 1) }));
    if (filtered.length > 0) {
      deployFiles = filtered;
      await appendLog(`📁 Using ${deployFiles.length} files from "${rootDir}/"`);
    } else {
      await appendLog(`⚠️ No files in "${rootDir}", using all ${files.length} files`);
    }
  }

  await appendLog(`Preparing ${deployFiles.length} files...`, { status: "deploying" });
  const fileShaMap: Map<string, ExtractedFile> = new Map();
  const fileEntries: Array<{ file: string; sha: string; size: number }> = [];
  for (const f of deployFiles) {
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

  const batchSize = 10;
  for (let i = 0; i < deployFiles.length; i += batchSize) {
    await Promise.all(deployFiles.slice(i, i + batchSize).map(async (f) => { await uploadFileBySha(await sha1Hex(f.data)); }));
  }
  await appendLog(`All ${deployFiles.length} files uploaded ✓`);

  const deployPayload: any = {
    name: projectName, project: projectName, files: fileEntries, target: "production",
    projectSettings: {
      buildCommand: needsBuild ? (buildCommand || "npm run build") : null,
      outputDirectory: effectiveOutputDir,
      framework: vercelFw,
      installCommand: overrides?.installCommand || (needsBuild ? "npm install --legacy-peer-deps" : null),
    },
  };

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
      await appendLog(`Re-uploading ${dr.data.error.missing.length} missing files...`);
      for (let i = 0; i < dr.data.error.missing.length; i += batchSize) {
        await Promise.all(dr.data.error.missing.slice(i, i + batchSize).map((sha: string) => uploadFileBySha(sha)));
      }
      continue;
    }
    break;
  }

  if (!dr.ok) {
    // Fallback: try without framework
    if (needsBuild) {
      await appendLog("Build setup failed — retrying with minimal static settings...");
      deployPayload.projectSettings = { buildCommand: null, outputDirectory: ".", framework: null, installCommand: null };
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
    if (sd.readyState === "ERROR" || sd.readyState === "CANCELED") {
      throw new Error(`Build failed: ${sd.errorMessage || sd.readyState}`);
    }
    attempts++;
  }

  return { deployId, liveUrl };
}

function getRenderRuntime(backendRuntime: string): string {
  const r = (backendRuntime || "").toLowerCase();
  if (r === "python") return "python";
  if (r === "go") return "go";
  if (r === "ruby") return "ruby";
  if (r === "docker") return "docker";
  return "node";
}

async function deployToRender(
  token: string, serviceName: string, githubUrl: string | null, files: ExtractedFile[],
  appendLog: (msg: string, extra?: Record<string, any>) => Promise<void>,
  envVars?: Array<{ key: string; value: string }>,
  userStartCommand?: string, userBuildCommand?: string,
  overrides?: { rootDirectory?: string; runtime?: string }
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
    // Detect runtime from files
    let runtime = overrides?.runtime || "node";
    let startCommand = userStartCommand || "npm start";
    let buildCommand = userBuildCommand || "npm install";

    // Auto-detect if not overridden
    if (!userStartCommand || !userBuildCommand) {
      const hasPython = files.some((f) => f.path === "requirements.txt" || f.path === "main.py" || f.path === "app.py");
      const hasGoMod = files.some((f) => f.path === "go.mod");
      const hasDocker = files.some((f) => f.path === "Dockerfile" || f.path === "dockerfile");
      const hasGemfile = files.some((f) => f.path === "Gemfile" || f.path === "gemfile");
      const hasComposerJson = files.some((f) => f.path === "composer.json");

      if (hasPython) {
        runtime = "python";
        if (!userBuildCommand) buildCommand = "pip install -r requirements.txt";
        if (!userStartCommand) startCommand = files.some(f => f.path === "manage.py") ? "python manage.py runserver 0.0.0.0:$PORT" : "python main.py";
      } else if (hasGoMod) {
        runtime = "go";
        if (!userBuildCommand) buildCommand = "go build -o main .";
        if (!userStartCommand) startCommand = "./main";
      } else if (hasDocker) {
        runtime = "docker";
      } else if (hasGemfile) {
        runtime = "ruby";
        if (!userBuildCommand) buildCommand = "bundle install";
        if (!userStartCommand) startCommand = "bundle exec rails server -p $PORT -b 0.0.0.0";
      } else {
        const pkgFile = files.find((f) => f.path === "package.json");
        if (pkgFile) {
          try {
            const pkg = JSON.parse(new TextDecoder().decode(pkgFile.data));
            if (pkg.scripts?.start && !userStartCommand) startCommand = "npm start";
            if (pkg.scripts?.build && !userBuildCommand) buildCommand = "npm install && npm run build";
          } catch {}
        }
      }
    }

    if (!githubUrl) throw new Error("Render deployment requires a GitHub URL.");
    const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Invalid GitHub URL for Render");

    const createPayload: any = {
      type: "web_service", name: serviceName, ownerId,
      repo: `https://github.com/${match[1]}/${match[2].replace(/\.git$/, "")}`,
      autoDeploy: "yes", branch: "main",
      serviceDetails: {
        runtime, plan: "free", region: "oregon",
        ...(runtime !== "docker" ? { envSpecificDetails: { buildCommand, startCommand } } : {}),
      },
    };
    if (overrides?.rootDirectory) createPayload.rootDir = overrides.rootDirectory;
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
  const deployId = deployRes.ok ? (deployRes.data.id || deployRes.data.deploy?.id || serviceId) : serviceId;

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
          let buildLogText = "";
          if (latest.id) {
            const logRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys/${latest.id}/logs`, { headers });
            if (logRes.ok && Array.isArray(logRes.data)) {
              buildLogText = logRes.data.map((l: any) => l.message || JSON.stringify(l)).join("\n").slice(-2000);
              await appendLog(`Build logs:\n${buildLogText.slice(-500)}`);
            }
          }
          throw new Error(`Render deploy failed: ${latest.status}${buildLogText ? ` | Logs: ${buildLogText.slice(-500)}` : ""}`);
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
    await supabase.from("deployments").update({
      status: "error",
      error_message: `Auto-heal exhausted after ${MAX_RETRIES} retries: ${errorMessage}`,
      last_error_category: "exhausted",
    }).eq("id", deploymentId);

    await supabase.from("deployment_alerts").insert({
      deployment_id: deploymentId, project_id: project.id, user_id: dep.user_id,
      alert_type: "autoheal_failed",
      message: `Deployment for "${project.name}" failed after ${MAX_RETRIES} auto-heal attempts. Last error: ${errorMessage.slice(0, 200)}`,
    });

    await appendLog(`❌ All ${MAX_RETRIES} auto-heal retries exhausted. Alert created.`);
    return { healed: false, retryCount: currentRetry, finalStatus: "error" };
  }

  currentRetry++;

  // ── ALWAYS use AI on first attempt for Render errors ──
  // For all retries, use AI analysis to get smarter, context-aware fixes
  let analysis: ErrorAnalysis;
  const isRenderError = errorMessage.toLowerCase().includes("render");

  if (isRenderError || currentRetry >= 1) {
    // Always invoke AI for Render errors — rule-based keeps repeating the same fix
    await appendLog(`🤖 [AUTO-HEAL] Attempt ${currentRetry}/${MAX_RETRIES} — invoking AI error analysis...`);
    analysis = await analyzeErrorWithAI(
      `${errorMessage}\n\nRetry attempt: ${currentRetry}/${MAX_RETRIES}. Previous fix attempts have FAILED — suggest a DIFFERENT approach than just retrying with the same commands.`,
      {
        ...project,
        provider: connection.provider,
        backendRuntime: project.backend_framework?.includes("Python") ? "python" : 
                       project.backend_framework?.includes("Go") ? "go" :
                       project.backend_framework?.includes("Ruby") ? "ruby" : "node",
        retryAttempt: currentRetry,
        previousError: dep.error_message,
      }
    );
    if (analysis.extractedDetails?.aiAnalyzed) {
      await appendLog(`🤖 [AUTO-HEAL] AI Analysis: ${analysis.category} — ${analysis.description}`);
    } else {
      // AI failed, fall back to rule-based but with escalation
      analysis = analyzeError(errorMessage);
      await appendLog(`🔍 [AUTO-HEAL] Rule-based analysis: ${analysis.category} — ${analysis.description}`);
    }
  } else {
    analysis = analyzeError(errorMessage);
  }

  await appendLog(`🔧 [AUTO-HEAL] Suggested Fix: ${analysis.suggestedFix}`);

  await supabase.from("deployment_heal_logs").insert({
    deployment_id: deploymentId, user_id: dep.user_id, attempt_number: currentRetry,
    error_category: analysis.category, error_message: errorMessage.slice(0, 500),
    fix_applied: analysis.suggestedFix, result: "in_progress",
    fix_details: { aiAnalyzed: analysis.extractedDetails?.aiAnalyzed || false, retryAttempt: currentRetry },
  });

  // Re-download source
  let retryFiles: ExtractedFile[] = [];
  try {
    if (project.source_type === "github" && project.github_url) {
      retryFiles = extractZipFilesRaw(await downloadGitHubRepoZip(project.github_url));
    } else if (project.source_type === "zip") {
      const { data: fList } = await supabase.storage.from("project-uploads").list(project.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });
      if (fList?.length > 0) {
        const { data: fd } = await supabase.storage.from("project-uploads").download(`${project.user_id}/${fList[0].name}`);
        if (fd) retryFiles = extractZipFilesRaw(await fd.arrayBuffer());
      }
    }
  } catch {}

  const stackAnalysis = retryFiles.length > 0 ? detectProjectType(retryFiles) : undefined;
  
  // ── Escalation strategy: different fix per retry ──
  let fix: FixAction;
  if (analysis.extractedDetails?.aiAnalyzed) {
    // Use AI-suggested fix directly
    fix = {
      fixApplied: `AI fix (attempt ${currentRetry}): ${analysis.suggestedFix}`,
      modifiedBuildCommand: analysis.extractedDetails.modifiedBuildCommand || undefined,
      modifiedStartCommand: analysis.extractedDetails.modifiedStartCommand || undefined,
      modifiedInstallCommand: analysis.extractedDetails.modifiedInstallCommand || undefined,
      shouldRetry: true,
    };
  } else {
    // Rule-based with escalation
    fix = applyFixWithEscalation(analysis.category, project, stackAnalysis, analysis, currentRetry, retryFiles);
  }

  await appendLog(`🛠️ [AUTO-HEAL] Applying fix: ${fix.fixApplied}`);

  if (!fix.shouldRetry) {
    await appendLog(`❌ [AUTO-HEAL] Cannot auto-fix: ${fix.fixApplied}`);
    await supabase.from("deployment_heal_logs").update({ result: "failed" }).eq("deployment_id", deploymentId).eq("attempt_number", currentRetry);
    return { healed: false, retryCount: currentRetry, finalStatus: "error" };
  }

  const waitSec = currentRetry * 10;
  await supabase.from("deployments").update({ status: "building", retry_count: currentRetry, last_error_category: analysis.category, error_message: null }).eq("id", deploymentId);
  await appendLog(`⏳ [AUTO-HEAL] Retry ${currentRetry}/${MAX_RETRIES} — waiting ${waitSec}s...`);
  await new Promise((r) => setTimeout(r, waitSec * 1000));

  try {
    if (retryFiles.length === 0) throw new Error("No source files for retry");

    const needsBuild = detectBuildNeeded(retryFiles);
    const reAnalysis = stackAnalysis || detectProjectType(retryFiles);
    const sub = dep.live_url
      ? dep.live_url.replace(/^https?:\/\//, "").replace(/\.(vercel\.app|onrender\.com).*$/, "")
      : project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    const effectiveBuildCmd = fix.modifiedBuildCommand || project.build_command || reAnalysis.buildCommand;
    const effectiveOutputDir = fix.modifiedOutputDir || project.output_dir || reAnalysis.outputDir;
    const effectiveFramework = reAnalysis.frontendFramework || project.framework || reAnalysis.framework;
    const effectiveStartCmd = fix.modifiedStartCommand || project.backend_start_command || reAnalysis.backendStartCommand;
    const effectiveEnvVars = fix.modifiedEnvVars || [];
    const effectiveInstallCmd = fix.modifiedInstallCommand || "npm install --legacy-peer-deps";
    const effectiveRootDir = fix.modifiedRootDir || reAnalysis.frontendRootDir || "";

    let result: { deployId: string; liveUrl: string };
    if (connection.provider === "vercel") {
      result = await deployToVercel(
        connection.token, sub, retryFiles, needsBuild,
        effectiveBuildCmd, effectiveOutputDir, effectiveFramework, appendLog,
        { installCommand: effectiveInstallCmd, rootDirectory: effectiveRootDir || undefined, vercelFramework: fix._vercelFramework || undefined, envVars: effectiveEnvVars }
      );
    } else if (connection.provider === "render") {
      // For Render: if existing service, update build/start commands before triggering deploy
      if (dep.deploy_id || dep.live_url) {
        await updateRenderServiceConfig(
          connection.token, dep, appendLog,
          effectiveBuildCmd, effectiveStartCmd, effectiveEnvVars,
          reAnalysis.backendRuntime || "node"
        );
      }
      result = await deployToRender(
        connection.token, sub, project.github_url, retryFiles, appendLog,
        effectiveEnvVars, effectiveStartCmd, effectiveBuildCmd,
        { rootDirectory: fix.modifiedRootDir || reAnalysis.backendRootDir || undefined, runtime: reAnalysis.backendRuntime || undefined }
      );
    } else {
      throw new Error("Unsupported provider");
    }

    await appendLog(`✅ [AUTO-HEAL] Retry ${currentRetry} succeeded!`, { status: "live", live_url: result.liveUrl, deploy_id: result.deployId });
    await supabase.from("projects").update({ status: "live" }).eq("id", project.id);
    await supabase.from("deployment_heal_logs").update({ result: "success" }).eq("deployment_id", deploymentId).eq("attempt_number", currentRetry);
    return { healed: true, retryCount: currentRetry, finalStatus: "live" };

  } catch (retryErr: any) {
    await appendLog(`⚠️ [AUTO-HEAL] Retry ${currentRetry} failed: ${retryErr.message}`);
    await supabase.from("deployment_heal_logs").update({ result: "failed", error_message: retryErr.message.slice(0, 500) }).eq("deployment_id", deploymentId).eq("attempt_number", currentRetry);

    // Recursive retry with accumulated error context
    await supabase.from("deployments").update({ retry_count: currentRetry, error_message: retryErr.message }).eq("id", deploymentId);
    return runAutoHeal(supabase, deploymentId, retryErr.message, appendLog);
  }
}

// ── Update Render service build/start commands before retry ──
async function updateRenderServiceConfig(
  token: string, dep: any, appendLog: (msg: string) => Promise<void>,
  buildCommand: string, startCommand: string, envVars: Array<{ key: string; value: string }>,
  runtime: string
): Promise<void> {
  const RENDER_API = "https://api.render.com/v1";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  let serviceId = dep.deploy_id;
  if (!serviceId && dep.live_url) {
    const svcName = dep.live_url.replace(/^https?:\/\//, "").replace(/\.onrender\.com.*$/, "");
    const listRes = await safeFetchJson(`${RENDER_API}/services?name=${encodeURIComponent(svcName)}&limit=1`, { headers });
    if (listRes.ok && listRes.data?.length > 0) serviceId = listRes.data[0].service?.id;
  }
  if (!serviceId) return;

  // Update service configuration with corrected commands
  const updatePayload: any = {
    serviceDetails: {
      envSpecificDetails: {
        buildCommand,
        startCommand,
      },
    },
  };

  await appendLog(`🔧 [AUTO-HEAL] Updating Render service config: build="${buildCommand}", start="${startCommand}"`);
  const updateRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}`, {
    method: "PATCH", headers, body: JSON.stringify(updatePayload),
  });

  if (!updateRes.ok) {
    await appendLog(`⚠️ Service config update warning: ${JSON.stringify(updateRes.data)}`);
  }

  // Update env vars if provided
  if (envVars?.length) {
    await safeFetchJson(`${RENDER_API}/services/${serviceId}/env-vars`, {
      method: "PUT", headers, body: JSON.stringify(envVars.map((e) => ({ key: e.key, value: e.value }))),
    });
  }
}

// ── Escalating fix strategy per retry attempt ──
function applyFixWithEscalation(
  category: ErrorCategory, project: any, analysis: StackAnalysis | undefined,
  errorAnalysis: ErrorAnalysis, retryAttempt: number, files: ExtractedFile[]
): FixAction {
  // For Render build errors, escalate strategies across retries
  if (category === "render_build_error") {
    const backendDir = analysis?.backendRootDir || "";
    const bf = (analysis?.backendFramework || "").toLowerCase();
    const isPython = bf.includes("python") || bf.includes("django") || bf.includes("flask") || bf.includes("fastapi");
    const isGo = bf.includes("go");
    const isRuby = bf.includes("ruby");

    if (retryAttempt === 1) {
      // Attempt 1: Smart detection — inspect actual package.json for scripts
      let buildCmd = "npm install";
      let startCmd = "npm start";

      if (isPython) {
        buildCmd = backendDir ? `cd ${backendDir} && pip install -r requirements.txt` : "pip install -r requirements.txt";
        if (bf.includes("django")) startCmd = backendDir ? `cd ${backendDir} && python manage.py runserver 0.0.0.0:$PORT` : "python manage.py runserver 0.0.0.0:$PORT";
        else if (bf.includes("fastapi")) startCmd = backendDir ? `cd ${backendDir} && uvicorn main:app --host 0.0.0.0 --port $PORT` : "uvicorn main:app --host 0.0.0.0 --port $PORT";
        else startCmd = backendDir ? `cd ${backendDir} && python app.py` : "python app.py";
      } else if (isGo) {
        buildCmd = backendDir ? `cd ${backendDir} && go build -o main .` : "go build -o main .";
        startCmd = backendDir ? `cd ${backendDir} && ./main` : "./main";
      } else if (isRuby) {
        buildCmd = backendDir ? `cd ${backendDir} && bundle install` : "bundle install";
        startCmd = backendDir ? `cd ${backendDir} && bundle exec rails server -p $PORT` : "bundle exec rails server -p $PORT";
      } else {
        // Node.js: inspect package.json in backend dir for actual entry point
        const pkgPath = backendDir ? `${backendDir}/package.json` : "package.json";
        const pkgText = readFileText(files, pkgPath);
        let entryPoint = "server.js";
        let hasStartScript = false;
        let hasBuildScript = false;

        if (pkgText) {
          try {
            const pkg = JSON.parse(pkgText);
            hasStartScript = !!pkg.scripts?.start;
            hasBuildScript = !!pkg.scripts?.build;
            // Check main field
            if (pkg.main) entryPoint = pkg.main;
            // Check for common entry files
            const allPaths = files.map(f => f.path.toLowerCase());
            for (const candidate of ["index.js", "app.js", "server.js", "index.ts", "app.ts", "server.ts"]) {
              const checkPath = backendDir ? `${backendDir}/${candidate}` : candidate;
              if (allPaths.includes(checkPath.toLowerCase())) {
                entryPoint = candidate;
                break;
              }
            }
          } catch {}
        }

        buildCmd = backendDir 
          ? `cd ${backendDir} && npm install --legacy-peer-deps${hasBuildScript ? " && npm run build" : ""}`
          : `npm install --legacy-peer-deps${hasBuildScript ? " && npm run build" : ""}`;
        startCmd = hasStartScript
          ? (backendDir ? `cd ${backendDir} && npm start` : "npm start")
          : (backendDir ? `cd ${backendDir} && node ${entryPoint}` : `node ${entryPoint}`);
      }

      return {
        fixApplied: `Attempt 1: Smart detection — build="${buildCmd}", start="${startCmd}"`,
        modifiedBuildCommand: buildCmd,
        modifiedStartCommand: startCmd,
        modifiedEnvVars: [{ key: "NODE_ENV", value: "production" }, { key: "PORT", value: "10000" }],
        shouldRetry: true,
      };
    }

    if (retryAttempt === 2) {
      // Attempt 2: Try with yarn instead of npm, or different entry points
      let buildCmd: string;
      let startCmd: string;

      if (isPython || isGo || isRuby) {
        // For non-Node: try with clear cache
        buildCmd = isPython
          ? (backendDir ? `cd ${backendDir} && pip install --no-cache-dir -r requirements.txt` : "pip install --no-cache-dir -r requirements.txt")
          : isGo
          ? (backendDir ? `cd ${backendDir} && CGO_ENABLED=0 go build -o main .` : "CGO_ENABLED=0 go build -o main .")
          : (backendDir ? `cd ${backendDir} && bundle install --clean` : "bundle install --clean");
        startCmd = isPython
          ? (bf.includes("django") ? "gunicorn --bind 0.0.0.0:$PORT config.wsgi:application" : bf.includes("fastapi") ? "uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1" : "python app.py")
          : isGo ? "./main" : "bundle exec puma -p $PORT";
        if (backendDir && !isPython) startCmd = `cd ${backendDir} && ${startCmd}`;
      } else {
        // Node: try yarn, try different entry points
        const allPaths = files.map(f => f.path.toLowerCase());
        const hasYarnLock = allPaths.some(p => p.endsWith("yarn.lock") || (backendDir && p === `${backendDir}/yarn.lock`.toLowerCase()));
        
        if (hasYarnLock) {
          buildCmd = backendDir ? `cd ${backendDir} && yarn install` : "yarn install";
          startCmd = backendDir ? `cd ${backendDir} && yarn start` : "yarn start";
        } else {
          // Try with Node 18 specific flags and different entry
          buildCmd = backendDir
            ? `cd ${backendDir} && npm ci --legacy-peer-deps || npm install --legacy-peer-deps`
            : "npm ci --legacy-peer-deps || npm install --legacy-peer-deps";

          // Find actual entry files
          const entryFiles = ["src/index.js", "src/server.js", "src/app.js", "index.js", "app.js", "server.js", "dist/index.js"];
          let foundEntry = "server.js";
          for (const ef of entryFiles) {
            const checkPath = backendDir ? `${backendDir}/${ef}` : ef;
            if (allPaths.includes(checkPath.toLowerCase())) {
              foundEntry = ef;
              break;
            }
          }
          startCmd = backendDir ? `cd ${backendDir} && node ${foundEntry}` : `node ${foundEntry}`;
        }
      }

      return {
        fixApplied: `Attempt 2: Alternative commands — build="${buildCmd}", start="${startCmd}"`,
        modifiedBuildCommand: buildCmd,
        modifiedStartCommand: startCmd,
        modifiedEnvVars: [{ key: "NODE_ENV", value: "production" }, { key: "PORT", value: "10000" }, { key: "NPM_CONFIG_PRODUCTION", value: "false" }],
        shouldRetry: true,
      };
    }

    if (retryAttempt >= 3) {
      // Attempt 3: Nuclear option — minimal setup, clear cache
      let buildCmd = backendDir ? `cd ${backendDir} && rm -rf node_modules && npm install --legacy-peer-deps` : "rm -rf node_modules && npm install --legacy-peer-deps";
      let startCmd = backendDir ? `cd ${backendDir} && node .` : "node .";

      if (isPython) {
        buildCmd = backendDir ? `cd ${backendDir} && pip install -r requirements.txt 2>&1 || true` : "pip install -r requirements.txt 2>&1 || true";
        startCmd = backendDir ? `cd ${backendDir} && python -m flask run --host=0.0.0.0 --port=$PORT || python app.py || python main.py` : "python -m flask run --host=0.0.0.0 --port=$PORT || python app.py || python main.py";
      }

      return {
        fixApplied: `Attempt 3: Nuclear rebuild — clean + fallback entry — build="${buildCmd}", start="${startCmd}"`,
        modifiedBuildCommand: buildCmd,
        modifiedStartCommand: startCmd,
        modifiedEnvVars: [{ key: "NODE_ENV", value: "production" }, { key: "PORT", value: "10000" }, { key: "NPM_CONFIG_PRODUCTION", value: "false" }, { key: "CI", value: "false" }],
        shouldRetry: true,
      };
    }
  }

  // For non-render errors, use the standard fix engine
  return applyFix(category, project, analysis, errorAnalysis);
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
      const { data: healLogs } = await supabase.from("deployment_heal_logs").select("*").eq("deployment_id", depId).order("attempt_number", { ascending: true });
      const { data: alerts } = await supabase.from("deployment_alerts").select("*").eq("deployment_id", depId).order("created_at", { ascending: false }).limit(5);
      return json({
        success: true, deploymentId: depId, status: dep.status,
        retryCount: dep.retry_count || 0, maxRetries: dep.max_retries || 3,
        lastErrorCategory: dep.last_error_category, errorMessage: dep.error_message,
        healLogs: healLogs || [], alerts: alerts || [],
      });
    }

    // ── Manually trigger autoheal ──
    if (action === "trigger-autoheal") {
      const { deploymentId: depId } = body;
      if (!depId) throw new Error("Missing deploymentId");
      const { data: dep } = await supabase.from("deployments").select("*").eq("id", depId).single();
      if (!dep) throw new Error("Deployment not found");
      if (dep.status !== "error") return json({ success: false, error: "Deployment is not in error state" });
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

    // ── Fetch service logs (Render + Vercel) ──
    if (action === "fetch-logs") {
      const { deploymentId: depId } = body;
      if (!depId) throw new Error("Missing deploymentId");
      const { data: dep } = await supabase.from("deployments").select("*, cloud_connections(*)").eq("id", depId).single();
      if (!dep) throw new Error("Deployment not found");
      const connection = (dep as any).cloud_connections;
      if (!connection) throw new Error("Connection not found");

      let deployLogs: any[] = [];
      let serviceInfo: any = null;
      let envKeys: any[] = [];

      if (connection.provider === "render") {
        const RENDER_API = "https://api.render.com/v1";
        const hdrs = { Authorization: `Bearer ${connection.token}`, "Content-Type": "application/json" };
        let serviceId = dep.deploy_id;
        if (!serviceId && dep.live_url) {
          const svcName = dep.live_url.replace(/^https?:\/\//, "").replace(/\.onrender\.com.*$/, "");
          const listRes = await safeFetchJson(`${RENDER_API}/services?name=${encodeURIComponent(svcName)}&limit=1`, { headers: hdrs });
          if (listRes.ok && listRes.data?.length > 0) serviceId = listRes.data[0].service?.id;
        }
        if (serviceId) {
          const svcRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}`, { headers: hdrs });
          if (svcRes.ok) {
            const svc = svcRes.data?.service || svcRes.data;
            serviceInfo = { id: svc.id, name: svc.name, status: svc.suspended === "suspended" ? "suspended" : "active", type: svc.type || "web_service", runtime: svc.serviceDetails?.runtime || "node", plan: svc.serviceDetails?.plan || "free", region: svc.serviceDetails?.region || "oregon", createdAt: svc.createdAt, updatedAt: svc.updatedAt };
          }
          const envRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/env-vars`, { headers: hdrs });
          if (envRes.ok && Array.isArray(envRes.data)) envKeys = envRes.data.map((e: any) => ({ key: e.envVar?.key || e.key || "unknown" }));
          const deploysRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys?limit=1`, { headers: hdrs });
          if (deploysRes.ok && deploysRes.data?.length > 0) {
            const latestId = deploysRes.data[0]?.deploy?.id || deploysRes.data[0]?.id;
            if (latestId) {
              const logRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys/${latestId}/logs`, { headers: hdrs });
              if (logRes.ok && Array.isArray(logRes.data)) deployLogs = logRes.data.map((l: any) => ({ timestamp: l.timestamp || new Date().toISOString(), message: l.message || JSON.stringify(l), level: l.level || "info" }));
            }
          }
        }
      } else if (connection.provider === "vercel") {
        const vHeaders = { Authorization: `Bearer ${connection.token}` };
        if (dep.deploy_id) {
          const depRes = await safeFetchJson(`https://api.vercel.com/v13/deployments/${dep.deploy_id}`, { headers: vHeaders });
          if (depRes.ok) {
            const d = depRes.data;
            serviceInfo = { id: d.id, name: d.name || d.project, status: d.readyState || "unknown", type: "deployment", runtime: d.framework || "static", plan: "hobby", region: d.regions?.join(", ") || "auto", createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null, updatedAt: d.ready ? new Date(d.ready).toISOString() : null };
          }
          const evtRes = await safeFetchJson(`https://api.vercel.com/v3/deployments/${dep.deploy_id}/events`, { headers: vHeaders });
          if (evtRes.ok && Array.isArray(evtRes.data)) deployLogs = evtRes.data.slice(-100).map((e: any) => ({ timestamp: e.created ? new Date(e.created).toISOString() : new Date().toISOString(), message: e.text || e.payload?.text || JSON.stringify(e.payload || e), level: e.type === "error" ? "error" : e.type === "warning" ? "warning" : "info" }));
        }
        const projName = dep.live_url?.replace(/^https?:\/\//, "").replace(/\.vercel\.app.*$/, "") || "";
        if (projName) {
          const envRes = await safeFetchJson(`https://api.vercel.com/v10/projects/${projName}/env`, { headers: vHeaders });
          if (envRes.ok && Array.isArray(envRes.data?.envs)) envKeys = envRes.data.envs.map((e: any) => ({ key: e.key }));
        }
      }
      return json({ success: true, serviceInfo, logs: deployLogs, envKeys });
    }

    // ── Fetch health + deploy history ──
    if (action === "fetch-health") {
      const { deploymentId: depId } = body;
      if (!depId) throw new Error("Missing deploymentId");
      const { data: dep } = await supabase.from("deployments").select("*, cloud_connections(*)").eq("id", depId).single();
      if (!dep) throw new Error("Deployment not found");
      const connection = (dep as any).cloud_connections;
      let healthCheck = { reachable: false, statusCode: 0, responseTime: 0, error: "" };
      if (dep.live_url) {
        const start = Date.now();
        try { const hRes = await fetch(dep.live_url, { signal: AbortSignal.timeout(15000) }); healthCheck = { reachable: hRes.ok, statusCode: hRes.status, responseTime: Date.now() - start, error: hRes.ok ? "" : `HTTP ${hRes.status}` }; } catch (e: any) { healthCheck = { reachable: false, statusCode: 0, responseTime: Date.now() - start, error: e.message }; }
      }
      let deployHistory: any[] = [];
      if (connection) {
        if (connection.provider === "render") {
          const RENDER_API = "https://api.render.com/v1"; const hdrs = { Authorization: `Bearer ${connection.token}`, "Content-Type": "application/json" };
          let serviceId = dep.deploy_id;
          if (!serviceId && dep.live_url) { const svcName = dep.live_url.replace(/^https?:\/\//, "").replace(/\.onrender\.com.*$/, ""); const listRes = await safeFetchJson(`${RENDER_API}/services?name=${encodeURIComponent(svcName)}&limit=1`, { headers: hdrs }); if (listRes.ok && listRes.data?.length > 0) serviceId = listRes.data[0].service?.id; }
          if (serviceId) { const histRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys?limit=10`, { headers: hdrs }); if (histRes.ok && Array.isArray(histRes.data)) deployHistory = histRes.data.map((d: any) => { const deploy = d.deploy || d; return { id: deploy.id, status: deploy.status, createdAt: deploy.createdAt, finishedAt: deploy.finishedAt, commit: deploy.commit?.message || "" }; }); }
        } else if (connection.provider === "vercel") {
          const vHeaders = { Authorization: `Bearer ${connection.token}` }; const projName = dep.live_url?.replace(/^https?:\/\//, "").replace(/\.vercel\.app.*$/, "") || "";
          if (projName) { const histRes = await safeFetchJson(`https://api.vercel.com/v6/deployments?projectId=${projName}&limit=10`, { headers: vHeaders }); if (histRes.ok && Array.isArray(histRes.data?.deployments)) deployHistory = histRes.data.deployments.map((d: any) => ({ id: d.uid, status: d.readyState === "READY" ? "live" : d.readyState?.toLowerCase() || "unknown", createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : "", finishedAt: d.ready ? new Date(d.ready).toISOString() : "", commit: d.meta?.githubCommitMessage || "" })); }
        }
      }
      return json({ success: true, healthCheck, deployHistory });
    }

    // ── Fetch provider info for a connection ──
    if (action === "fetch-provider-info") {
      const { connectionId } = body;
      if (!connectionId) throw new Error("Missing connectionId");
      const { data: conn } = await supabase.from("cloud_connections").select("*").eq("id", connectionId).single();
      if (!conn) throw new Error("Connection not found");
      let providerInfo: any = { projects: [], user: null };
      if (conn.provider === "vercel") {
        const vHeaders = { Authorization: `Bearer ${conn.token}` };
        const userRes = await safeFetchJson("https://api.vercel.com/v2/user", { headers: vHeaders });
        if (userRes.ok) providerInfo.user = { username: userRes.data.user?.username || userRes.data.username, email: userRes.data.user?.email || userRes.data.email, name: userRes.data.user?.name || userRes.data.name };
        const projRes = await safeFetchJson("https://api.vercel.com/v9/projects?limit=20", { headers: vHeaders });
        if (projRes.ok && Array.isArray(projRes.data?.projects)) providerInfo.projects = projRes.data.projects.map((p: any) => ({ id: p.id, name: p.name, framework: p.framework, createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null, updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null, url: p.latestDeployments?.[0]?.url ? `https://${p.latestDeployments[0].url}` : null, state: p.latestDeployments?.[0]?.readyState || null }));
      } else if (conn.provider === "render") {
        const RENDER_API = "https://api.render.com/v1"; const hdrs = { Authorization: `Bearer ${conn.token}`, "Content-Type": "application/json" };
        const ownerRes = await safeFetchJson(`${RENDER_API}/owners`, { headers: hdrs });
        if (ownerRes.ok && ownerRes.data?.length > 0) { const owner = ownerRes.data[0]?.owner || ownerRes.data[0]; providerInfo.user = { username: owner.name || owner.id, email: owner.email || "", name: owner.name }; }
        const svcRes = await safeFetchJson(`${RENDER_API}/services?limit=20`, { headers: hdrs });
        if (svcRes.ok && Array.isArray(svcRes.data)) providerInfo.projects = svcRes.data.map((s: any) => { const svc = s.service || s; return { id: svc.id, name: svc.name, type: svc.type, runtime: svc.serviceDetails?.runtime || "node", plan: svc.serviceDetails?.plan || "free", region: svc.serviceDetails?.region || "oregon", status: svc.suspended === "suspended" ? "suspended" : "active", createdAt: svc.createdAt, updatedAt: svc.updatedAt, url: svc.serviceDetails?.url ? `https://${svc.serviceDetails.url}` : null }; });
      }
      return json({ success: true, providerInfo });
    }

    // ── Fetch billing info ──
    if (action === "fetch-billing") {
      const { connectionId } = body;
      if (!connectionId) throw new Error("Missing connectionId");
      const { data: conn } = await supabase.from("cloud_connections").select("*").eq("id", connectionId).single();
      if (!conn) throw new Error("Connection not found");
      let billing: any = { plan: "free", usage: [], summary: null };
      if (conn.provider === "vercel") {
        const vHeaders = { Authorization: `Bearer ${conn.token}` };
        const userRes = await safeFetchJson("https://api.vercel.com/v2/user", { headers: vHeaders });
        if (userRes.ok) { const u = userRes.data.user || userRes.data; billing.plan = u.billing?.plan || "hobby"; billing.summary = { plan: billing.plan, period: "current", projectCount: 0, bandwidthUsed: "Check Vercel dashboard", buildMinutes: "Check Vercel dashboard" }; }
        const projRes = await safeFetchJson("https://api.vercel.com/v9/projects?limit=100", { headers: vHeaders });
        if (projRes.ok && billing.summary) billing.summary.projectCount = projRes.data?.projects?.length || 0;
      } else if (conn.provider === "render") {
        const RENDER_API = "https://api.render.com/v1"; const hdrs = { Authorization: `Bearer ${conn.token}`, "Content-Type": "application/json" };
        const svcRes = await safeFetchJson(`${RENDER_API}/services?limit=100`, { headers: hdrs });
        const services = svcRes.ok ? (svcRes.data || []) : [];
        let freeCount = 0, paidCount = 0;
        const usage = services.map((s: any) => { const svc = s.service || s; const plan = svc.serviceDetails?.plan || "free"; if (plan === "free") freeCount++; else paidCount++; return { name: svc.name, type: svc.type, plan, status: svc.suspended === "suspended" ? "suspended" : "active" }; });
        billing.plan = paidCount > 0 ? "paid" : "free"; billing.usage = usage;
        billing.summary = { plan: billing.plan, period: "current", serviceCount: services.length, freeServices: freeCount, paidServices: paidCount, note: "Free tier: 750 hrs/month, 100 GB bandwidth." };
      }
      return json({ success: true, billing });
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
      const hdrs = { Authorization: `Bearer ${connection.token}`, "Content-Type": "application/json" };
      let serviceId = dep.deploy_id;
      if (!serviceId && dep.live_url) {
        const svcName = dep.live_url.replace(/^https?:\/\//, "").replace(/\.onrender\.com.*$/, "");
        const listRes = await safeFetchJson(`${RENDER_API}/services?name=${encodeURIComponent(svcName)}&limit=1`, { headers: hdrs });
        if (listRes.ok && listRes.data?.length > 0) serviceId = listRes.data[0].service?.id;
      }
      if (!serviceId) throw new Error("Could not find Render service ID");
      const envRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/env-vars`, {
        method: "PUT", headers: hdrs, body: JSON.stringify(envVars.map((e: any) => ({ key: e.key, value: e.value }))),
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

      const stackAnalysis = detectProjectType(extractedFiles);
      const fileSummary = extractedFiles.map((f) => f.path).sort();
      const directories = [...new Set(fileSummary.map((f) => f.split("/")[0]))];

      await supabase.from("projects").update({
        status: "ready",
        framework: stackAnalysis.framework,
        project_type: stackAnalysis.deploymentType,
        build_command: stackAnalysis.buildCommand || "npm run build",
        output_dir: stackAnalysis.outputDir || "dist",
        frontend_framework: stackAnalysis.frontendFramework || null,
        frontend_build_command: stackAnalysis.frontendBuildCommand || null,
        frontend_output_dir: stackAnalysis.frontendOutputDir || null,
        backend_framework: stackAnalysis.backendFramework || null,
        backend_build_command: stackAnalysis.backendBuildCommand || null,
        backend_start_command: stackAnalysis.backendStartCommand || null,
      }).eq("id", analyzeProjectId);

      return json({
        success: true, projectType: stackAnalysis.deploymentType,
        framework: stackAnalysis.framework,
        hasFrontend: stackAnalysis.hasFrontend, hasBackend: stackAnalysis.hasBackend,
        frontendFramework: stackAnalysis.frontendFramework, backendFramework: stackAnalysis.backendFramework,
        frontendRootDir: stackAnalysis.frontendRootDir, backendRootDir: stackAnalysis.backendRootDir,
        backendStartCommand: stackAnalysis.backendStartCommand, backendRuntime: stackAnalysis.backendRuntime,
        needsUserInput: stackAnalysis.needsUserInput, missingInfo: stackAnalysis.missingInfo,
        detectedFiles: stackAnalysis.detectedFiles, detectionRules: stackAnalysis.detectionRules,
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
      const stackAnalysis = detectProjectType(extractedFiles);
      const sub = dep.live_url
        ? dep.live_url.replace(/^https?:\/\//, "").replace(/\.(vercel\.app|onrender\.com).*$/, "")
        : project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

      let result: { deployId: string; liveUrl: string };
      if (connection.provider === "vercel") {
        result = await deployToVercel(
          connection.token, sub, extractedFiles, needsBuild,
          project.build_command || stackAnalysis.frontendBuildCommand,
          project.output_dir || stackAnalysis.frontendOutputDir,
          project.framework || stackAnalysis.frontendFramework,
          appendLog,
          { rootDirectory: stackAnalysis.frontendRootDir || undefined, installCommand: "npm install --legacy-peer-deps" }
        );
      } else {
        result = await deployToRender(
          connection.token, sub, project.github_url, extractedFiles, appendLog,
          undefined,
          project.backend_start_command || stackAnalysis.backendStartCommand,
          project.backend_build_command || stackAnalysis.backendBuildCommand,
          { rootDirectory: stackAnalysis.backendRootDir || undefined, runtime: stackAnalysis.backendRuntime || undefined }
        );
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
      const { data: fileData, error: dlErr } = await supabase.storage.from("project-uploads").download(`${project.user_id}/${fileList[0].name}`);
      if (dlErr || !fileData) throw new Error(`Download failed: ${dlErr?.message}`);
      extractedFiles = extractZipFilesRaw(await fileData.arrayBuffer());
    } else {
      throw new Error(`Unsupported source type: ${project.source_type}`);
    }

    await appendLog(`Extracted ${extractedFiles.length} files`);

    const needsBuild = detectBuildNeeded(extractedFiles);
    const projectAnalysis = detectProjectType(extractedFiles);

    // Log detection rules
    for (const rule of projectAnalysis.detectionRules) {
      await appendLog(`🔎 Detection: [${rule.name}] ${rule.trigger}`);
    }

    await appendLog(`Analysis: type=${projectAnalysis.deploymentType}, frontend=${projectAnalysis.hasFrontend} (${projectAnalysis.frontendFramework || "none"}), backend=${projectAnalysis.hasBackend} (${projectAnalysis.backendFramework || "none"})`);

    if (projectAnalysis.deploymentType === "fullstack") {
      await appendLog(`📁 Fullstack: frontend="${projectAnalysis.frontendRootDir || "root"}", backend="${projectAnalysis.backendRootDir || "root"}", runtime=${projectAnalysis.backendRuntime}`);
    }

    // ── Fullstack: deploy backend first, then frontend with backend URL ──
    if (projectAnalysis.deploymentType === "fullstack" && provider === "vercel") {
      // Check if user has a Render connection for backend
      const { data: allConns } = await supabase.from("cloud_connections").select("*").eq("user_id", project.user_id).eq("provider", "render");
      const renderConn = allConns?.[0];

      if (renderConn && project.github_url) {
        await appendLog("🚀 Fullstack deploy: deploying backend to Render first...");

        const backendSubdomain = `${desiredSubdomain}-api`;
        const backendStartCmd = customStartCommand || project.backend_start_command || projectAnalysis.backendStartCommand;
        const backendBuildCmd = project.backend_build_command || projectAnalysis.backendBuildCommand;

        try {
          const backendResult = await deployToRender(
            renderConn.token, backendSubdomain, project.github_url, extractedFiles, appendLog,
            bodyEnvVars, backendStartCmd, backendBuildCmd,
            { rootDirectory: projectAnalysis.backendRootDir || undefined, runtime: projectAnalysis.backendRuntime || undefined }
          );

          await appendLog(`✅ Backend deployed: ${backendResult.liveUrl}`);

          // Inject backend URL as env var for frontend
          const frontendEnvVars = [
            ...(bodyEnvVars || []),
            { key: "VITE_API_URL", value: backendResult.liveUrl },
            { key: "REACT_APP_API_URL", value: backendResult.liveUrl },
            { key: "NEXT_PUBLIC_API_URL", value: backendResult.liveUrl },
          ];

          await appendLog("🚀 Now deploying frontend to Vercel...");
          const frontendBuildCmd = customBuildCommand || project.frontend_build_command || project.build_command || projectAnalysis.frontendBuildCommand;
          const frontendOutDir = project.frontend_output_dir || project.output_dir || projectAnalysis.frontendOutputDir;
          const frontendFw = project.frontend_framework || project.framework || projectAnalysis.frontendFramework;

          const frontendResult = await deployToVercel(
            token, desiredSubdomain, extractedFiles, needsBuild, frontendBuildCmd, frontendOutDir, frontendFw, appendLog,
            { installCommand: "npm install --legacy-peer-deps", rootDirectory: projectAnalysis.frontendRootDir || undefined, envVars: frontendEnvVars }
          );

          await appendLog("Fullstack deployment successful! ✅", {
            status: "live", live_url: frontendResult.liveUrl, deploy_id: frontendResult.deployId,
          });
          await supabase.from("projects").update({ status: "live" }).eq("id", projectId);
          return json({
            success: true,
            url: frontendResult.liveUrl,
            deployment_type: "fullstack",
            frontend_url: frontendResult.liveUrl,
            backend_url: backendResult.liveUrl,
            detected_stack: `${projectAnalysis.frontendFramework} + ${projectAnalysis.backendFramework}`,
          });
        } catch (backendErr: any) {
          await appendLog(`⚠️ Backend deploy failed: ${backendErr.message}. Deploying frontend only...`);
          // Fall through to regular frontend deploy
        }
      }
    }

    // ── Single-target deploy ──
    let result: { deployId: string; liveUrl: string };
    if (provider === "vercel") {
      const rootDir = projectAnalysis.frontendRootDir || undefined;
      const buildCmd = customBuildCommand || project.frontend_build_command || project.build_command || projectAnalysis.frontendBuildCommand;
      const outDir = project.frontend_output_dir || project.output_dir || projectAnalysis.frontendOutputDir;
      const fw = project.frontend_framework || project.framework || projectAnalysis.frontendFramework;

      result = await deployToVercel(
        token, desiredSubdomain, extractedFiles, needsBuild, buildCmd, outDir, fw, appendLog,
        { installCommand: "npm install --legacy-peer-deps", rootDirectory: rootDir, envVars: bodyEnvVars }
      );
    } else if (provider === "render") {
      const rootDir = projectAnalysis.backendRootDir || undefined;
      const startCmd = customStartCommand || project.backend_start_command || projectAnalysis.backendStartCommand;
      const buildCmd = customBuildCommand || project.backend_build_command || projectAnalysis.backendBuildCommand;

      result = await deployToRender(
        token, desiredSubdomain, project.github_url, extractedFiles, appendLog,
        bodyEnvVars, startCmd, buildCmd,
        { rootDirectory: rootDir, runtime: projectAnalysis.backendRuntime || undefined }
      );
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    await appendLog("Deployment successful! ✅", { status: "live", live_url: result.liveUrl, deploy_id: result.deployId });
    await supabase.from("projects").update({ status: "live" }).eq("id", projectId);

    return json({
      success: true,
      url: result.liveUrl,
      project_name: project.name,
      detected_stack: projectAnalysis.framework,
      deployment_type: projectAnalysis.deploymentType,
      frontend_url: provider === "vercel" ? result.liveUrl : null,
      backend_url: provider === "render" ? result.liveUrl : null,
      status: "live",
    });

  } catch (error: any) {
    console.error("Deployment error:", error);
    if (deploymentId) {
      const ts = new Date().toISOString().slice(11, 19);
      const { data: cur } = await supabase.from("deployments").select("logs").eq("id", deploymentId).single();
      await supabase.from("deployments").update({
        logs: (cur?.logs || "") + `[${ts}] ❌ ERROR: ${error.message}\n[${ts}] 🔄 Starting auto-heal...\n`,
        error_message: error.message,
      }).eq("id", deploymentId);

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

      const { data: finalCur } = await supabase.from("deployments").select("logs").eq("id", deploymentId).single();
      await supabase.from("deployments").update({
        status: "error", error_message: error.message,
        logs: (finalCur?.logs || "") + `[${ts}] ❌ Auto-heal could not resolve the issue.\n`,
      }).eq("id", deploymentId);
    }
    return json({ success: false, error: error.message }, 500);
  }
});
