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

  try {
    const { deploymentId, projectId, connectionId } = await req.json();

    // Get deployment, project, and connection
    const [{ data: deployment }, { data: project }, { data: connection }] = await Promise.all([
      supabase.from("deployments").select("*").eq("id", deploymentId).single(),
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("cloud_connections").select("*").eq("id", connectionId).single(),
    ]);

    if (!deployment || !project || !connection) {
      throw new Error("Missing deployment, project, or connection");
    }

    // Update to building
    await supabase.from("deployments").update({ status: "building" }).eq("id", deploymentId);

    const provider = connection.provider;
    const token = connection.token;

    let liveUrl = "";
    let deployId = "";

    if (provider === "vercel") {
      // Deploy to Vercel
      const vercelPayload: any = {
        name: project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        target: "production",
      };

      if (project.source_type === "github" && project.github_url) {
        // Extract owner/repo from URL
        const match = project.github_url.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (match) {
          vercelPayload.gitSource = {
            type: "github",
            org: match[1],
            repo: match[2],
            ref: "main",
          };
        }
      }

      await supabase.from("deployments").update({ status: "deploying", logs: "Creating Vercel deployment..." }).eq("id", deploymentId);

      const vercelRes = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(vercelPayload),
      });

      const vercelData = await vercelRes.json();

      if (!vercelRes.ok) {
        throw new Error(`Vercel API error: ${JSON.stringify(vercelData)}`);
      }

      deployId = vercelData.id;
      liveUrl = `https://${vercelData.url}`;

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
        if (statusData.readyState === "ERROR") {
          throw new Error(`Vercel build failed: ${statusData.errorMessage || "Unknown error"}`);
        }
        attempts++;
      }

    } else if (provider === "netlify") {
      // Deploy to Netlify
      await supabase.from("deployments").update({ status: "deploying", logs: "Creating Netlify site..." }).eq("id", deploymentId);

      // Create site if needed
      const siteName = project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-") + "-" + Date.now();
      const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: siteName,
          repo: project.source_type === "github" ? {
            provider: "github",
            repo: project.github_url?.replace("https://github.com/", ""),
            branch: "main",
            cmd: project.build_command || "npm run build",
            dir: project.output_dir || "dist",
          } : undefined,
        }),
      });

      const siteData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(`Netlify API error: ${JSON.stringify(siteData)}`);
      }

      deployId = siteData.id;
      liveUrl = siteData.ssl_url || siteData.url || `https://${siteName}.netlify.app`;
    }

    // Update to live
    await supabase.from("deployments").update({
      status: "live",
      live_url: liveUrl,
      deploy_id: deployId,
      logs: `Deployment successful!\nURL: ${liveUrl}`,
    }).eq("id", deploymentId);

    // Update project status
    await supabase.from("projects").update({ status: "live" }).eq("id", projectId);

    return new Response(JSON.stringify({ success: true, url: liveUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Deployment error:", error);

    // Try to update deployment with error
    try {
      const { deploymentId } = await req.clone().json().catch(() => ({}));
      if (deploymentId) {
        await supabase.from("deployments").update({
          status: "error",
          error_message: error.message,
          logs: `Error: ${error.message}`,
        }).eq("id", deploymentId);
      }
    } catch {}

    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
