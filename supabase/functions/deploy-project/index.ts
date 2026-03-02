import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      if (!delId) throw new Error("Missing deploymentId for delete");
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
        const data = available ? null : await res.json();
        return json({ success: true, available, projectName, existing: data?.name });
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
        // Check if domain is available for registration / can be added
        const res = await fetch(`https://api.vercel.com/v4/domains/status?name=${encodeURIComponent(domain)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        return json({ success: true, domain, available: data?.available ?? true, status: data });
      }
      if (provider === "netlify") {
        // Netlify subdomains are <name>.netlify.app — check if site name is taken
        const siteName = domain.replace(/\.netlify\.app$/, "");
        const res = await fetch(`https://api.netlify.com/api/v1/sites?name=${siteName}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const sites = await res.json();
        return json({ success: true, domain, available: !Array.isArray(sites) || sites.length === 0 });
      }
      return json({ success: true, domain, available: true });
    }

    // ── List domains for a Vercel project ──
    if (action === "list-domains") {
      const { projectName, token, provider } = body;
      if (!projectName || !token) throw new Error("Missing projectName or token");

      if (provider === "vercel") {
        const res = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}/domains`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          return json({ success: true, domains: data?.domains || [] });
        }
        return json({ success: true, domains: [] });
      }
      return json({ success: true, domains: [] });
    }

    // ── Add domain to a deployed project ──
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
      return json({ success: false, error: "Domain management not supported for this provider" }, 400);
    }

    // ══════════════════════════════════════
    // ── Deploy action ──
    // ══════════════════════════════════════
    deploymentId = body.deploymentId;
    const { projectId, connectionId, customDomain } = body;

    if (!deploymentId || !projectId || !connectionId) {
      throw new Error(`Missing required fields: deploymentId=${deploymentId}, projectId=${projectId}, connectionId=${connectionId}`);
    }

    const appendLog = async (log: string, extraFields?: Record<string, any>) => {
      const { data: current } = await supabase.from("deployments").select("logs").eq("id", deploymentId!).single();
      const existingLogs = current?.logs || "";
      const timestamp = new Date().toISOString().slice(11, 19);
      const newLogs = existingLogs + `[${timestamp}] ${log}\n`;
      await supabase.from("deployments").update({ logs: newLogs, ...extraFields }).eq("id", deploymentId!);
    };

    await appendLog("Fetching deployment details...", { status: "building" });

    const { data: deployment, error: depErr } = await supabase.from("deployments").select("*").eq("id", deploymentId).single();
    if (depErr) { await appendLog(`ERROR: ${depErr.message}`); throw new Error(depErr.message); }

    const { data: project, error: projErr } = await supabase.from("projects").select("*").eq("id", projectId).single();
    if (projErr) { await appendLog(`ERROR: ${projErr.message}`); throw new Error(projErr.message); }

    const { data: connection, error: connErr } = await supabase.from("cloud_connections").select("*").eq("id", connectionId).single();
    if (connErr) { await appendLog(`ERROR: ${connErr.message}`); throw new Error(connErr.message); }

    if (!deployment || !project || !connection) {
      throw new Error(`Data missing: deployment=${!!deployment}, project=${!!project}, connection=${!!connection}`);
    }

    const provider = connection.provider;
    const token = connection.token;
    const projectName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    let liveUrl = "";
    let deployId = "";

    await appendLog(`Provider: ${provider} | Project: ${projectName} | Source: ${project.source_type}`);

    if (provider === "vercel") {
      // ── Check name ──
      await appendLog("Checking project availability on Vercel...");
      const checkRes = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const nameExists = checkRes.status !== 404;
      await appendLog(nameExists ? `Project "${projectName}" exists — deploying to it.` : `Project "${projectName}" available — creating.`);

      if (project.source_type === "github" && project.github_url) {
        const match = project.github_url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) throw new Error("Invalid GitHub URL");
        const repoOrg = match[1];
        const repoName = match[2].replace(/\.git$/, "");

        await appendLog("Setting up Vercel project from GitHub...", { status: "deploying" });

        if (!nameExists) {
          const createRes = await fetch("https://api.vercel.com/v10/projects", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              name: projectName,
              framework: project.framework?.toLowerCase() === "next.js" ? "nextjs" : project.framework?.toLowerCase() === "react" ? "vite" : null,
              gitRepository: { type: "github", repo: `${repoOrg}/${repoName}` },
              buildCommand: project.build_command || undefined,
              outputDirectory: project.output_dir || undefined,
            }),
          });
          const pd = await createRes.json();
          if (!createRes.ok && pd?.error?.code !== "project_already_exists") {
            await appendLog(`Project creation error: ${JSON.stringify(pd)}`);
            throw new Error(`Vercel project creation failed: ${JSON.stringify(pd)}`);
          }
          await appendLog("Vercel project created ✓");
        }

        await appendLog("Triggering deployment from GitHub...");
        const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName,
            gitSource: { type: "github", org: repoOrg, repo: repoName, ref: "main" },
          }),
        });
        const dd = await deployRes.json();
        if (!deployRes.ok) {
          await appendLog(`Deploy error: ${JSON.stringify(dd)}`);
          throw new Error(`Deploy failed: ${JSON.stringify(dd)}`);
        }
        deployId = dd.id;
        liveUrl = `https://${dd.url}`;
        await appendLog(`Deployment ${deployId} created → ${liveUrl}`);

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
          if (sd.readyState === "ERROR" || sd.readyState === "CANCELED") throw new Error(`Build failed: ${sd.errorMessage || sd.readyState}`);
          attempts++;
        }

      } else if (project.source_type === "zip") {
        await appendLog("Processing ZIP for Vercel...", { status: "deploying" });

        const { data: fileList } = await supabase.storage
          .from("project-uploads")
          .list(project.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

        if (!fileList || fileList.length === 0) throw new Error("No uploaded files found");

        const latestFile = fileList[0];
        await appendLog(`File: ${latestFile.name}`);

        const filePath = `${project.user_id}/${latestFile.name}`;
        const { data: fileData, error: dlErr } = await supabase.storage.from("project-uploads").download(filePath);
        if (dlErr || !fileData) throw new Error(`Download failed: ${dlErr?.message}`);

        await appendLog("Downloaded. Converting & deploying...");

        const fileContent = await fileData.arrayBuffer();
        const base64Content = arrayBufferToBase64(fileContent);
        await appendLog(`File size: ${fileContent.byteLength} bytes, base64 length: ${base64Content.length}`);

        const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName,
            files: [{
              file: "index.html",
              data: base64Content.length > 1000000
                ? arrayBufferToBase64(new TextEncoder().encode("<html><body><h1>Project uploaded</h1><p>Large ZIP — use GitHub for builds.</p></body></html>").buffer)
                : base64Content,
              encoding: "base64",
            }],
            projectSettings: {
              buildCommand: project.build_command || "npm run build",
              outputDirectory: project.output_dir || "dist",
              framework: project.framework?.toLowerCase() === "react" ? "vite" : null,
            },
          }),
        });

        const dd = await deployRes.json();
        if (!deployRes.ok) { await appendLog(`Deploy error: ${JSON.stringify(dd)}`); throw new Error(`Deploy failed: ${JSON.stringify(dd)}`); }

        deployId = dd.id;
        liveUrl = `https://${dd.url}`;
        await appendLog(`Deployment ${deployId} created`);

        let attempts = 0;
        while (attempts < 30) {
          await new Promise((r) => setTimeout(r, 3000));
          const sr = await fetch(`https://api.vercel.com/v13/deployments/${deployId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const sd = await sr.json();
          await appendLog(`Build: ${sd.readyState}`);
          if (sd.readyState === "READY") { liveUrl = `https://${sd.url}`; await appendLog(`Live ✓ → ${liveUrl}`); break; }
          if (sd.readyState === "ERROR" || sd.readyState === "CANCELED") throw new Error(`Build failed: ${sd.errorMessage || sd.readyState}`);
          attempts++;
        }
      }

      // ── Add custom domain if provided ──
      if (customDomain && projectName) {
        await appendLog(`Adding custom domain: ${customDomain}...`);
        const domRes = await fetch(`https://api.vercel.com/v10/projects/${encodeURIComponent(projectName)}/domains`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: customDomain }),
        });
        const domData = await domRes.json();
        if (domRes.ok) {
          await appendLog(`Domain ${customDomain} added ✓`);
        } else {
          await appendLog(`Domain add warning: ${domData?.error?.message || JSON.stringify(domData)}`);
        }
      }

    } else if (provider === "netlify") {
      await appendLog("Starting Netlify deployment...", { status: "deploying" });
      const siteName = customDomain
        ? customDomain.replace(/\.netlify\.app$/, "")
        : `${projectName}-${Date.now()}`;

      if (project.source_type === "github" && project.github_url) {
        await appendLog("Creating Netlify site from GitHub...");
        const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
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
        const sd = await createRes.json();
        if (!createRes.ok) { await appendLog(`Netlify error: ${JSON.stringify(sd)}`); throw new Error(`Netlify: ${JSON.stringify(sd)}`); }
        deployId = sd.id;
        liveUrl = sd.ssl_url || sd.url || `https://${siteName}.netlify.app`;
        await appendLog(`Site live: ${liveUrl}`);
      } else if (project.source_type === "zip") {
        await appendLog("Creating Netlify site...");
        const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: siteName }),
        });
        const sd = await createRes.json();
        if (!createRes.ok) throw new Error(`Netlify creation failed: ${JSON.stringify(sd)}`);

        await appendLog(`Site ${sd.id} created. Uploading...`);
        const { data: fileList } = await supabase.storage.from("project-uploads")
          .list(project.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

        if (fileList && fileList.length > 0) {
          const { data: fileData } = await supabase.storage.from("project-uploads").download(`${project.user_id}/${fileList[0].name}`);
          if (fileData) {
            const dr = await fetch(`https://api.netlify.com/api/v1/sites/${sd.id}/deploys`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/zip" },
              body: fileData,
            });
            const dd = await dr.json();
            if (!dr.ok) throw new Error(`Netlify deploy failed: ${JSON.stringify(dd)}`);
            await appendLog("ZIP uploaded ✓");
          }
        }
        deployId = sd.id;
        liveUrl = sd.ssl_url || sd.url || `https://${siteName}.netlify.app`;
      }
    }

    await appendLog("Deployment successful! ✅", { status: "live", live_url: liveUrl, deploy_id: deployId });
    await supabase.from("projects").update({ status: "live" }).eq("id", projectId);

    return json({ success: true, url: liveUrl });
  } catch (error: any) {
    console.error("Deployment error:", error);
    if (deploymentId) {
      const { data: current } = await supabase.from("deployments").select("logs").eq("id", deploymentId).single();
      const existingLogs = current?.logs || "";
      const ts = new Date().toISOString().slice(11, 19);
      await supabase.from("deployments").update({
        status: "error",
        error_message: error.message,
        logs: existingLogs + `[${ts}] ❌ ERROR: ${error.message}\n`,
      }).eq("id", deploymentId);
    }
    return json({ success: false, error: error.message }, 500);
  }
});
