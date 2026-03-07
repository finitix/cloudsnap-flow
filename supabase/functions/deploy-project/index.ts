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

// Safe JSON fetch — handles non-JSON responses gracefully
async function safeFetchJson(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";
  let data: any;
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      const text = await res.text();
      data = { _rawText: text || "(empty response)" };
    }
  } else {
    const text = await res.text();
    data = { _rawText: text || "(empty response)" };
  }
  return { ok: res.ok, status: res.status, data };
}

// Vercel uses SHA-1 for file digests, NOT SHA-256
async function sha1Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface ExtractedFile {
  path: string;
  data: Uint8Array;
}

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
}

function detectProjectType(files: ExtractedFile[]): StackAnalysis {
  const fileNames = files.map((f) => f.path.toLowerCase());
  const hasPackageJson = fileNames.includes("package.json");
  const hasIndexHtml = fileNames.includes("index.html");
  const hasTsx = fileNames.some((f) => f.endsWith(".tsx") || f.endsWith(".jsx"));
  const hasVue = fileNames.some((f) => f.endsWith(".vue"));
  const hasPython = fileNames.some((f) => f === "requirements.txt" || f === "main.py" || f === "app.py" || f === "manage.py");
  const hasGo = fileNames.includes("go.mod");
  const hasRuby = fileNames.includes("gemfile");
  const hasDocker = fileNames.includes("dockerfile");
  const hasProcfile = fileNames.includes("procfile");
  const hasServerFile = fileNames.some((f) => f === "server.js" || f === "server.ts" || f === "app.js" || f === "app.ts");
  const hasNextConfig = fileNames.some((f) => f === "next.config.js" || f === "next.config.mjs" || f === "next.config.ts");
  const hasViteConfig = fileNames.some((f) => f === "vite.config.ts" || f === "vite.config.js");

  const hasFrontend = hasIndexHtml || hasTsx || hasVue || hasViteConfig;
  const hasBackend = hasPython || hasGo || hasRuby || hasDocker || hasProcfile || hasServerFile || hasNextConfig;

  // Detect frontend stack
  let frontendFramework = "Unknown";
  let frontendBuildCommand = "npm run build";
  let frontendOutputDir = "dist";

  if (hasViteConfig && hasTsx) { frontendFramework = "React (Vite)"; }
  else if (hasTsx) { frontendFramework = "React"; }
  else if (hasVue) { frontendFramework = "Vue"; }
  else if (hasIndexHtml) { frontendFramework = "Static HTML"; frontendBuildCommand = ""; frontendOutputDir = "."; }

  // Detect backend stack
  let backendFramework = "Unknown";
  let backendBuildCommand = "npm install";
  let backendStartCommand = "npm start";

  if (hasNextConfig) {
    backendFramework = "Next.js"; backendBuildCommand = "npm run build"; backendStartCommand = "npm start";
    frontendFramework = "Next.js"; frontendOutputDir = ".next";
  } else if (hasPython) {
    backendFramework = "Python"; backendBuildCommand = "pip install -r requirements.txt";
    backendStartCommand = fileNames.includes("manage.py") ? "python manage.py runserver 0.0.0.0:$PORT" : "python main.py";
  } else if (hasGo) {
    backendFramework = "Go"; backendBuildCommand = "go build -o main ."; backendStartCommand = "./main";
  } else if (hasRuby) {
    backendFramework = "Ruby"; backendBuildCommand = "bundle install"; backendStartCommand = "bundle exec rails server -p $PORT";
  } else if (hasDocker) {
    backendFramework = "Docker"; backendBuildCommand = ""; backendStartCommand = "";
  } else if (hasServerFile) {
    backendFramework = "Node.js";
    const entryFile = ["server.js", "server.ts", "app.js", "app.ts"].find((f) => fileNames.includes(f)) || "server.js";
    backendStartCommand = `node ${entryFile}`;
    backendBuildCommand = "npm install";
  }

  // Check package.json for more info
  const pkgFile = files.find((f) => f.path === "package.json");
  if (pkgFile) {
    try {
      const pkgJson = JSON.parse(new TextDecoder().decode(pkgFile.data));
      const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
      if (deps["next"]) { frontendFramework = "Next.js"; backendFramework = "Next.js"; frontendOutputDir = ".next"; }
      else if (deps["react"]) { frontendFramework = "React"; }
      else if (deps["vue"]) { frontendFramework = "Vue"; }
      else if (deps["svelte"]) { frontendFramework = "Svelte"; }
      if (deps["express"] || deps["fastify"] || deps["koa"] || deps["hapi"]) {
        backendFramework = `Node.js (${deps["express"] ? "Express" : deps["fastify"] ? "Fastify" : deps["koa"] ? "Koa" : "Hapi"})`;
        if (pkgJson.scripts?.start) backendStartCommand = "npm start";
      }
      if (pkgJson.scripts?.build && hasFrontend) frontendBuildCommand = "npm run build";
    } catch {}
  }

  // Determine what info is missing
  const missingInfo: string[] = [];
  if (hasBackend && !hasServerFile && !hasPython && !hasGo && !hasRuby && !hasDocker && !hasNextConfig) {
    missingInfo.push("start_command");
  }
  if (hasBackend && backendStartCommand === "npm start" && !pkgFile) {
    missingInfo.push("start_command");
  }

  // Primary framework for backward compat
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
  };
}

async function downloadGitHubRepoZip(githubUrl: string): Promise<ArrayBuffer> {
  const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error("Invalid GitHub URL");
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, "");
  const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`;
  let res = await fetch(zipUrl, { redirect: "follow" });
  if (!res.ok) {
    const masterUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`;
    res = await fetch(masterUrl, { redirect: "follow" });
  }
  if (!res.ok) throw new Error(`Failed to download repo: HTTP ${res.status}. Make sure the repo is public.`);
  return await res.arrayBuffer();
}

// ── Vercel deploy ──
async function deployToVercel(
  token: string, projectName: string, files: ExtractedFile[], needsBuild: boolean,
  buildCommand: string | null, outputDir: string | null, framework: string | null,
  appendLog: (msg: string, extra?: Record<string, any>) => Promise<void>
): Promise<{ deployId: string; liveUrl: string }> {
  await appendLog("Checking Vercel project...");
  const checkRes = await safeFetchJson(`https://api.vercel.com/v9/projects/${projectName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const exists = checkRes.status !== 404;
  await appendLog(exists ? `"${projectName}" exists — deploying to it.` : `"${projectName}" is new.`);

  if (!exists) {
    await appendLog(`Creating Vercel project "${projectName}"...`);
    const createRes = await safeFetchJson("https://api.vercel.com/v10/projects", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName }),
    });
    if (!createRes.ok && createRes.data?.error?.code !== "project_already_exists") {
      await appendLog(`Project create warning: ${JSON.stringify(createRes.data)}`);
    } else {
      await appendLog(`Vercel project "${projectName}" created ✓`);
    }
  }

  // Build SHA-1 map for all files (Vercel requires SHA-1)
  await appendLog(`Preparing ${files.length} files for Vercel...`, { status: "deploying" });
  const fileShaMap: Map<string, ExtractedFile> = new Map();
  const fileEntries: Array<{ file: string; sha: string; size: number }> = [];
  for (const f of files) {
    const sha = await sha1Hex(f.data);
    fileShaMap.set(sha, f);
    fileEntries.push({ file: f.path, sha, size: f.data.length });
  }

  // Helper to upload a file by its SHA-1 hash
  async function uploadFileBySha(sha: string, tok: string): Promise<boolean> {
    const f = fileShaMap.get(sha);
    if (!f) return false;
    try {
      const uploadRes = await fetch("https://api.vercel.com/v2/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tok}`,
          "Content-Type": "application/octet-stream",
          "x-vercel-digest": sha,
          "Content-Length": String(f.data.length),
        },
        body: f.data,
      });
      await uploadRes.text(); // consume body
      return uploadRes.ok || uploadRes.status === 409;
    } catch {
      return false;
    }
  }

  // Initial bulk upload
  await appendLog(`Uploading ${files.length} files to Vercel...`);
  const batchSize = 10;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (f) => {
        const sha = await sha1Hex(f.data);
        await uploadFileBySha(sha, token);
      })
    );
    if (i + batchSize < files.length) {
      await appendLog(`Uploaded ${Math.min(i + batchSize, files.length)}/${files.length} files...`);
    }
  }
  await appendLog(`All ${files.length} files uploaded ✓`);

  const deployPayload: any = {
    name: projectName, project: projectName, files: fileEntries, target: "production",
  };

  if (needsBuild) {
    deployPayload.projectSettings = {
      buildCommand: buildCommand || "npm run build",
      outputDirectory: outputDir || "dist",
      framework: framework?.toLowerCase() === "react" ? "vite" : framework?.toLowerCase() === "next.js" ? "nextjs" : null,
      installCommand: "npm install --legacy-peer-deps",
    };
  }

  // Deploy with retry for missing_files (up to 3 attempts)
  let dr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    await appendLog(attempt === 0 ? "Creating Vercel deployment..." : `Retrying deployment (attempt ${attempt + 1})...`);
    dr = await safeFetchJson("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(deployPayload),
    });

    if (dr.ok) break;

    // Handle missing_files by re-uploading them
    if (dr.data?.error?.code === "missing_files" && dr.data?.error?.missing) {
      const missing: string[] = dr.data.error.missing;
      await appendLog(`${missing.length} files need re-upload, uploading...`);
      const reBatch = 10;
      for (let i = 0; i < missing.length; i += reBatch) {
        const batch = missing.slice(i, i + reBatch);
        await Promise.all(batch.map((sha) => uploadFileBySha(sha, token)));
      }
      await appendLog(`Re-uploaded ${missing.length} files ✓`);
      continue; // retry deployment
    }

    // Not a missing_files error
    break;
  }

  if (!dr.ok) {
    await appendLog(`Deploy error: ${JSON.stringify(dr.data)}`);
    if (needsBuild) {
      await appendLog("Build setup failed — retrying as static deployment...");
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

  const dd = dr.data;
  const deployId = dd.id;
  let liveUrl = `https://${dd.url}`;
  await appendLog(`Deployment ${deployId} created`);

  let attempts = 0;
  while (attempts < 60) {
    await new Promise((r) => setTimeout(r, 5000));
    const sr = await safeFetchJson(`https://api.vercel.com/v13/deployments/${deployId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sd = sr.data;
    await appendLog(`Build: ${sd.readyState}`);
    if (sd.readyState === "READY") {
      liveUrl = `https://${projectName}.vercel.app`;
      await appendLog(`Live ✓ → ${liveUrl}`);
      break;
    }
    if (sd.readyState === "ERROR" || sd.readyState === "CANCELED") {
      throw new Error(`Build failed: ${sd.errorMessage || sd.readyState}`);
    }
    attempts++;
  }

  return { deployId, liveUrl };
}

// ── Render deploy ──
async function deployToRender(
  token: string, serviceName: string, githubUrl: string | null, files: ExtractedFile[],
  appendLog: (msg: string, extra?: Record<string, any>) => Promise<void>,
  envVars?: Array<{ key: string; value: string }>,
  userStartCommand?: string,
  userBuildCommand?: string,
): Promise<{ deployId: string; liveUrl: string }> {
  const RENDER_API = "https://api.render.com/v1";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Fetch owner ID
  await appendLog("Fetching Render account info...");
  const ownerRes = await safeFetchJson(`${RENDER_API}/owners`, { headers });
  if (!ownerRes.ok || !ownerRes.data || ownerRes.data.length === 0) {
    throw new Error("Failed to fetch Render owner info. Check your API token.");
  }
  const ownerId = ownerRes.data[0]?.owner?.id || ownerRes.data[0]?.id;
  if (!ownerId) throw new Error("Could not determine Render owner ID");
  await appendLog(`Render owner: ${ownerId}`);

  // Check for existing service
  await appendLog("Checking existing Render services...");
  const listRes = await safeFetchJson(`${RENDER_API}/services?name=${encodeURIComponent(serviceName)}&limit=1`, { headers });
  const listData = listRes.data;

  let serviceId = "";
  let serviceUrl = "";

  if (listData && Array.isArray(listData) && listData.length > 0 && listData[0]?.service) {
    serviceId = listData[0].service.id;
    serviceUrl = `https://${listData[0].service.serviceDetails?.url || serviceName + ".onrender.com"}`;
    await appendLog(`Found existing service: ${serviceId}`);

    // Update env vars on existing service if provided
    if (envVars && envVars.length > 0) {
      await appendLog(`Updating ${envVars.length} environment variables...`);
      const envRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/env-vars`, {
        method: "PUT",
        headers,
        body: JSON.stringify(envVars.map((e) => ({ key: e.key, value: e.value }))),
      });
      if (envRes.ok) {
        await appendLog("Environment variables updated ✓");
      } else {
        await appendLog(`Env vars update warning: ${JSON.stringify(envRes.data)}`);
      }
    }
  }

  if (!serviceId) {
    // Detect runtime from files
    let runtime = "node";
    let startCommand = "npm start";
    let buildCommand = "npm install";

    const hasPython = files.some((f) => f.path === "requirements.txt" || f.path === "main.py" || f.path === "app.py");
    const hasGo = files.some((f) => f.path === "go.mod");
    const hasRuby = files.some((f) => f.path === "Gemfile");
    const hasDocker = files.some((f) => f.path === "Dockerfile");
    const hasServerJs = files.some((f) => f.path === "server.js" || f.path === "server.ts" || f.path === "app.js" || f.path === "app.ts" || f.path === "index.js" || f.path === "index.ts");

    if (hasPython) {
      runtime = "python";
      startCommand = files.some((f) => f.path === "manage.py") ? "python manage.py runserver 0.0.0.0:$PORT" : "python main.py";
      buildCommand = "pip install -r requirements.txt";
    } else if (hasGo) {
      runtime = "go"; startCommand = "./main"; buildCommand = "go build -o main .";
    } else if (hasRuby) {
      runtime = "ruby"; startCommand = "bundle exec rails server -p $PORT"; buildCommand = "bundle install";
    } else if (hasDocker) {
      runtime = "docker"; startCommand = ""; buildCommand = "";
    } else if (hasServerJs) {
      // Detect the exact entry file for start command
      const entryFile = ["server.js", "server.ts", "app.js", "app.ts", "index.js", "index.ts"]
        .find((f) => files.some((file) => file.path === f)) || "server.js";
      startCommand = `node ${entryFile}`;
      buildCommand = "npm install";

      // Check package.json for a start script
      const pkgFile = files.find((f) => f.path === "package.json");
      if (pkgFile) {
        try {
          const pkg = JSON.parse(new TextDecoder().decode(pkgFile.data));
          if (pkg.scripts?.start) startCommand = "npm start";
          if (pkg.scripts?.build) buildCommand = "npm install && npm run build";
        } catch {}
      }
    }

    // Override with user-provided commands if specified
    if (userStartCommand) startCommand = userStartCommand;
    if (userBuildCommand) buildCommand = userBuildCommand;

    await appendLog(`Detected runtime: ${runtime} | build: ${buildCommand} | start: ${startCommand}`);

    if (!githubUrl) {
      throw new Error("Render deployment requires a GitHub URL. Please create your project from a GitHub repository.");
    }

    const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Invalid GitHub URL for Render");
    const repoUrl = `https://github.com/${match[1]}/${match[2].replace(/\.git$/, "")}`;

    // Correct Render API v1 payload structure:
    // Top-level: type, name, ownerId, repo, autoDeploy, branch, envVars
    // serviceDetails (webServiceDetailsPOST): runtime, plan, region, buildCommand, startCommand
    const createPayload: any = {
      type: "web_service",
      name: serviceName,
      ownerId,
      repo: repoUrl,
      autoDeploy: "yes",
      branch: "main",
      serviceDetails: {
        runtime,
        plan: "free",
        region: "oregon",
        envSpecificDetails: runtime !== "docker" ? {
          buildCommand,
          startCommand,
        } : {},
      },
    };

    // Environment variables go at the TOP LEVEL per Render API docs
    if (envVars && envVars.length > 0) {
      createPayload.envVars = envVars.map((e: any) => ({ key: e.key, value: e.value }));
    }

    await appendLog(`Creating Render service from GitHub: ${repoUrl}...`);
    let createRes = await safeFetchJson(`${RENDER_API}/services`, {
      method: "POST",
      headers,
      body: JSON.stringify(createPayload),
    });

    if (!createRes.ok) {
      // Try master branch if main fails
      if (JSON.stringify(createRes.data).toLowerCase().includes("branch")) {
        await appendLog("main branch not found, trying master...");
        createPayload.branch = "master";
        createRes = await safeFetchJson(`${RENDER_API}/services`, {
          method: "POST",
          headers,
          body: JSON.stringify(createPayload),
        });
        if (!createRes.ok) throw new Error(`Render create failed: ${JSON.stringify(createRes.data)}`);
      } else {
        throw new Error(`Render create failed: ${JSON.stringify(createRes.data)}`);
      }
    }

    serviceId = createRes.data.service?.id || createRes.data.id;
    serviceUrl = `https://${serviceName}.onrender.com`;
    await appendLog(`Render service created: ${serviceId} ✓`);
  }

  // Trigger a deploy
  await appendLog("Triggering Render deploy...", { status: "deploying" });
  const deployRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys`, {
    method: "POST",
    headers,
    body: JSON.stringify({ clearCache: "do_not_clear" }),
  });

  let deployId = "";
  if (deployRes.ok) {
    deployId = deployRes.data.id || deployRes.data.deploy?.id || serviceId;
    await appendLog(`Deploy triggered: ${deployId}`);
  } else {
    await appendLog(`Deploy trigger note: ${JSON.stringify(deployRes.data)} (service will auto-deploy from GitHub)`);
    deployId = serviceId;
  }

  // Poll for deploy status (5s intervals)
  let attempts = 0;
  while (attempts < 90) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const statusRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys?limit=1`, { headers });
      if (statusRes.ok && Array.isArray(statusRes.data) && statusRes.data.length > 0) {
        const latest = statusRes.data[0]?.deploy || statusRes.data[0];
        const status = latest.status;
        await appendLog(`Render build: ${status}`);
        if (status === "live") {
          await appendLog(`Live ✓ → ${serviceUrl}`);
          break;
        }
        if (status === "deactivated" || status === "build_failed" || status === "update_failed" || status === "canceled") {
          // Try to fetch build logs for better error info
          const latestDeployId = latest.id;
          if (latestDeployId) {
            const logRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys/${latestDeployId}/logs`, { headers });
            if (logRes.ok && Array.isArray(logRes.data)) {
              const logLines = logRes.data.map((l: any) => l.message || l.log || JSON.stringify(l)).join("\n");
              await appendLog(`Build logs:\n${logLines.slice(-2000)}`);
            }
          }
          throw new Error(`Render deploy failed: ${status}. Check the build logs above for details.`);
        }
      }
    } catch (e: any) {
      if (e.message.includes("Render deploy failed")) throw e;
      await appendLog(`Poll error: ${e.message}`);
    }
    attempts++;
  }

  if (!serviceUrl) serviceUrl = `https://${serviceName}.onrender.com`;
  return { deployId, liveUrl: serviceUrl };
}

// ══════════════════════════════════════
// ── Main server ──
// ══════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let deploymentId: string | undefined;

  try {
    const body = await req.json();
    const { action } = body;

    // ── Fetch Render service logs ──
    if (action === "fetch-logs") {
      const { deploymentId: depId } = body;
      if (!depId) throw new Error("Missing deploymentId");

      const { data: dep, error: depErr } = await supabase
        .from("deployments")
        .select("*, cloud_connections(*)")
        .eq("id", depId)
        .single();
      if (depErr || !dep) throw new Error("Deployment not found");

      const connection = (dep as any).cloud_connections;
      if (!connection) throw new Error("Connection not found");

      const token = connection.token;
      const RENDER_API = "https://api.render.com/v1";
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      // Resolve service ID
      let serviceId = dep.deploy_id;
      if (!serviceId && dep.live_url) {
        const svcName = dep.live_url.replace(/^https?:\/\//, "").replace(/\.onrender\.com.*$/, "");
        const listRes = await safeFetchJson(`${RENDER_API}/services?name=${encodeURIComponent(svcName)}&limit=1`, { headers });
        if (listRes.ok && Array.isArray(listRes.data) && listRes.data.length > 0) {
          serviceId = listRes.data[0].service?.id;
        }
      }
      if (!serviceId) throw new Error("Could not find Render service ID");

      // Fetch latest deploy logs
      const deploysRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys?limit=1`, { headers });
      let deployLogs: any[] = [];
      if (deploysRes.ok && Array.isArray(deploysRes.data) && deploysRes.data.length > 0) {
        const latestDeployId = deploysRes.data[0]?.deploy?.id || deploysRes.data[0]?.id;
        if (latestDeployId) {
          const logRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys/${latestDeployId}/logs`, { headers });
          if (logRes.ok && Array.isArray(logRes.data)) {
            deployLogs = logRes.data.map((l: any) => ({
              timestamp: l.timestamp || new Date().toISOString(),
              message: l.message || l.log || JSON.stringify(l),
              level: l.level || "info",
            }));
          }
        }
      }

      // Fetch service details
      const svcRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}`, { headers });
      const serviceInfo = svcRes.ok ? {
        id: serviceId,
        name: svcRes.data?.name || svcRes.data?.service?.name,
        status: svcRes.data?.suspended || svcRes.data?.service?.suspended ? "suspended" : "active",
        type: svcRes.data?.type || svcRes.data?.service?.type || "web_service",
        runtime: svcRes.data?.serviceDetails?.runtime || svcRes.data?.service?.serviceDetails?.runtime,
        plan: svcRes.data?.serviceDetails?.plan || svcRes.data?.service?.serviceDetails?.plan,
        region: svcRes.data?.serviceDetails?.region || svcRes.data?.service?.serviceDetails?.region,
        createdAt: svcRes.data?.createdAt || svcRes.data?.service?.createdAt,
        updatedAt: svcRes.data?.updatedAt || svcRes.data?.service?.updatedAt,
      } : null;

      // Fetch env vars (keys only, no values for security)
      const envRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/env-vars`, { headers });
      const envKeys = envRes.ok && Array.isArray(envRes.data)
        ? envRes.data.map((e: any) => ({ key: e.envVar?.key || e.key, hasValue: true }))
        : [];

      return json({
        success: true,
        logs: deployLogs,
        serviceInfo,
        envKeys,
        latestDeployStatus: deploysRes.ok && deploysRes.data?.[0]
          ? (deploysRes.data[0]?.deploy?.status || deploysRes.data[0]?.status)
          : null,
      });
    }

    // ── Fetch service health/metrics ──
    if (action === "fetch-health") {
      const { deploymentId: depId } = body;
      if (!depId) throw new Error("Missing deploymentId");

      const { data: dep, error: depErr } = await supabase
        .from("deployments")
        .select("*, cloud_connections(*)")
        .eq("id", depId)
        .single();
      if (depErr || !dep) throw new Error("Deployment not found");

      const connection = (dep as any).cloud_connections;
      if (!connection) throw new Error("Connection not found");

      const token = connection.token;
      const RENDER_API = "https://api.render.com/v1";
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      let serviceId = dep.deploy_id;
      if (!serviceId && dep.live_url) {
        const svcName = dep.live_url.replace(/^https?:\/\//, "").replace(/\.onrender\.com.*$/, "");
        const listRes = await safeFetchJson(`${RENDER_API}/services?name=${encodeURIComponent(svcName)}&limit=1`, { headers });
        if (listRes.ok && Array.isArray(listRes.data) && listRes.data.length > 0) {
          serviceId = listRes.data[0].service?.id;
        }
      }
      if (!serviceId) throw new Error("Could not find Render service ID");

      // Health check via HTTP
      let healthCheck = { reachable: false, statusCode: 0, responseTime: 0, error: "" };
      if (dep.live_url) {
        const start = Date.now();
        try {
          const hRes = await fetch(dep.live_url, { signal: AbortSignal.timeout(15000) });
          healthCheck = {
            reachable: hRes.ok,
            statusCode: hRes.status,
            responseTime: Date.now() - start,
            error: hRes.ok ? "" : `HTTP ${hRes.status}`,
          };
        } catch (e: any) {
          healthCheck = {
            reachable: false,
            statusCode: 0,
            responseTime: Date.now() - start,
            error: e.message || "Connection failed",
          };
        }
      }

      // Fetch last 5 deploys for history
      const deploysRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/deploys?limit=5`, { headers });
      const deployHistory = deploysRes.ok && Array.isArray(deploysRes.data)
        ? deploysRes.data.map((d: any) => {
            const deploy = d.deploy || d;
            return {
              id: deploy.id,
              status: deploy.status,
              createdAt: deploy.createdAt,
              finishedAt: deploy.finishedAt,
              commit: deploy.commit?.message?.slice(0, 80) || "",
            };
          })
        : [];

      return json({
        success: true,
        healthCheck,
        deployHistory,
        serviceId,
      });
    }

    // ── Delete deployment ──
    if (action === "delete") {
      const { deploymentId: delId } = body;
      if (!delId) throw new Error("Missing deploymentId");
      const { error } = await supabase.from("deployments").delete().eq("id", delId);
      if (error) throw new Error(`Delete failed: ${error.message}`);
      return json({ success: true });
    }

    // ── Delete connection + related deployments ──
    if (action === "delete-connection") {
      const { connectionId } = body;
      if (!connectionId) throw new Error("Missing connectionId");
      await supabase.from("deployments").delete().eq("cloud_connection_id", connectionId);
      const { error } = await supabase.from("cloud_connections").delete().eq("id", connectionId);
      if (error) throw new Error(`Delete failed: ${error.message}`);
      return json({ success: true });
    }

    // ── Delete project completely ──
    if (action === "delete-project") {
      const { projectId, userId } = body;
      if (!projectId) throw new Error("Missing projectId");

      // 1. Delete all deployments for this project
      await supabase.from("deployments").delete().eq("project_id", projectId);

      // 2. Delete storage files
      if (userId) {
        const { data: storageFiles } = await supabase.storage.from("project-uploads").list(userId);
        if (storageFiles && storageFiles.length > 0) {
          const paths = storageFiles.map((f: any) => `${userId}/${f.name}`);
          await supabase.storage.from("project-uploads").remove(paths);
        }
      }

      // 3. Delete the project record
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw new Error(`Delete project failed: ${error.message}`);

      return json({ success: true });
    }

    // ── Update env vars on existing Render service ──
    if (action === "update-env-vars") {
      const { deploymentId: depId, envVars } = body;
      if (!depId || !envVars) throw new Error("Missing deploymentId or envVars");

      const { data: dep, error: depErr } = await supabase
        .from("deployments")
        .select("*, cloud_connections(*)")
        .eq("id", depId)
        .single();
      if (depErr || !dep) throw new Error("Deployment not found");

      const connection = (dep as any).cloud_connections;
      if (!connection || connection.provider !== "render") throw new Error("Only Render deployments support env vars editing");

      // Get the Render service ID from the deploy
      const token = connection.token;
      const RENDER_API = "https://api.render.com/v1";
      const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

      // Find service by deploy URL or name
      const liveUrl = dep.live_url;
      let serviceId = dep.deploy_id;

      if (!serviceId && liveUrl) {
        const svcName = liveUrl.replace(/^https?:\/\//, "").replace(/\.onrender\.com.*$/, "");
        const listRes = await safeFetchJson(`${RENDER_API}/services?name=${encodeURIComponent(svcName)}&limit=1`, { headers });
        if (listRes.ok && Array.isArray(listRes.data) && listRes.data.length > 0) {
          serviceId = listRes.data[0].service?.id;
        }
      }

      if (!serviceId) throw new Error("Could not find Render service ID");

      // Update env vars
      const envRes = await safeFetchJson(`${RENDER_API}/services/${serviceId}/env-vars`, {
        method: "PUT",
        headers,
        body: JSON.stringify(envVars.map((e: any) => ({ key: e.key, value: e.value }))),
      });

      if (!envRes.ok) throw new Error(`Failed to update env vars: ${JSON.stringify(envRes.data)}`);

      return json({ success: true, message: "Environment variables updated" });
    }

    // ── Analyze project ──
    if (action === "analyze") {
      const { projectId: analyzeProjectId } = body;
      if (!analyzeProjectId) throw new Error("Missing projectId");

      const { data: proj, error: projErr } = await supabase.from("projects").select("*").eq("id", analyzeProjectId).single();
      if (projErr || !proj) throw new Error("Project not found");

      let extractedFiles: ExtractedFile[] = [];

      if (proj.source_type === "github" && proj.github_url) {
        const zipBuffer = await downloadGitHubRepoZip(proj.github_url);
        extractedFiles = extractZipFilesRaw(zipBuffer);
      } else if (proj.source_type === "zip") {
        const { data: fileList } = await supabase.storage
          .from("project-uploads")
          .list(proj.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });
        if (fileList && fileList.length > 0) {
          const filePath = `${proj.user_id}/${fileList[0].name}`;
          const { data: fileData } = await supabase.storage.from("project-uploads").download(filePath);
          if (fileData) {
            const zipBuffer = await fileData.arrayBuffer();
            extractedFiles = extractZipFilesRaw(zipBuffer);
          }
        }
      }

      if (extractedFiles.length === 0) {
        await supabase.from("projects").update({ status: "ready", framework: "Unknown", project_type: "frontend" }).eq("id", analyzeProjectId);
        return json({ success: true, projectType: "frontend" });
      }

      const analysis = detectProjectType(extractedFiles);
      let projectType = "frontend";
      if (analysis.hasBackend && analysis.hasFrontend) projectType = "fullstack";
      else if (analysis.hasBackend && !analysis.hasFrontend) projectType = "backend";

      await supabase.from("projects").update({
        status: "ready",
        framework: analysis.framework,
        project_type: projectType,
        build_command: analysis.buildCommand || "npm run build",
        output_dir: analysis.outputDir || "dist",
      }).eq("id", analyzeProjectId);

      return json({ success: true, projectType, framework: analysis.framework, hasFrontend: analysis.hasFrontend, hasBackend: analysis.hasBackend });
    }

    // ── Check project-name availability ──
    if (action === "check-name") {
      const { name, provider, token } = body;
      if (!name || !token) throw new Error("Missing name or token");
      const projectName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

      if (provider === "vercel") {
        const res = await safeFetchJson(`https://api.vercel.com/v9/projects/${projectName}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return json({ success: true, available: res.status === 404, projectName });
      }
      if (provider === "render") {
        const res = await safeFetchJson(`https://api.render.com/v1/services?name=${encodeURIComponent(projectName)}&limit=1`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        const available = !res.data || !Array.isArray(res.data) || res.data.length === 0;
        return json({ success: true, available, projectName });
      }
      return json({ success: true, available: true, projectName });
    }

    // ── Check domain availability ──
    if (action === "check-domain") {
      const { domain, provider, token } = body;
      if (!domain || !token) throw new Error("Missing domain or token");

      if (provider === "vercel") {
        const projName = domain.replace(/\.vercel\.app$/, "");
        const res = await safeFetchJson(`https://api.vercel.com/v9/projects/${projName}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return json({ success: true, domain, available: res.status === 404 });
      }
      if (provider === "render") {
        const svcName = domain.replace(/\.onrender\.com$/, "");
        const res = await safeFetchJson(`https://api.render.com/v1/services?name=${encodeURIComponent(svcName)}&limit=1`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        const available = !res.data || !Array.isArray(res.data) || res.data.length === 0;
        return json({ success: true, domain, available });
      }
      return json({ success: true, domain, available: true });
    }

    // ── Add domain ──
    if (action === "add-domain") {
      const { projectName, domain, token, provider } = body;
      if (!projectName || !domain || !token) throw new Error("Missing fields");
      if (provider === "vercel") {
        const res = await safeFetchJson(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectName)}/domains`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: domain }),
        });
        if (!res.ok) return json({ success: false, error: res.data?.error?.message || JSON.stringify(res.data) }, 400);
        return json({ success: true, domain: res.data });
      }
      return json({ success: false, error: "Not supported for this provider" }, 400);
    }

    // ── Redeploy ──
    if (action === "redeploy") {
      const { deploymentId: redeployId } = body;
      if (!redeployId) throw new Error("Missing deploymentId");

      const { data: dep, error: depErr } = await supabase.from("deployments").select("*, projects(*), cloud_connections(*)").eq("id", redeployId).single();
      if (depErr || !dep) throw new Error("Deployment not found");

      await supabase.from("deployments").update({ status: "building", error_message: null, logs: "[Redeploy] Triggered new deployment...\n" }).eq("id", redeployId);

      const project = (dep as any).projects;
      const connection = (dep as any).cloud_connections;
      if (!project || !connection) throw new Error("Project or connection not found");

      const appendLog = async (log: string, extra?: Record<string, any>) => {
        const { data: cur } = await supabase.from("deployments").select("logs").eq("id", redeployId).single();
        const ts = new Date().toISOString().slice(11, 19);
        await supabase.from("deployments").update({
          logs: (cur?.logs || "") + `[${ts}] ${log}\n`,
          ...extra,
        }).eq("id", redeployId);
      };

      let extractedFiles: ExtractedFile[] = [];
      if (project.source_type === "github" && project.github_url) {
        await appendLog("Re-cloning GitHub repository...");
        const zipBuffer = await downloadGitHubRepoZip(project.github_url);
        await appendLog(`Downloaded ${(zipBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
        extractedFiles = extractZipFilesRaw(zipBuffer);
        await appendLog(`Extracted ${extractedFiles.length} files`);
      } else if (project.source_type === "zip") {
        await appendLog("Re-downloading ZIP from storage...");
        const { data: fileList } = await supabase.storage.from("project-uploads").list(project.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });
        if (!fileList || fileList.length === 0) throw new Error("No uploaded files found");
        const filePath = `${project.user_id}/${fileList[0].name}`;
        const { data: fileData, error: dlErr } = await supabase.storage.from("project-uploads").download(filePath);
        if (dlErr || !fileData) throw new Error(`Download failed: ${dlErr?.message}`);
        const zipBuffer = await fileData.arrayBuffer();
        extractedFiles = extractZipFilesRaw(zipBuffer);
        await appendLog(`Extracted ${extractedFiles.length} files`);
      }

      const needsBuild = detectBuildNeeded(extractedFiles);
      const desiredSubdomain = dep.live_url
        ? dep.live_url.replace(/^https?:\/\//, "").replace(/\.(vercel\.app|onrender\.com).*$/, "")
        : project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

      let result: { deployId: string; liveUrl: string };

      if (connection.provider === "vercel") {
        result = await deployToVercel(connection.token, desiredSubdomain, extractedFiles, needsBuild, project.build_command, project.output_dir, project.framework, appendLog);
      } else if (connection.provider === "render") {
        result = await deployToRender(connection.token, desiredSubdomain, project.github_url, extractedFiles, appendLog);
      } else {
        throw new Error(`Unsupported provider for redeploy: ${connection.provider}`);
      }

      await appendLog("Redeployment successful! ✅", { status: "live", live_url: result.liveUrl, deploy_id: result.deployId });
      return json({ success: true, url: result.liveUrl });
    }

    // ══════════════════════════════════════
    // ── Deploy ──
    // ══════════════════════════════════════
    deploymentId = body.deploymentId;
    const { projectId, connectionId, customDomain, envVars, customStartCommand, customBuildCommand } = body;

    if (!deploymentId || !projectId || !connectionId) {
      throw new Error(`Missing: deploymentId=${deploymentId}, projectId=${projectId}, connectionId=${connectionId}`);
    }

    const appendLog = async (log: string, extra?: Record<string, any>) => {
      const { data: cur } = await supabase.from("deployments").select("logs").eq("id", deploymentId!).single();
      const ts = new Date().toISOString().slice(11, 19);
      await supabase.from("deployments").update({
        logs: (cur?.logs || "") + `[${ts}] ${log}\n`,
        ...extra,
      }).eq("id", deploymentId!);
    };

    await appendLog("Fetching deployment details...", { status: "building" });

    const [depRes, projRes, connRes] = await Promise.all([
      supabase.from("deployments").select("*").eq("id", deploymentId).single(),
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("cloud_connections").select("*").eq("id", connectionId).single(),
    ]);

    if (depRes.error) throw new Error(depRes.error.message);
    if (projRes.error) throw new Error(projRes.error.message);
    if (connRes.error) throw new Error(connRes.error.message);

    const project = projRes.data!;
    const connection = connRes.data!;
    const provider = connection.provider;
    const token = connection.token;

    let desiredSubdomain = customDomain
      ? customDomain.replace(/\.(vercel\.app|onrender\.com)$/, "").toLowerCase().replace(/[^a-z0-9-]/g, "-")
      : project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    await appendLog(`Provider: ${provider} | Project: ${project.name} | Subdomain: ${desiredSubdomain} | Source: ${project.source_type}`);

    let extractedFiles: ExtractedFile[] = [];

    if (project.source_type === "github" && project.github_url) {
      await appendLog("Cloning GitHub repository as ZIP...");
      const zipBuffer = await downloadGitHubRepoZip(project.github_url);
      await appendLog(`Downloaded ${(zipBuffer.byteLength / 1024 / 1024).toFixed(2)} MB from GitHub`);
      const storagePath = `${project.user_id}/${desiredSubdomain}-github.zip`;
      const blob = new Blob([zipBuffer], { type: "application/zip" });
      await supabase.storage.from("project-uploads").upload(storagePath, blob, { upsert: true });
      await appendLog("Stored clone in project storage ✓");
      extractedFiles = extractZipFilesRaw(zipBuffer);
      await appendLog(`Extracted ${extractedFiles.length} files from repository`);
    } else if (project.source_type === "zip") {
      await appendLog("Processing ZIP upload...");
      const { data: fileList } = await supabase.storage
        .from("project-uploads")
        .list(project.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });
      if (!fileList || fileList.length === 0) throw new Error("No uploaded files found");
      const latestFile = fileList[0];
      await appendLog(`File: ${latestFile.name}`);
      const filePath = `${project.user_id}/${latestFile.name}`;
      const { data: fileData, error: dlErr } = await supabase.storage.from("project-uploads").download(filePath);
      if (dlErr || !fileData) throw new Error(`Download failed: ${dlErr?.message}`);
      const zipBuffer = await fileData.arrayBuffer();
      await appendLog(`ZIP downloaded: ${(zipBuffer.byteLength / 1024 / 1024).toFixed(2)} MB. Extracting...`);
      extractedFiles = extractZipFilesRaw(zipBuffer);
      await appendLog(`Extracted ${extractedFiles.length} files from ZIP`);
    } else {
      throw new Error(`Unsupported source type: ${project.source_type}`);
    }

    const fileNames = extractedFiles.slice(0, 10).map((f) => f.path);
    await appendLog(`Files: ${fileNames.join(", ")}${extractedFiles.length > 10 ? ` ...+${extractedFiles.length - 10} more` : ""}`);

    const needsBuild = detectBuildNeeded(extractedFiles);
    const projectAnalysis = detectProjectType(extractedFiles);
    await appendLog(needsBuild ? `Build-required project detected (${projectAnalysis.framework})` : "Static project — no build step");
    await appendLog(`Project analysis: frontend=${projectAnalysis.hasFrontend}, backend=${projectAnalysis.hasBackend}, framework=${projectAnalysis.framework}`);

    let result: { deployId: string; liveUrl: string };

    if (provider === "vercel") {
      result = await deployToVercel(token, desiredSubdomain, extractedFiles, needsBuild, project.build_command, project.output_dir, project.framework, appendLog);
    } else if (provider === "render") {
      result = await deployToRender(token, desiredSubdomain, project.github_url, extractedFiles, appendLog, envVars, customStartCommand, customBuildCommand);
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    await appendLog("Deployment successful! ✅", { status: "live", live_url: result.liveUrl, deploy_id: result.deployId });
    await supabase.from("projects").update({ status: "live" }).eq("id", projectId);
    return json({ success: true, url: result.liveUrl });

  } catch (error: any) {
    console.error("Deployment error:", error);
    if (deploymentId) {
      const { data: cur } = await supabase.from("deployments").select("logs").eq("id", deploymentId).single();
      const ts = new Date().toISOString().slice(11, 19);
      await supabase.from("deployments").update({
        status: "error",
        error_message: error.message,
        logs: (cur?.logs || "") + `[${ts}] ❌ ERROR: ${error.message}\n`,
      }).eq("id", deploymentId);
    }
    return json({ success: false, error: error.message }, 500);
  }
});
