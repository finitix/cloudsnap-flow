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

// SHA1 hex digest
async function sha1Hex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// SHA256 hex digest (for Vercel)
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

    // Strip first directory (GitHub wraps in repo-branch/)
    let cleanPath = path;
    const parts = path.split("/");
    if (parts.length > 1) {
      cleanPath = parts.slice(1).join("/");
    }
    if (!cleanPath || cleanPath.endsWith("/")) continue;

    files.push({ path: cleanPath, data: content });
  }

  return files;
}

function detectBuildNeeded(files: ExtractedFile[]): boolean {
  return files.some((f) => f.path === "package.json" || f.path === "requirements.txt" || f.path === "Cargo.toml");
}

function generateUniqueSiteName(baseName: string): string {
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${baseName}-${suffix}`;
}

async function downloadGitHubRepoZip(githubUrl: string): Promise<ArrayBuffer> {
  const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error("Invalid GitHub URL");
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, "");

  const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`;
  console.log(`Downloading GitHub ZIP: ${zipUrl}`);
  let res = await fetch(zipUrl, { redirect: "follow" });

  if (!res.ok) {
    const masterUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`;
    console.log(`main branch failed, trying master: ${masterUrl}`);
    res = await fetch(masterUrl, { redirect: "follow" });
  }

  if (!res.ok) {
    throw new Error(`Failed to download repo: HTTP ${res.status}. Make sure the repo is public.`);
  }

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

  // Check / create project
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

  // Step 1: Upload each file individually to Vercel
  await appendLog(`Uploading ${files.length} files to Vercel...`, { status: "deploying" });

  const fileEntries: Array<{ file: string; sha: string; size: number }> = [];

  // Upload files in batches of 10
  const batchSize = 10;
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (f) => {
        const sha = await sha256Hex(f.data);
        // Upload to Vercel file API
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
        // 200 = uploaded, 409 = already exists (both are fine)
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

  // Step 2: Create deployment referencing uploaded files
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
  let deployId = "";
  let liveUrl = "";

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

  deployId = dd.id;
  liveUrl = `https://${dd.url}`;
  await appendLog(`Deployment ${deployId} created`);

  // Poll for completion
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
      const errDetail = sd.errorMessage || sd.readyState;
      throw new Error(`Build failed: ${errDetail}`);
    }
    attempts++;
  }

  return { deployId, liveUrl };
}

// ── Netlify: Use digest-based deploy (file-by-file) ──
async function deployToNetlify(
  token: string,
  desiredName: string,
  files: ExtractedFile[],
  appendLog: (msg: string, extra?: Record<string, any>) => Promise<void>
): Promise<{ deployId: string; liveUrl: string }> {

  let siteName = desiredName;
  let siteId = "";

  // Check if site exists
  await appendLog(`Checking if "${siteName}" exists on Netlify...`);
  const existCheck = await fetch(`https://api.netlify.com/api/v1/sites/${siteName}.netlify.app`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (existCheck.status === 200) {
    const existData = await existCheck.json();
    siteId = existData.id;
    await appendLog(`Site "${siteName}" exists (${siteId}) — deploying to it.`);
  } else {
    await existCheck.text();
    await appendLog(`Creating Netlify site "${siteName}"...`);

    const createSite = async (name: string): Promise<any> => {
      const res = await fetch("https://api.netlify.com/api/v1/sites", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, force_ssl: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errStr = JSON.stringify(data);
        if (errStr.includes("reserved") || errStr.includes("subdomain") || errStr.includes("taken") || errStr.includes("already exists")) {
          const newName = generateUniqueSiteName(name);
          await appendLog(`"${name}" is reserved/taken. Trying "${newName}"...`);
          const retry = await fetch("https://api.netlify.com/api/v1/sites", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName, force_ssl: true }),
          });
          const retryData = await retry.json();
          if (!retry.ok) throw new Error(`Site creation failed: ${JSON.stringify(retryData)}`);
          siteName = newName;
          return retryData;
        }
        throw new Error(`Site creation failed: ${errStr}`);
      }
      return data;
    };

    const siteData = await createSite(siteName);
    siteId = siteData.id;
    await appendLog(`Site created: ${siteId} as "${siteName}" ✓`);
  }

  // Step 1: Compute SHA1 digests for all files
  await appendLog(`Computing digests for ${files.length} files...`);
  const fileDigests: Record<string, string> = {};
  const fileMap: Map<string, Uint8Array> = new Map();

  for (const f of files) {
    const sha = await sha1Hex(f.data);
    const filePath = f.path.startsWith("/") ? f.path : `/${f.path}`;
    fileDigests[filePath] = sha;
    fileMap.set(sha, f.data);
  }

  // Step 2: Create deploy with digests — Netlify tells us which files to upload
  await appendLog("Creating digest-based deploy...", { status: "deploying" });
  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: fileDigests,
      draft: false,
    }),
  });

  const deployData = await deployRes.json();
  if (!deployRes.ok) {
    throw new Error(`Netlify deploy create failed: ${JSON.stringify(deployData)}`);
  }

  const netlifyDeployId = deployData.id;
  const requiredShas: string[] = deployData.required || [];
  await appendLog(`Deploy ${netlifyDeployId} created. ${requiredShas.length} files to upload.`);

  // Step 3: Upload required files one by one
  if (requiredShas.length > 0) {
    const batchSize = 10;
    let uploaded = 0;
    for (let i = 0; i < requiredShas.length; i += batchSize) {
      const batch = requiredShas.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (sha) => {
          const fileData = fileMap.get(sha);
          if (!fileData) return;
          const uploadRes = await fetch(
            `https://api.netlify.com/api/v1/deploys/${netlifyDeployId}/files/${sha}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/octet-stream",
              },
              body: fileData,
            }
          );
          if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            console.error(`Netlify file upload failed (${sha}): ${errText}`);
          } else {
            await uploadRes.text();
          }
        })
      );
      uploaded += batch.length;
      if (uploaded < requiredShas.length) {
        await appendLog(`Uploaded ${uploaded}/${requiredShas.length} files...`);
      }
    }
    await appendLog(`All ${requiredShas.length} files uploaded ✓`);
  }

  // Step 4: Poll for deploy to be ready
  let liveUrl = "";
  let pollAttempts = 0;
  while (pollAttempts < 60) {
    await new Promise((r) => setTimeout(r, 4000));
    const statusRes = await fetch(`https://api.netlify.com/api/v1/deploys/${netlifyDeployId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const statusData = await statusRes.json();
    const state = statusData.state;
    await appendLog(`Deploy status: ${state}`);

    if (state === "ready") {
      liveUrl = statusData.ssl_url || statusData.url || `https://${siteName}.netlify.app`;
      await appendLog(`Live ✓ → ${liveUrl}`);
      break;
    }
    if (state === "error") {
      throw new Error(`Netlify deploy failed: ${statusData.error_message || "Unknown error"}`);
    }
    pollAttempts++;
  }

  if (!liveUrl) {
    liveUrl = `https://${siteName}.netlify.app`;
  }

  // Publish to production
  await appendLog("Publishing to production...");
  const publishRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys/${netlifyDeployId}/restore`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (publishRes.ok) {
    await appendLog("Published to production ✓");
  } else {
    const pubData = await publishRes.text();
    await appendLog(`Publish note: ${pubData}`);
  }

  return { deployId: siteId, liveUrl };
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
      if (provider === "netlify") {
        const res = await fetch(`https://api.netlify.com/api/v1/sites/${projectName}.netlify.app`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const available = res.status === 404;
        await res.text();
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
      if (provider === "netlify") {
        const siteName = domain.replace(/\.netlify\.app$/, "");
        const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteName}.netlify.app`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const available = res.status === 404;
        await res.text();
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
      ? customDomain.replace(/\.(vercel\.app|netlify\.app)$/, "").toLowerCase().replace(/[^a-z0-9-]/g, "-")
      : project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    await appendLog(`Provider: ${provider} | Project: ${project.name} | Subdomain: ${desiredSubdomain} | Source: ${project.source_type}`);

    // ── Get files ──
    let extractedFiles: ExtractedFile[] = [];

    if (project.source_type === "github" && project.github_url) {
      await appendLog("Cloning GitHub repository as ZIP...");
      const zipBuffer = await downloadGitHubRepoZip(project.github_url);
      await appendLog(`Downloaded ${(zipBuffer.byteLength / 1024 / 1024).toFixed(2)} MB from GitHub`);

      // Store in storage
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
    await appendLog(needsBuild ? "Build-required project detected (has package.json)" : "Static project — no build step");

    let result: { deployId: string; liveUrl: string };

    if (provider === "vercel") {
      result = await deployToVercel(
        token, desiredSubdomain, extractedFiles, needsBuild,
        project.build_command, project.output_dir, project.framework,
        appendLog
      );
    } else if (provider === "netlify") {
      result = await deployToNetlify(token, desiredSubdomain, extractedFiles, appendLog);
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
