import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import { Link } from "react-router-dom";
import { Plus, Cloud, FolderGit2, Rocket, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ projects: 0, connections: 0, deployments: 0, live: 0 });
  const [recentDeployments, setRecentDeployments] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [pRes, cRes, dRes] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("cloud_connections").select("id", { count: "exact", head: true }),
        supabase.from("deployments").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      const liveRes = await supabase.from("deployments").select("id", { count: "exact", head: true }).eq("status", "live");
      setStats({
        projects: pRes.count || 0,
        connections: cRes.count || 0,
        deployments: (dRes.data?.length) || 0,
        live: liveRes.count || 0,
      });
      setRecentDeployments(dRes.data || []);
    };
    load();
  }, [user]);

  const statCards = [
    { label: "Projects", value: stats.projects, icon: FolderGit2, color: "text-primary" },
    { label: "Connections", value: stats.connections, icon: Cloud, color: "text-info" },
    { label: "Deployments", value: stats.deployments, icon: Rocket, color: "text-warning" },
    { label: "Live", value: stats.live, icon: ArrowUpRight, color: "text-success" },
  ];

  return (
    <DashboardLayout>
      <div className="p-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Overview of your deployments</p>
          </div>
          <Link to="/projects">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </Link>
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

        {/* Recent Deployments */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <h2 className="font-semibold">Recent Deployments</h2>
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
                    <span className="text-sm font-medium">{d.provider}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {d.live_url && (
                      <a href={d.live_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        {d.live_url}
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
