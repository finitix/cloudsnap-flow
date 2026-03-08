import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Plug, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AdminConnections() {
  const { isAdmin, loading } = useAdmin();
  const [connections, setConnections] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    // Admins can't read all connections by default — we need a policy
    supabase.from("cloud_connections").select("*").order("connected_at", { ascending: false }).then(({ data }) => setConnections(data || []));
  }, [isAdmin]);

  if (loading) return <AdminLayout><div className="p-8 text-muted-foreground">Loading...</div></AdminLayout>;
  if (!isAdmin) return <AdminLayout><div className="p-8"><div className="glass-card rounded-xl p-12 text-center"><Shield className="h-10 w-10 mx-auto mb-4 text-destructive opacity-60" /><h2 className="text-xl font-bold">Access Denied</h2></div></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Plug className="h-6 w-6 text-primary" /> Cloud Connections</h1>
          <p className="text-muted-foreground text-sm mt-1">{connections.length} connections</p>
        </div>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-muted-foreground font-medium">Provider</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Display Name</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Connected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {connections.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4"><Badge variant="outline" className="text-[10px] capitalize">{c.provider}</Badge></td>
                    <td className="p-4 font-medium">{c.display_name || "—"}</td>
                    <td className="p-4 text-muted-foreground font-mono text-xs">{new Date(c.connected_at).toLocaleDateString()}</td>
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
