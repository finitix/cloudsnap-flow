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

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
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

function detectProjectType(files: ExtractedFile[]): { hasFrontend: boolean; hasBackend: boolean } {
  const fileNames = files.map((f) => f.path.toLowerCase());
  const hasFrontend = fileNames.some((f) =>
    f === "package.json" || f === "index.html" || f.endsWith(".tsx") || f.endsWith(".jsx") || f.endsWith(".vue")
  );
  const hasBackend = fileNames.some((f) =>
    f === "requirements.txt" || f === "main.py" || f === "app.py" || f === "server.js" ||
    f === "server.ts" || f === "Dockerfile" || f === "Procfile" || f === "go.mod" ||
    f === "Gemfile" || f === "manage.py"
  );
  return { hasFrontend, hasBackend };
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

// ── Vercel: Upload files individually then create deployment ──
async function deployToVercel(
  token: string,
  projectName: string,
  files: ExtractedFile[],
  needsBuild: boolean,
  buildCommand: string | null,
  outputDir: string | null,
  framework: string | null,
  appendLog: (msg: string, extra?: Record<string, any>) => Promise<void>
): Promise<{ deployId: string; liveUrl: string }> {
  await appendLog("Checking Vercel project...");
  const checkRes = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const exists = checkRes.status !== 404;
  await checkRes.text();
  await appendLog(exists ? `"${projectName}" exists — deploying to it.` : `"${projectName}" is new.`);

  if (!exists) {
    await appendLog(`Creating Vercel project "${projectName}"...`);
    const createRes = await fetch("https://api.vercel.com/v10/projects", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: projectName }),
    });
    const createData = await createRes.json();
    if (!createRes.ok && createData?.error?.code !== "project_already_exists") {
      await appendLog(`Project create warning: ${JSON.stringify(createData)}`);
    } else {
      await appendLog(`Vercel project "${projectName}" created ✓`);
    }
  }

  await appendLog(`Uploading ${files.length} files to Vercel...`, { status: "deploying" });
  const fileEntries: Array<{ file: string; sha: string; size: number }> = [];
  const batchSize = 10;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (f) => {
        const sha = await sha256Hex(f.data);
        const uploadRes = await fetch("https://api.vercel.com/v2/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
            "x-vercel-digest": sha,
            "x-vercel-size": String(f.data.length),
          },
          body: f.data,
        });
        if (!uploadRes.ok && uploadRes.status !== 409) {
          const errText = await uploadRes.text();
          console.error(`File upload failed for ${f.path}: ${errText}`);
        } else {
          await uploadRes.text();
        }
        fileEntries.push({ file: f.path, sha, size: f.data.length });
      })
    );
    if (i + batchSize < files.length) {
      await appendLog(`Uploaded ${Math.min(i + batchSize, files.length)}/${files.length} files...`);
    }
  }
  await appendLog(`All ${files.length} files uploaded ✓`);

  const deployPayload: any = {
    name: projectName,
    project: projectName,
    files: fileEntries,
    target: "production",
  };

  if (needsBuild) {
    deployPayload.projectSettings = {
      buildCommand: buildCommand || "npm run build",
      outputDirectory: outputDir || "dist",
      framework: framework?.toLowerCase() === "react" ? "vite"
        : framework?.toLowerCase() === "next.js" ? "nextjs"
        : null,
      installCommand: "npm install --legacy-peer-deps",
    };
  }

  await appendLog("Creating Vercel deployment...");
  const dr = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(deployPayload),
  });

  let dd = await dr.json();
  if (!dr.ok) {
    await appendLog(`Deploy error: ${JSON.stringify(dd)}`);
    if (needsBuild) {
      await appendLog("Build setup failed — retrying as static deployment...");
      delete deployPayload.projectSettings;
      const retryRes = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(deployPayload),
      });
      dd = await retryRes.json();
      if (!retryRes.ok) throw new Error(`Static deploy also failed: ${JSON.stringify(dd)}`);
    } else {
      throw new Error(`Deploy failed: ${JSON.stringify(dd)}`);
    }
  }

  const deployId = dd.id;
  let liveUrl = `https://${dd.url}`;
  await appendLog(`Deployment ${deployId} created`);

  let attempts = 0;
  while (attempts < 60) {
    await new Promise((r) => setTimeout(r, 5000));
    const sr = await fetch(`https://api.vercel.com/v13/deployments/${deployId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sd = await sr.json();
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

// ── Render: Create/update web service and deploy ──
async function deployToRender(
  token: string,
  serviceName: string,
  githubUrl: string | null,
  files: ExtractedFile[],
  appendLog: (msg: string, extra?: Record<string, any>) => Promise<void>
): Promise<{ deployId: string; liveUrl: string }> {
  const RENDER_API = "https://api.render.com/v1";
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Check for existing service
  await appendLog("Checking existing Render services...");
  const listRes = await fetch(`${RENDER_API}/services?name=${encodeURIComponent(serviceName)}&limit=1`, { headers });
  const listData = await listRes.json();

  let serviceId = "";
  let serviceUrl = "";

  if (listData && listData.length > 0 && listData[0]?.service) {
    serviceId = listData[0].service.id;
    serviceUrl = `https://${listData[0].service.serviceDetails?.url || serviceName + ".onrender.com"}`;
    await appendLog(`Found existing service: ${serviceId}`);
  }

  if (!serviceId) {
    // Detect runtime from files
    let runtime = "node";
    let startCommand = "npm start";
    let buildCommand = "npm install && npm run build";

    const hasPython = files.some((f) => f.path === "requirements.txt" || f.path === "main.py" || f.path === "app.py");
    const hasGo = files.some((f) => f.path === "go.mod");
    const hasRuby = files.some((f) => f.path === "Gemfile");
    const hasDocker = files.some((f) => f.path === "Dockerfile");

    if (hasPython) {
      runtime = "python";
      startCommand = files.some((f) => f.path === "manage.py") ? "python manage.py runserver 0.0.0.0:$PORT" : "python main.py";
      buildCommand = "pip install -r requirements.txt";
    } else if (hasGo) {
      runtime = "go";
      startCommand = "./main";
      buildCommand = "go build -o main .";
    } else if (hasRuby) {
      runtime = "ruby";
      startCommand = "bundle exec rails server -p $PORT";
      buildCommand = "bundle install";
    }

    await appendLog(`Detected runtime: ${runtime}`);

    if (githubUrl && !hasDocker) {
      // Create service from GitHub repo
      const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error("Invalid GitHub URL for Render");
      const repoUrl = `https://github.com/${match[1]}/${match[2].replace(/\.git$/, "")}`;

      await appendLog(`Creating Render service from GitHub: ${repoUrl}...`);
      const createRes = await fetch(`${RENDER_API}/services`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "web_service",
          name: serviceName,
          repo: repoUrl,
          autoDeploy: "yes",
          branch: "main",
          runtime: hasDocker ? "docker" : runtime,
          buildCommand: hasDocker ? undefined : buildCommand,
          startCommand: hasDocker ? undefined : startCommand,
          plan: "free",
          region: "oregon",
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        // Try master branch
        if (JSON.stringify(createData).includes("branch")) {
          await appendLog("main branch not found, trying master...");
          const retryRes = await fetch(`${RENDER_API}/services`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              type: "web_service",
              name: serviceName,
              repo: repoUrl,
              autoDeploy: "yes",
              branch: "master",
              runtime: hasDocker ? "docker" : runtime,
              buildCommand: hasDocker ? undefined : buildCommand,
              startCommand: hasDocker ? undefined : startCommand,
              plan: "free",
              region: "oregon",
            }),
          });
          const retryData = await retryRes.json();
          if (!retryRes.ok) throw new Error(`Render create failed: ${JSON.stringify(retryData)}`);
          serviceId = retryData.service?.id || retryData.id;
          serviceUrl = `https://${serviceName}.onrender.com`;
        } else {
          throw new Error(`Render create failed: ${JSON.stringify(createData)}`);
        }
      } else {
        serviceId = createData.service?.id || createData.id;
        serviceUrl = `https://${serviceName}.onrender.com`;
      }
      await appendLog(`Render service created: ${serviceId} ✓`);
    } else if (hasDocker) {
      // Docker-based service
      await appendLog("Creating Docker-based Render service...");
      const createRes = await fetch(`${RENDER_API}/services`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "web_service",
          name: serviceName,
          runtime: "docker",
          plan: "free",
          region: "oregon",
          repo: githubUrl ? `https://github.com/${githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/)?.[1]}/${githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/)?.[2]?.replace(/\.git$/, "")}` : undefined,
          autoDeploy: githubUrl ? "yes" : "no",
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(`Render create failed: ${JSON.stringify(createData)}`);
      serviceId = createData.service?.id || createData.id;
      serviceUrl = `https://${serviceName}.onrender.com`;
      await appendLog(`Docker service created: ${serviceId} ✓`);
    } else {
      throw new Error("Render deployment requires a GitHub URL with a supported backend project (Node.js, Python, Go, Ruby, or Docker).");
    }
  }

  // Trigger a deploy
  await appendLog("Triggering Render deploy...", { status: "deploying" });
  const deployRes = await fetch(`${RENDER_API}/services/${serviceId}/deploys`, {
    method: "POST",
    headers,
    body: JSON.stringify({ clearCache: "do_not_clear" }),
  });

  let deployId = "";
  if (deployRes.ok) {
    const deployData = await deployRes.json();
    deployId = deployData.id || deployData.deploy?.id || serviceId;
    await appendLog(`Deploy triggered: ${deployId}`);
  } else {
    const errText = await deployRes.text();
    await appendLog(`Deploy trigger note: ${errText} (service will auto-deploy from GitHub)`);
    deployId = serviceId;
  }

  // Poll for deploy status
  let attempts = 0;
  while (attempts < 60) {
    await new Promise((r) => setTimeout(r, 10000));
    try {
      const statusRes = await fetch(`${RENDER_API}/services/${serviceId}/deploys?limit=1`, { headers });
      if (statusRes.ok) {
        const deploys = await statusRes.json();
        if (deploys && deploys.length > 0) {
          const latest = deploys[0]?.deploy || deploys[0];
          const status = latest.status;
          await appendLog(`Render build: ${status}`);
          if (status === "live") {
            await appendLog(`Live ✓ → ${serviceUrl}`);
            break;
          }
          if (status === "deactivated" || status === "build_failed" || status === "update_failed" || status === "canceled") {
            throw new Error(`Render deploy failed: ${status}`);
          }
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

    // ── Check project-name availability ──
    if (action === "check-name") {
      const { name, provider, token } = body;
      if (!name || !token) throw new Error("Missing name or token");
      const projectName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

      if (provider === "vercel") {
        const res = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const available = res.status === 404;
        await res.text();
        return json({ success: true, available, projectName });
      }
      if (provider === "render") {
        const res = await fetch(`https://api.render.com/v1/services?name=${encodeURIComponent(projectName)}&limit=1`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        const data = await res.json();
        const available = !data || data.length === 0;
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
        const res = await fetch(`https://api.vercel.com/v9/projects/${projName}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const available = res.status === 404;
        await res.text();
        return json({ success: true, domain, available });
      }
      if (provider === "render") {
        const svcName = domain.replace(/\.onrender\.com$/, "");
        const res = await fetch(`https://api.render.com/v1/services?name=${encodeURIComponent(svcName)}&limit=1`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        const data = await res.json();
        const available = !data || data.length === 0;
        return json({ success: true, domain, available });
      }
      return json({ success: true, domain, available: true });
    }

    // ── Add domain ──
    if (action === "add-domain") {
      const { projectName, domain, token, provider } = body;
      if (!projectName || !domain || !token) throw new Error("Missing fields");
      if (provider === "vercel") {
        const res = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectName)}/domains`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: domain }),
        });
        const data = await res.json();
        if (!res.ok) return json({ success: false, error: data?.error?.message || JSON.stringify(data) }, 400);
        return json({ success: true, domain: data });
      }
      return json({ success: false, error: "Not supported for this provider" }, 400);
    }

    // ── Redeploy (trigger new deploy for existing deployment) ──
    if (action === "redeploy") {
      const { deploymentId: redeployId } = body;
      if (!redeployId) throw new Error("Missing deploymentId");

      const { data: dep, error: depErr } = await supabase.from("deployments").select("*, projects(*), cloud_connections(*)").eq("id", redeployId).single();
      if (depErr || !dep) throw new Error("Deployment not found");

      // Reset status
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

      // Re-clone from GitHub if applicable
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
        result = await deployToVercel(
          connection.token, desiredSubdomain, extractedFiles, needsBuild,
          project.build_command, project.output_dir, project.framework, appendLog
        );
      } else if (connection.provider === "render") {
        result = await deployToRender(
          connection.token, desiredSubdomain, project.github_url, extractedFiles, appendLog
        );
      } else {
        throw new Error(`Unsupported provider for redeploy: ${connection.provider}`);
      }

      await appendLog("Redeployment successful! ✅", {
        status: "live",
        live_url: result.liveUrl,
        deploy_id: result.deployId,
      });
      return json({ success: true, url: result.liveUrl });
    }

    // ══════════════════════════════════════
    // ── Deploy ──
    // ══════════════════════════════════════
    deploymentId = body.deploymentId;
    const { projectId, connectionId, customDomain } = body;

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

    // ── Get files ──
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
    const projectType = detectProjectType(extractedFiles);
    await appendLog(needsBuild ? "Build-required project detected" : "Static project — no build step");
    await appendLog(`Project analysis: frontend=${projectType.hasFrontend}, backend=${projectType.hasBackend}`);

    let result: { deployId: string; liveUrl: string };

    if (provider === "vercel") {
      result = await deployToVercel(
        token, desiredSubdomain, extractedFiles, needsBuild,
        project.build_command, project.output_dir, project.framework,
        appendLog
      );
    } else if (provider === "render") {
      result = await deployToRender(
        token, desiredSubdomain, project.github_url, extractedFiles, appendLog
      );
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    await appendLog("Deployment successful! ✅", {
      status: "live",
      live_url: result.liveUrl,
      deploy_id: result.deployId,
    });
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
