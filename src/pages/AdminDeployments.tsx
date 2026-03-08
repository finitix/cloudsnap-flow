import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Rocket, Shield } from "lucide-react";

export default function AdminDeployments() {
  const { isAdmin, loading } = useAdmin();
  const [deployments, setDeployments] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("deployments").select("*").order("created_at", { ascending: false }).limit(100).then(({ data }) => setDeployments(data || []));
  }, [isAdmin]);

  if (loading) return <AdminLayout><div className="p-8 text-muted-foreground">Loading...</div></AdminLayout>;
  if (!isAdmin) return <AdminLayout><div className="p-8"><div className="glass-card rounded-xl p-12 text-center"><Shield className="h-10 w-10 mx-auto mb-4 text-destructive opacity-60" /><h2 className="text-xl font-bold">Access Denied</h2></div></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Rocket className="h-6 w-6 text-primary" /> All Deployments</h1>
          <p className="text-muted-foreground text-sm mt-1">{deployments.length} deployments</p>
        </div>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-muted-foreground font-medium">Provider</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">URL</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Retries</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {deployments.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-medium capitalize">{d.provider}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full ${
                        d.status === "live" ? "bg-green-500/15 text-green-400" :
                        d.status === "error" ? "bg-red-500/15 text-red-400" :
                        d.status === "building" ? "bg-yellow-500/15 text-yellow-400" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${
                          d.status === "live" ? "bg-green-400" : d.status === "error" ? "bg-red-400" :
                          d.status === "building" ? "bg-yellow-400 animate-pulse" : "bg-muted-foreground"
                        }`} />
                        {d.status}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground text-xs truncate max-w-[200px]">{d.live_url || "—"}</td>
                    <td className="p-4 text-muted-foreground">{d.retry_count}/{d.max_retries}</td>
                    <td className="p-4 text-muted-foreground font-mono text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
