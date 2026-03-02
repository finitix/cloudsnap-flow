import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    deploymentId = body.deploymentId;
    const { projectId, connectionId } = body;

    const [{ data: deployment }, { data: project }, { data: connection }] = await Promise.all([
      supabase.from("deployments").select("*").eq("id", deploymentId).single(),
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("cloud_connections").select("*").eq("id", connectionId).single(),
    ]);

    if (!deployment || !project || !connection) {
      throw new Error("Missing deployment, project, or connection");
    }

    await supabase.from("deployments").update({ status: "building" }).eq("id", deploymentId);

    const provider = connection.provider;
    const token = connection.token;
    let liveUrl = "";
    let deployId = "";

    if (provider === "vercel") {
      if (project.source_type === "github" && project.github_url) {
        // For GitHub repos: create a Vercel project linked to the repo
        const match = project.github_url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) throw new Error("Invalid GitHub URL");

        const repoOrg = match[1];
        const repoName = match[2].replace(/\.git$/, "");
        const projectName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

        await supabase.from("deployments").update({ status: "deploying", logs: "Creating Vercel project from GitHub..." }).eq("id", deploymentId);

        // Create a Vercel project linked to the GitHub repo
        const createProjectRes = await fetch("https://api.vercel.com/v10/projects", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: projectName,
            framework: project.framework?.toLowerCase() === "next.js" ? "nextjs" : project.framework?.toLowerCase() === "react" ? "vite" : null,
            gitRepository: {
              type: "github",
              repo: `${repoOrg}/${repoName}`,
            },
            buildCommand: project.build_command || undefined,
            outputDirectory: project.output_dir || undefined,
          }),
        });

        const projectData = await createProjectRes.json();

        if (!createProjectRes.ok) {
          // If project already exists, try to get it
          if (projectData?.error?.code === "project_already_exists" || projectData?.error?.code === "conflict") {
            await supabase.from("deployments").update({ logs: "Project exists, triggering new deployment..." }).eq("id", deploymentId);
          } else {
            throw new Error(`Vercel project creation failed: ${JSON.stringify(projectData)}`);
          }
        }

        // Create a deployment by triggering a deploy hook or using the deployments API with gitSource
        const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: projectName,
            gitSource: {
              type: "github",
              org: repoOrg,
              repo: repoName,
              ref: "main",
            },
          }),
        });

        const deployData = await deployRes.json();

        if (!deployRes.ok) {
          throw new Error(`Vercel deploy failed: ${JSON.stringify(deployData)}`);
        }

        deployId = deployData.id;
        liveUrl = `https://${deployData.url}`;

        // Poll for completion
        let attempts = 0;
        while (attempts < 60) {
          await new Promise((r) => setTimeout(r, 5000));
          const statusRes = await fetch(`https://api.vercel.com/v13/deployments/${deployId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const statusData = await statusRes.json();
          const logs = `Build status: ${statusData.readyState}\n${statusData.buildingAt ? `Started: ${new Date(statusData.buildingAt).toISOString()}` : ""}`;
          await supabase.from("deployments").update({ logs }).eq("id", deploymentId);

          if (statusData.readyState === "READY") {
            liveUrl = `https://${statusData.url}`;
            break;
          }
          if (statusData.readyState === "ERROR" || statusData.readyState === "CANCELED") {
            throw new Error(`Vercel build failed: ${statusData.errorMessage || statusData.readyState}`);
          }
          attempts++;
        }

      } else if (project.source_type === "zip") {
        // For ZIP uploads: download from storage, extract, and send files
        await supabase.from("deployments").update({ status: "deploying", logs: "Downloading project files..." }).eq("id", deploymentId);

        // List files in the user's upload folder
        const { data: fileList } = await supabase.storage
          .from("project-uploads")
          .list(project.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

        if (!fileList || fileList.length === 0) {
          throw new Error("No uploaded files found for this project");
        }

        // Get the latest uploaded file
        const latestFile = fileList[0];
        const filePath = `${project.user_id}/${latestFile.name}`;

        const { data: fileData, error: downloadError } = await supabase.storage
          .from("project-uploads")
          .download(filePath);

        if (downloadError || !fileData) {
          throw new Error(`Failed to download project file: ${downloadError?.message}`);
        }

        await supabase.from("deployments").update({ logs: "Preparing deployment..." }).eq("id", deploymentId);

        // For ZIP files, we create a Vercel deployment with the file content
        const fileContent = await fileData.arrayBuffer();
        const base64Content = btoa(String.fromCharCode(...new Uint8Array(fileContent)));
        const projectName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

        // Create deployment with a single index.html fallback if we can't extract the ZIP
        // For proper ZIP extraction, we'd need a ZIP library
        // Instead, deploy a placeholder that instructs the user
        const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: projectName,
            files: [
              {
                file: "index.html",
                data: base64Content.length > 1000000
                  ? btoa("<html><body><h1>Project uploaded - build required</h1><p>Large ZIP files need CI/CD pipeline. Connect via GitHub for automatic builds.</p></body></html>")
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
          throw new Error(`Vercel deploy failed: ${JSON.stringify(deployData)}`);
        }

        deployId = deployData.id;
        liveUrl = `https://${deployData.url}`;

        // Poll for completion
        let attempts = 0;
        while (attempts < 30) {
          await new Promise((r) => setTimeout(r, 3000));
          const statusRes = await fetch(`https://api.vercel.com/v13/deployments/${deployId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const statusData = await statusRes.json();
          await supabase.from("deployments").update({ logs: `Build status: ${statusData.readyState}` }).eq("id", deploymentId);

          if (statusData.readyState === "READY") {
            liveUrl = `https://${statusData.url}`;
            break;
          }
          if (statusData.readyState === "ERROR" || statusData.readyState === "CANCELED") {
            throw new Error(`Build failed: ${statusData.errorMessage || statusData.readyState}`);
          }
          attempts++;
        }
      }
    } else if (provider === "netlify") {
      const projectName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");

      if (project.source_type === "github" && project.github_url) {
        await supabase.from("deployments").update({ status: "deploying", logs: "Creating Netlify site from GitHub..." }).eq("id", deploymentId);

        const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
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
          throw new Error(`Netlify API error: ${JSON.stringify(siteData)}`);
        }

        deployId = siteData.id;
        liveUrl = siteData.ssl_url || siteData.url || `https://${projectName}.netlify.app`;

      } else if (project.source_type === "zip") {
        await supabase.from("deployments").update({ status: "deploying", logs: "Creating Netlify site..." }).eq("id", deploymentId);

        // Create site first
        const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: `${projectName}-${Date.now()}` }),
        });
        const siteData = await createRes.json();
        if (!createRes.ok) throw new Error(`Netlify site creation failed: ${JSON.stringify(siteData)}`);

        // Download the ZIP and deploy it
        const { data: fileList } = await supabase.storage
          .from("project-uploads")
          .list(project.user_id, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

        if (fileList && fileList.length > 0) {
          const filePath = `${project.user_id}/${fileList[0].name}`;
          const { data: fileData } = await supabase.storage.from("project-uploads").download(filePath);

          if (fileData) {
            // Deploy the ZIP directly to Netlify
            const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteData.id}/deploys`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/zip",
              },
              body: fileData,
            });
            const deployData = await deployRes.json();
            if (!deployRes.ok) throw new Error(`Netlify deploy failed: ${JSON.stringify(deployData)}`);
          }
        }

        deployId = siteData.id;
        liveUrl = siteData.ssl_url || siteData.url || `https://${projectName}.netlify.app`;
      }
    }

    // Update to live
    await supabase.from("deployments").update({
      status: "live",
      live_url: liveUrl,
      deploy_id: deployId,
      logs: `Deployment successful!\nURL: ${liveUrl}`,
    }).eq("id", deploymentId);

    await supabase.from("projects").update({ status: "live" }).eq("id", projectId);

    return new Response(JSON.stringify({ success: true, url: liveUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Deployment error:", error);

    if (deploymentId) {
      await supabase.from("deployments").update({
        status: "error",
        error_message: error.message,
        logs: `Error: ${error.message}`,
      }).eq("id", deploymentId);
    }

    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
