import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Handle delete deployment
    if (action === "delete") {
      const { deploymentId: delId } = body;
      if (!delId) throw new Error("Missing deploymentId for delete");
      const { error } = await supabase.from("deployments").delete().eq("id", delId);
      if (error) throw new Error(`Delete failed: ${error.message}`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle check name availability
    if (action === "check-name") {
      const { name, provider, token } = body;
      if (!name || !token) throw new Error("Missing name or token");
      const projectName = name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

      if (provider === "vercel") {
        const res = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const available = res.status === 404;
        const data = res.status === 404 ? null : await res.json();
        return new Response(
          JSON.stringify({ success: true, available, projectName, existing: data?.name }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else if (provider === "netlify") {
        const res = await fetch(`https://api.netlify.com/api/v1/sites?name=${projectName}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const sites = await res.json();
        const available = !Array.isArray(sites) || sites.length === 0;
        return new Response(
          JSON.stringify({ success: true, available, projectName }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ success: true, available: true, projectName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deploy action
    deploymentId = body.deploymentId;
    const { projectId, connectionId } = body;

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

    // Fetch data with explicit error handling
    const { data: deployment, error: depErr } = await supabase
      .from("deployments").select("*").eq("id", deploymentId).single();
    if (depErr) {
      await appendLog(`ERROR fetching deployment: ${depErr.message}`);
      throw new Error(`Failed to fetch deployment: ${depErr.message}`);
    }

    const { data: project, error: projErr } = await supabase
      .from("projects").select("*").eq("id", projectId).single();
    if (projErr) {
      await appendLog(`ERROR fetching project: ${projErr.message}`);
      throw new Error(`Failed to fetch project: ${projErr.message}`);
    }

    const { data: connection, error: connErr } = await supabase
      .from("cloud_connections").select("*").eq("id", connectionId).single();
    if (connErr) {
      await appendLog(`ERROR fetching connection: ${connErr.message}`);
      throw new Error(`Failed to fetch connection: ${connErr.message}`);
    }

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
      // Check if project name is available
      await appendLog("Checking project name availability on Vercel...");
      const checkRes = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const nameExists = checkRes.status !== 404;
      await appendLog(nameExists ? `Project "${projectName}" already exists on Vercel, will deploy to it.` : `Project "${projectName}" is available.`);

      if (project.source_type === "github" && project.github_url) {
        const match = project.github_url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) throw new Error("Invalid GitHub URL");
        const repoOrg = match[1];
        const repoName = match[2].replace(/\.git$/, "");

        await appendLog("Creating Vercel project from GitHub...", { status: "deploying" });

        if (!nameExists) {
          const createProjectRes = await fetch("https://api.vercel.com/v10/projects", {
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
          const projectData = await createProjectRes.json();
          if (!createProjectRes.ok && projectData?.error?.code !== "project_already_exists") {
            await appendLog(`Vercel project creation error: ${JSON.stringify(projectData)}`);
            throw new Error(`Vercel project creation failed: ${JSON.stringify(projectData)}`);
          }
          await appendLog("Vercel project created successfully.");
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
        const deployData = await deployRes.json();
        if (!deployRes.ok) {
          await appendLog(`Vercel deploy error: ${JSON.stringify(deployData)}`);
          throw new Error(`Vercel deploy failed: ${JSON.stringify(deployData)}`);
        }

        deployId = deployData.id;
        liveUrl = `https://${deployData.url}`;
        await appendLog(`Deployment created: ${deployId} | URL: ${liveUrl}`);

        // Poll for completion
        let attempts = 0;
        while (attempts < 60) {
          await new Promise((r) => setTimeout(r, 5000));
          const statusRes = await fetch(`https://api.vercel.com/v13/deployments/${deployId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const statusData = await statusRes.json();
          await appendLog(`Build state: ${statusData.readyState}`);

          if (statusData.readyState === "READY") {
            liveUrl = `https://${statusData.url}`;
            await appendLog(`Build complete! Live at: ${liveUrl}`);
            break;
          }
          if (statusData.readyState === "ERROR" || statusData.readyState === "CANCELED") {
            throw new Error(`Vercel build failed: ${statusData.errorMessage || statusData.readyState}`);
          }
          attempts++;
        }
      } else if (project.source_type === "zip") {
        await appendLog("Processing ZIP upload for Vercel...", { status: "deploying" });

        const { data: fileList } = await supabase.storage
          .from("project-uploads")
          .list(project.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

        if (!fileList || fileList.length === 0) {
          throw new Error("No uploaded files found for this project");
        }

        const latestFile = fileList[0];
        await appendLog(`Found file: ${latestFile.name} (${latestFile.metadata?.size || "unknown"} bytes)`);

        const filePath = `${project.user_id}/${latestFile.name}`;
        const { data: fileData, error: downloadError } = await supabase.storage.from("project-uploads").download(filePath);
        if (downloadError || !fileData) {
          throw new Error(`Failed to download: ${downloadError?.message}`);
        }

        await appendLog("File downloaded. Creating Vercel deployment...");

        const fileContent = await fileData.arrayBuffer();
        const base64Content = btoa(String.fromCharCode(...new Uint8Array(fileContent)));

        const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName,
            files: [
              {
                file: "index.html",
                data: base64Content.length > 1000000
                  ? btoa("<html><body><h1>Project uploaded</h1><p>Large ZIP - connect via GitHub for full builds.</p></body></html>")
                  : base64Content,
                encoding: "base64",
              },
            ],
            projectSettings: {
              buildCommand: project.build_command || "npm run build",
              outputDirectory: project.output_dir || "dist",
              framework: project.framework?.toLowerCase() === "react" ? "vite" : null,
            },
          }),
        });

        const deployData = await deployRes.json();
        if (!deployRes.ok) {
          await appendLog(`Vercel deploy error: ${JSON.stringify(deployData)}`);
          throw new Error(`Vercel deploy failed: ${JSON.stringify(deployData)}`);
        }

        deployId = deployData.id;
        liveUrl = `https://${deployData.url}`;
        await appendLog(`Deployment created: ${deployId}`);

        let attempts = 0;
        while (attempts < 30) {
          await new Promise((r) => setTimeout(r, 3000));
          const statusRes = await fetch(`https://api.vercel.com/v13/deployments/${deployId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const statusData = await statusRes.json();
          await appendLog(`Build state: ${statusData.readyState}`);

          if (statusData.readyState === "READY") {
            liveUrl = `https://${statusData.url}`;
            await appendLog(`Build complete! Live at: ${liveUrl}`);
            break;
          }
          if (statusData.readyState === "ERROR" || statusData.readyState === "CANCELED") {
            throw new Error(`Build failed: ${statusData.errorMessage || statusData.readyState}`);
          }
          attempts++;
        }
      }
    } else if (provider === "netlify") {
      await appendLog("Starting Netlify deployment...", { status: "deploying" });

      if (project.source_type === "github" && project.github_url) {
        await appendLog("Creating Netlify site from GitHub...");
        const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${projectName}-${Date.now()}`,
            repo: {
              provider: "github",
              repo: project.github_url.replace("https://github.com/", ""),
              branch: "main",
              cmd: project.build_command || "npm run build",
              dir: project.output_dir || "dist",
            },
          }),
        });
        const siteData = await createRes.json();
        if (!createRes.ok) {
          await appendLog(`Netlify error: ${JSON.stringify(siteData)}`);
          throw new Error(`Netlify API error: ${JSON.stringify(siteData)}`);
        }
        deployId = siteData.id;
        liveUrl = siteData.ssl_url || siteData.url || `https://${projectName}.netlify.app`;
        await appendLog(`Site created: ${liveUrl}`);
      } else if (project.source_type === "zip") {
        await appendLog("Creating Netlify site for ZIP deploy...");
        const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: `${projectName}-${Date.now()}` }),
        });
        const siteData = await createRes.json();
        if (!createRes.ok) throw new Error(`Netlify site creation failed: ${JSON.stringify(siteData)}`);

        await appendLog(`Site created: ${siteData.id}. Uploading files...`);

        const { data: fileList } = await supabase.storage
          .from("project-uploads")
          .list(project.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

        if (fileList && fileList.length > 0) {
          const filePath = `${project.user_id}/${fileList[0].name}`;
          const { data: fileData } = await supabase.storage.from("project-uploads").download(filePath);
          if (fileData) {
            const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteData.id}/deploys`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/zip" },
              body: fileData,
            });
            const deployData = await deployRes.json();
            if (!deployRes.ok) throw new Error(`Netlify deploy failed: ${JSON.stringify(deployData)}`);
            await appendLog("ZIP uploaded successfully.");
          }
        }

        deployId = siteData.id;
        liveUrl = siteData.ssl_url || siteData.url || `https://${projectName}.netlify.app`;
      }
    }

    await appendLog("Deployment successful! ✅", {
      status: "live",
      live_url: liveUrl,
      deploy_id: deployId,
    });

    await supabase.from("projects").update({ status: "live" }).eq("id", projectId);

    return new Response(JSON.stringify({ success: true, url: liveUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Deployment error:", error);

    if (deploymentId) {
      const { data: current } = await supabase.from("deployments").select("logs").eq("id", deploymentId).single();
      const existingLogs = current?.logs || "";
      const timestamp = new Date().toISOString().slice(11, 19);
      await supabase.from("deployments").update({
        status: "error",
        error_message: error.message,
        logs: existingLogs + `[${timestamp}] ❌ ERROR: ${error.message}\n`,
      }).eq("id", deploymentId);
    }

    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
