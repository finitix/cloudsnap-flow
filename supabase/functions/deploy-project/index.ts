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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

function extractZipFiles(zipBuffer: ArrayBuffer): Array<{ file: string; data: string; encoding: string }> {
  const zipData = new Uint8Array(zipBuffer);
  const unzipped = unzipSync(zipData);
  const files: Array<{ file: string; data: string; encoding: string }> = [];

  for (const [path, content] of Object.entries(unzipped)) {
    if (path.endsWith("/") || path.startsWith("__MACOSX") || path.startsWith(".")) continue;
    if (content.length > 5 * 1024 * 1024) continue;

    let cleanPath = path;
    const parts = path.split("/");
    if (parts.length > 1) {
      cleanPath = parts.slice(1).join("/") || parts[0];
    }
    if (!cleanPath || cleanPath.endsWith("/")) continue;

    const base64 = arrayBufferToBase64(content.buffer);
    files.push({ file: cleanPath, data: base64, encoding: "base64" });
  }

  return files;
}

function detectBuildNeeded(files: Array<{ file: string }>): boolean {
  return files.some(
    (f) =>
      f.file === "package.json" ||
      f.file === "requirements.txt" ||
      f.file === "Cargo.toml"
  );
}

function generateUniqueSiteName(baseName: string): string {
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${baseName}-${suffix}`;
}

// Download GitHub repo as ZIP via the archive API (no GitHub App needed)
async function downloadGitHubRepoZip(githubUrl: string): Promise<ArrayBuffer> {
  const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error("Invalid GitHub URL");
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, "");
  
  // GitHub allows downloading public repos as ZIP without auth
  const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`;
  console.log(`Downloading GitHub ZIP: ${zipUrl}`);
  
  let res = await fetch(zipUrl, { redirect: "follow" });
  
  // Try 'master' branch if 'main' fails
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
      // Delete all deployments linked to this connection
      await supabase.from("deployments").delete().eq("cloud_connection_id", connectionId);
      // Delete the connection itself
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
        if (!available) {
          const data = await res.json();
          return json({ success: true, available, projectName, existing: data?.name });
        }
        await res.text();
        return json({ success: true, available: true, projectName });
      }
      if (provider === "netlify") {
        // Check if the site name is available by trying to get it
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

    // ── Add domain to deployed project ──
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

    const { data: deployment, error: depErr } = await supabase.from("deployments").select("*").eq("id", deploymentId).single();
    if (depErr) { await appendLog(`ERROR: ${depErr.message}`); throw new Error(depErr.message); }

    const { data: project, error: projErr } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (projErr) { await appendLog(`ERROR: ${projErr.message}`); throw new Error(projErr.message); }

    const { data: connection, error: connErr } = await supabase.from("cloud_connections").select("*").eq("id", connectionId).single();
    if (connErr) { await appendLog(`ERROR: ${connErr.message}`); throw new Error(connErr.message); }

    if (!deployment || !project || !connection) {
      throw new Error(`Data missing: dep=${!!deployment}, proj=${!!project}, conn=${!!connection}`);
    }

    const provider = connection.provider;
    const token = connection.token;
    const projectName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    
    let desiredSubdomain = customDomain
      ? customDomain.replace(/\.(vercel\.app|netlify\.app)$/, "").toLowerCase().replace(/[^a-z0-9-]/g, "-")
      : projectName;
    
    let liveUrl = "";
    let deployId = "";

    await appendLog(`Provider: ${provider} | Project: ${projectName} | Desired subdomain: ${desiredSubdomain} | Source: ${project.source_type}`);

    // ── Get files either from GitHub (download as ZIP) or from storage ──
    let extractedFiles: Array<{ file: string; data: string; encoding: string }> = [];
    let rawZipBlob: Blob | null = null;

    if (project.source_type === "github" && project.github_url) {
      await appendLog("Cloning GitHub repository as ZIP...");
      try {
        const zipBuffer = await downloadGitHubRepoZip(project.github_url);
        await appendLog(`Downloaded ${(zipBuffer.byteLength / 1024 / 1024).toFixed(2)} MB from GitHub`);
        
        // Store in our storage for records
        const storagePath = `${project.user_id}/${projectName}-github.zip`;
        const blob = new Blob([zipBuffer], { type: "application/zip" });
        rawZipBlob = blob;
        await supabase.storage.from("project-uploads").upload(storagePath, blob, { upsert: true });
        await appendLog("Stored clone in project storage ✓");
        
        // Extract files
        extractedFiles = extractZipFiles(zipBuffer);
        await appendLog(`Extracted ${extractedFiles.length} files from repository`);
      } catch (ghErr: any) {
        await appendLog(`GitHub clone failed: ${ghErr.message}`);
        throw new Error(`GitHub clone failed: ${ghErr.message}`);
      }
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

      rawZipBlob = fileData;
      const zipBuffer = await fileData.arrayBuffer();
      await appendLog(`ZIP downloaded: ${zipBuffer.byteLength} bytes. Extracting...`);

      try {
        extractedFiles = extractZipFiles(zipBuffer);
        await appendLog(`Extracted ${extractedFiles.length} files from ZIP`);
      } catch (extractErr: any) {
        await appendLog(`ZIP extraction failed: ${extractErr.message}. Deploying as static file.`);
        extractedFiles = [{
          file: "index.html",
          data: arrayBufferToBase64(
            new TextEncoder().encode(
              "<html><body><h1>Upload Error</h1><p>Could not extract ZIP. Please use GitHub import instead.</p></body></html>"
            ).buffer
          ),
          encoding: "base64",
        }];
      }
    } else {
      throw new Error(`Unsupported source type: ${project.source_type}`);
    }

    const fileNames = extractedFiles.slice(0, 10).map((f) => f.file);
    await appendLog(`Files: ${fileNames.join(", ")}${extractedFiles.length > 10 ? ` ...+${extractedFiles.length - 10} more` : ""}`);

    const needsBuild = detectBuildNeeded(extractedFiles);
    await appendLog(needsBuild ? "Build-required project detected (has package.json)" : "Static project detected — no build step");

    // ══════════════════════════════════════
    // ── VERCEL DEPLOYMENT ──
    // ══════════════════════════════════════
    if (provider === "vercel") {
      // Check project existence
      await appendLog("Checking Vercel project...");
      const checkRes = await fetch(`https://api.vercel.com/v9/projects/${desiredSubdomain}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const nameExists = checkRes.status !== 404;
      await checkRes.text();
      await appendLog(nameExists ? `"${desiredSubdomain}" exists — deploying to it.` : `"${desiredSubdomain}" is new.`);

      // Create project if needed
      if (!nameExists) {
        await appendLog(`Creating Vercel project "${desiredSubdomain}"...`);
        const createRes = await fetch("https://api.vercel.com/v10/projects", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: desiredSubdomain }),
        });
        const createData = await createRes.json();
        if (!createRes.ok && createData?.error?.code !== "project_already_exists") {
          await appendLog(`Project create warning: ${JSON.stringify(createData)}`);
        } else {
          await appendLog(`Vercel project "${desiredSubdomain}" created ✓`);
        }
      }

      const deployPayload: any = {
        name: desiredSubdomain,
        files: extractedFiles,
        project: desiredSubdomain,
      };

      if (needsBuild) {
        deployPayload.projectSettings = {
          buildCommand: project.build_command || "npm run build",
          outputDirectory: project.output_dir || "dist",
          framework: project.framework?.toLowerCase() === "react" ? "vite"
            : project.framework?.toLowerCase() === "next.js" ? "nextjs"
            : null,
          installCommand: "npm install --legacy-peer-deps",
        };
      }

      await appendLog("Sending files to Vercel...", { status: "deploying" });

      const dr = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(deployPayload),
      });

      const dd = await dr.json();
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
          const retryData = await retryRes.json();
          if (!retryRes.ok) throw new Error(`Static deploy also failed: ${JSON.stringify(retryData)}`);
          deployId = retryData.id;
          liveUrl = `https://${retryData.url}`;
        } else {
          throw new Error(`Deploy failed: ${JSON.stringify(dd)}`);
        }
      } else {
        deployId = dd.id;
        liveUrl = `https://${dd.url}`;
      }

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
          liveUrl = `https://${desiredSubdomain}.vercel.app`;
          await appendLog(`Live ✓ → ${liveUrl}`);
          break;
        }
        if (sd.readyState === "ERROR" || sd.readyState === "CANCELED") {
          const errDetail = sd.errorMessage || sd.readyState;
          await appendLog(`Build error: ${errDetail}`);
          if (needsBuild) {
            await appendLog("Retrying as static site (no build)...");
            delete deployPayload.projectSettings;
            const retryRes = await fetch("https://api.vercel.com/v13/deployments", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ name: desiredSubdomain, files: extractedFiles, project: desiredSubdomain }),
            });
            const retryData = await retryRes.json();
            if (retryRes.ok) {
              deployId = retryData.id;
              liveUrl = `https://${retryData.url}`;
              await appendLog(`Static retry deployment: ${deployId}`);
              attempts = 0;
              continue;
            }
          }
          throw new Error(`Build failed: ${errDetail}`);
        }
        attempts++;
      }

    // ══════════════════════════════════════
    // ── NETLIFY DEPLOYMENT ──
    // ══════════════════════════════════════
    } else if (provider === "netlify") {
      await appendLog("Starting Netlify deployment...", { status: "deploying" });
      
      let siteName = desiredSubdomain;
      let siteId = "";

      // Step 1: Check if site already exists (owned by user)
      await appendLog(`Checking if "${siteName}" exists on Netlify...`);
      const existCheck = await fetch(`https://api.netlify.com/api/v1/sites/${siteName}.netlify.app`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (existCheck.status === 200) {
        const existData = await existCheck.json();
        siteId = existData.id;
        await appendLog(`Site "${siteName}" already exists (${siteId}) — deploying to it.`);
      } else {
        await existCheck.text();
        // Step 2: Create new site
        await appendLog(`Creating Netlify site "${siteName}"...`);
        
        const createSiteWithRetry = async (name: string): Promise<{ id: string; name: string; ssl_url: string; url: string }> => {
          const res = await fetch("https://api.netlify.com/api/v1/sites", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ name, force_ssl: true }),
          });
          const data = await res.json();
          
          if (!res.ok) {
            const errStr = JSON.stringify(data);
            if (errStr.includes("reserved") || errStr.includes("subdomain") || errStr.includes("taken") || errStr.includes("already exists")) {
              // Retry with unique suffix
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
        
        const siteData = await createSiteWithRetry(siteName);
        siteId = siteData.id;
        await appendLog(`Site created: ${siteId} as "${siteName}" ✓`);
      }

      // Step 3: Deploy files to the site
      if (!rawZipBlob) throw new Error("No ZIP data available for deployment");
      
      await appendLog("Uploading ZIP to Netlify...");
      const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`, 
          "Content-Type": "application/zip",
        },
        body: rawZipBlob,
      });
      
      const deployData = await deployRes.json();
      if (!deployRes.ok) {
        await appendLog(`Deploy upload error: ${JSON.stringify(deployData)}`);
        throw new Error(`Deploy upload failed: ${JSON.stringify(deployData)}`);
      }
      
      const netlifyDeployId = deployData.id;
      await appendLog(`Deploy ${netlifyDeployId} uploaded. Waiting for processing...`);
      
      // Step 4: Poll for deploy to be ready
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
        // "uploading", "uploaded", "preparing", "prepared", "processing", "building" are all in-progress states
        pollAttempts++;
      }
      
      if (!liveUrl) {
        liveUrl = `https://${siteName}.netlify.app`;
      }
      
      deployId = siteId;

      // Step 5: Publish the deploy to production
      await appendLog("Publishing to production...");
      const publishRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys/${netlifyDeployId}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (publishRes.ok) {
        await appendLog("Published to production ✓");
      } else {
        const pubData = await publishRes.json();
        await appendLog(`Publish note: ${JSON.stringify(pubData)} (site may still be accessible)`);
      }
    }

    await appendLog("Deployment successful! ✅", { status: "live", live_url: liveUrl, deploy_id: deployId });
    await supabase.from("projects").update({ status: "live" }).eq("id", projectId);
    return json({ success: true, url: liveUrl });

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
