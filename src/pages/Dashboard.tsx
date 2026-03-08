import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { Plus, Cloud, FolderGit2, Rocket, ArrowUpRight, Activity, Plug, Server, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ projects: 0, connections: 0, deployments: 0, live: 0, errors: 0, frontendConns: 0, backendConns: 0 });
  const [recentDeployments, setRecentDeployments] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [pRes, cRes, dRes] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("cloud_connections").select("*"),
        supabase.from("deployments").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      const liveRes = await supabase.from("deployments").select("id", { count: "exact", head: true }).eq("status", "live");
      const errorRes = await supabase.from("deployments").select("id", { count: "exact", head: true }).eq("status", "error");

      const conns = cRes.data || [];
      const frontendConns = conns.filter((c) => ["vercel", "netlify"].includes(c.provider)).length;
      const backendConns = conns.filter((c) => ["render", "railway"].includes(c.provider)).length;

      setStats({
        projects: pRes.count || 0,
        connections: conns.length,
        deployments: (dRes.data?.length) || 0,
        live: liveRes.count || 0,
        errors: errorRes.count || 0,
        frontendConns,
        backendConns,
      });
      setRecentDeployments(dRes.data || []);
    };
    load();
  }, [user]);

  const statCards = [
    { label: "Projects", value: stats.projects, icon: FolderGit2, color: "text-primary" },
    { label: "Connections", value: stats.connections, icon: Plug, color: "text-blue-400" },
    { label: "Live Deploys", value: stats.live, icon: ArrowUpRight, color: "text-green-400" },
    { label: "Errors", value: stats.errors, icon: Activity, color: "text-red-400" },
  ];

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Overview of your deployments</p>
          </div>
          <div className="flex gap-3">
            <Link to="/monitoring">
              <Button variant="outline"><Activity className="h-4 w-4 mr-2" />Monitor</Button>
            </Link>
            <Link to="/projects">
              <Button><Plus className="h-4 w-4 mr-2" />New Project</Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="glass-card rounded-xl p-5 animate-slide-up">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="text-3xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Connection Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Frontend Deployment</h3>
            </div>
            <p className="text-2xl font-bold mb-1">{stats.frontendConns}</p>
            <p className="text-xs text-muted-foreground">Vercel, Netlify connections</p>
          </div>
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Server className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Backend Deployment</h3>
            </div>
            <p className="text-2xl font-bold mb-1">{stats.backendConns}</p>
            <p className="text-xs text-muted-foreground">Render, Railway connections</p>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="glass-card rounded-xl p-5 mb-8">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" /> Coming Soon
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {["AWS", "Google Cloud", "Azure"].map((name) => (
              <div key={name} className="rounded-lg border border-border/50 p-3 opacity-50">
                <p className="text-sm font-medium">{name}</p>
                <span className="text-[10px] font-mono text-muted-foreground">Coming Soon</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Deployments */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Recent Deployments</h2>
            <Link to="/monitoring" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          {recentDeployments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Rocket className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No deployments yet. Create a project to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentDeployments.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={d.status} />
                    <span className="text-sm font-medium capitalize">{d.provider}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {d.live_url && (
                      <a href={d.live_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        {d.live_url.replace("https://", "")}
                      </a>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
