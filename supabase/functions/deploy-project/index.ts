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

// Generate a unique site name to avoid Netlify reserved word issues
function generateUniqueSiteName(baseName: string): string {
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${baseName}-${suffix}`;
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
        const res = await fetch(`https://api.netlify.com/api/v1/sites?name=${projectName}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const sites = await res.json();
        return json({ success: true, available: !Array.isArray(sites) || sites.length === 0, projectName });
      }
      return json({ success: true, available: true, projectName });
    }

    // ── Check domain availability ──
    if (action === "check-domain") {
      const { domain, provider, token } = body;
      if (!domain || !token) throw new Error("Missing domain or token");

      if (provider === "vercel") {
        // For vercel subdomains, check if the project name exists
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
        const res = await fetch(`https://api.netlify.com/api/v1/sites?name=${siteName}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const sites = await res.json();
        return json({ success: true, domain, available: !Array.isArray(sites) || sites.length === 0 });
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
    
    // Extract desired subdomain from customDomain
    let desiredSubdomain = customDomain
      ? customDomain.replace(/\.(vercel\.app|netlify\.app)$/, "").toLowerCase().replace(/[^a-z0-9-]/g, "-")
      : projectName;
    
    let liveUrl = "";
    let deployId = "";

    await appendLog(`Provider: ${provider} | Project: ${projectName} | Desired subdomain: ${desiredSubdomain} | Source: ${project.source_type}`);

    if (provider === "vercel") {
      // Check project existence
      await appendLog("Checking Vercel project...");
      const checkRes = await fetch(`https://api.vercel.com/v9/projects/${desiredSubdomain}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const nameExists = checkRes.status !== 404;
      await checkRes.text();
      await appendLog(nameExists ? `"${desiredSubdomain}" exists — deploying to it.` : `"${desiredSubdomain}" is new.`);

      if (project.source_type === "github" && project.github_url) {
        const match = project.github_url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) throw new Error("Invalid GitHub URL");
        const repoOrg = match[1];
        const repoName = match[2].replace(/\.git$/, "");

        await appendLog("Setting up GitHub deployment...", { status: "deploying" });

        if (!nameExists) {
          const cr = await fetch("https://api.vercel.com/v10/projects", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              name: desiredSubdomain,
              framework: project.framework?.toLowerCase() === "next.js" ? "nextjs" : project.framework?.toLowerCase() === "react" ? "vite" : null,
              gitRepository: { type: "github", repo: `${repoOrg}/${repoName}` },
              buildCommand: project.build_command || undefined,
              outputDirectory: project.output_dir || undefined,
            }),
          });
          const pd = await cr.json();
          if (!cr.ok && pd?.error?.code !== "project_already_exists") {
            await appendLog(`Create error: ${JSON.stringify(pd)}`);
            throw new Error(`Project creation failed: ${JSON.stringify(pd)}`);
          }
          await appendLog("Project created ✓");
        }

        await appendLog("Triggering GitHub deployment...");
        const dr = await fetch("https://api.vercel.com/v13/deployments", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: desiredSubdomain,
            gitSource: { type: "github", org: repoOrg, repo: repoName, ref: "main" },
          }),
        });
        const dd = await dr.json();
        if (!dr.ok) { await appendLog(`Deploy error: ${JSON.stringify(dd)}`); throw new Error(`Deploy failed: ${JSON.stringify(dd)}`); }

        deployId = dd.id;
        liveUrl = `https://${dd.url}`;
        await appendLog(`Deployment ${deployId} → ${liveUrl}`);

        // Poll
        let attempts = 0;
        while (attempts < 60) {
          await new Promise((r) => setTimeout(r, 5000));
          const sr = await fetch(`https://api.vercel.com/v13/deployments/${deployId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const sd = await sr.json();
          await appendLog(`Build: ${sd.readyState}`);
          if (sd.readyState === "READY") { liveUrl = `https://${sd.url}`; await appendLog(`Live ✓ → ${liveUrl}`); break; }
          if (sd.readyState === "ERROR" || sd.readyState === "CANCELED") {
            throw new Error(`Build failed: ${sd.errorMessage || sd.readyState}`);
          }
          attempts++;
        }

      } else if (project.source_type === "zip") {
        await appendLog("Processing ZIP upload...", { status: "deploying" });

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
        await appendLog(`ZIP downloaded: ${zipBuffer.byteLength} bytes. Extracting...`);

        let extractedFiles: Array<{ file: string; data: string; encoding: string }>;
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

        const fileNames = extractedFiles.slice(0, 10).map((f) => f.file);
        await appendLog(`Files: ${fileNames.join(", ")}${extractedFiles.length > 10 ? ` ...+${extractedFiles.length - 10} more` : ""}`);

        const needsBuild = detectBuildNeeded(extractedFiles);
        await appendLog(needsBuild ? "Build-required project detected (has package.json)" : "Static project detected — no build step");

        // Create or ensure the Vercel project exists with the desired name
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

        await appendLog("Sending files to Vercel...");

        const dr = await fetch("https://api.vercel.com/v13/deployments", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(deployPayload),
        });

        const dd = await dr.json();
        if (!dr.ok) {
          await appendLog(`Deploy error: ${JSON.stringify(dd)}`);

          // If build fails, retry as static deployment
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
            liveUrl = `https://${sd.url}`;
            // The production URL should be desiredSubdomain.vercel.app
            const productionUrl = `https://${desiredSubdomain}.vercel.app`;
            await appendLog(`Live ✓ → ${productionUrl}`);
            liveUrl = productionUrl;
            break;
          }
          if (sd.readyState === "ERROR" || sd.readyState === "CANCELED") {
            const errDetail = sd.errorMessage || sd.readyState;
            await appendLog(`Build error: ${errDetail}`);
            // If build error, retry without build command
            if (needsBuild && !deployPayload._retriedStatic) {
              await appendLog("Retrying as static site (no build)...");
              delete deployPayload.projectSettings;
              deployPayload._retriedStatic = true;
              const retryRes = await fetch("https://api.vercel.com/v13/deployments", {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify(deployPayload),
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
      }

    } else if (provider === "netlify") {
      await appendLog("Starting Netlify deployment...", { status: "deploying" });
      
      // Use customDomain subdomain or generate unique name to avoid reserved words
      let siteName = desiredSubdomain;
      
      // Always try with the desired name first, if it fails with reserved word, add suffix
      const createSite = async (name: string): Promise<any> => {
        const res = await fetch("https://api.netlify.com/api/v1/sites", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await res.json();
        return { ok: res.ok, data };
      };

      if (project.source_type === "github" && project.github_url) {
        await appendLog("Creating Netlify site from GitHub...");
        const cr = await fetch("https://api.netlify.com/api/v1/sites", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: siteName,
            repo: {
              provider: "github",
              repo: project.github_url.replace("https://github.com/", ""),
              branch: "main",
              cmd: project.build_command || "npm run build",
              dir: project.output_dir || "dist",
            },
          }),
        });
        let sd = await cr.json();
        
        // If reserved word error, retry with unique suffix
        if (!cr.ok) {
          const errStr = JSON.stringify(sd);
          if (errStr.includes("reserved word") || errStr.includes("subdomain")) {
            siteName = generateUniqueSiteName(siteName);
            await appendLog(`"${desiredSubdomain}" is reserved. Trying "${siteName}"...`);
            const retryRes = await fetch("https://api.netlify.com/api/v1/sites", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                name: siteName,
                repo: {
                  provider: "github",
                  repo: project.github_url.replace("https://github.com/", ""),
                  branch: "main",
                  cmd: project.build_command || "npm run build",
                  dir: project.output_dir || "dist",
                },
              }),
            });
            sd = await retryRes.json();
            if (!retryRes.ok) throw new Error(`Netlify error: ${JSON.stringify(sd)}`);
          } else {
            throw new Error(`Netlify error: ${errStr}`);
          }
        }
        
        deployId = sd.id;
        liveUrl = sd.ssl_url || sd.url || `https://${siteName}.netlify.app`;
        await appendLog(`Site live: ${liveUrl}`);

      } else if (project.source_type === "zip") {
        await appendLog(`Creating Netlify site "${siteName}"...`);
        
        let result = await createSite(siteName);
        
        // If reserved word or taken, retry with unique suffix
        if (!result.ok) {
          const errStr = JSON.stringify(result.data);
          if (errStr.includes("reserved") || errStr.includes("subdomain") || errStr.includes("taken")) {
            siteName = generateUniqueSiteName(desiredSubdomain);
            await appendLog(`"${desiredSubdomain}" is reserved/taken. Trying "${siteName}"...`);
            result = await createSite(siteName);
            if (!result.ok) throw new Error(`Site creation failed: ${JSON.stringify(result.data)}`);
          } else {
            throw new Error(`Site creation failed: ${errStr}`);
          }
        }
        
        const sd = result.data;
        await appendLog(`Site ${sd.id} created as "${siteName}". Uploading ZIP...`);
        
        const { data: fileList } = await supabase.storage.from("project-uploads")
          .list(project.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

        if (fileList && fileList.length > 0) {
          const { data: fileData } = await supabase.storage.from("project-uploads").download(`${project.user_id}/${fileList[0].name}`);
          if (fileData) {
            // Extract ZIP and check if it needs building
            const zipBuffer = await fileData.arrayBuffer();
            let extractedFiles: Array<{ file: string; data: string; encoding: string }> = [];
            let needsBuild = false;
            
            try {
              extractedFiles = extractZipFiles(zipBuffer);
              needsBuild = detectBuildNeeded(extractedFiles);
            } catch {
              // If extraction fails, deploy raw zip
            }

            if (needsBuild) {
              // For build-required projects on Netlify, we need to deploy via their build system
              // Upload the zip as a deploy with build settings
              await appendLog("Build-required project. Deploying with build...");
              
              // Re-download fresh copy for upload
              const { data: freshFile } = await supabase.storage.from("project-uploads").download(`${project.user_id}/${fileList[0].name}`);
              if (freshFile) {
                const dr = await fetch(`https://api.netlify.com/api/v1/sites/${sd.id}/deploys`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/zip" },
                  body: freshFile,
                });
                const dd = await dr.json();
                if (!dr.ok) {
                  await appendLog(`Deploy error: ${JSON.stringify(dd)}`);
                  throw new Error(`Deploy failed: ${JSON.stringify(dd)}`);
                }
                await appendLog("ZIP uploaded ✓");
                
                // Poll Netlify deploy status
                if (dd.id) {
                  let pollAttempts = 0;
                  while (pollAttempts < 40) {
                    await new Promise((r) => setTimeout(r, 4000));
                    const statusRes = await fetch(`https://api.netlify.com/api/v1/deploys/${dd.id}`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    const statusData = await statusRes.json();
                    await appendLog(`Build: ${statusData.state}`);
                    if (statusData.state === "ready") {
                      liveUrl = statusData.ssl_url || statusData.url || `https://${siteName}.netlify.app`;
                      await appendLog(`Live ✓ → ${liveUrl}`);
                      break;
                    }
                    if (statusData.state === "error") {
                      throw new Error(`Netlify build failed: ${statusData.error_message || "Unknown error"}`);
                    }
                    pollAttempts++;
                  }
                }
              }
            } else {
              // Static site - direct deploy
              const { data: freshFile } = await supabase.storage.from("project-uploads").download(`${project.user_id}/${fileList[0].name}`);
              if (freshFile) {
                const dr = await fetch(`https://api.netlify.com/api/v1/sites/${sd.id}/deploys`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/zip" },
                  body: freshFile,
                });
                const dd = await dr.json();
                if (!dr.ok) throw new Error(`Deploy failed: ${JSON.stringify(dd)}`);
                await appendLog("ZIP uploaded ✓");
              }
            }
          }
        }
        
        deployId = sd.id;
        if (!liveUrl) {
          liveUrl = sd.ssl_url || sd.url || `https://${siteName}.netlify.app`;
        }
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
