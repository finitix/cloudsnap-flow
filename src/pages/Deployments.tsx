import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import { Rocket, ExternalLink } from "lucide-react";

export default function Deployments() {
  const { user } = useAuth();
  const [deployments, setDeployments] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("deployments").select("*, projects(name)").order("created_at", { ascending: false }).then(({ data }) => {
      setDeployments(data || []);
    });

    const channel = supabase
      .channel("all-deployments")
      .on("postgres_changes", { event: "*", schema: "public", table: "deployments" }, () => {
        supabase.from("deployments").select("*, projects(name)").order("created_at", { ascending: false }).then(({ data }) => {
          setDeployments(data || []);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Deployments</h1>
          <p className="text-muted-foreground text-sm mt-1">All your deployments in one place</p>
        </div>

        {deployments.length === 0 ? (
          <div className="glass-card rounded-xl p-16 text-center">
            <Rocket className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h3 className="font-semibold mb-2">No deployments yet</h3>
            <p className="text-sm text-muted-foreground">Deploy a project to see it here</p>
          </div>
        ) : (
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="divide-y divide-border">
              {deployments.map((d) => (
                <div key={d.id} className="p-5 flex items-center justify-between hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-4">
                    <StatusBadge status={d.status} />
                    <div>
                      <p className="font-medium text-sm">{(d as any).projects?.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{d.provider}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {d.live_url && (
                      <a href={d.live_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                        {d.live_url} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
