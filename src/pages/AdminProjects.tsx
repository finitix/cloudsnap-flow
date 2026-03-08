import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { FolderGit2, Shield } from "lucide-react";

export default function AdminProjects() {
  const { isAdmin, loading } = useAdmin();
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("projects").select("*").order("created_at", { ascending: false }).then(({ data }) => setProjects(data || []));
  }, [isAdmin]);

  if (loading) return <AdminLayout><div className="p-8 text-muted-foreground">Loading...</div></AdminLayout>;
  if (!isAdmin) return <AdminLayout><div className="p-8"><div className="glass-card rounded-xl p-12 text-center"><Shield className="h-10 w-10 mx-auto mb-4 text-destructive opacity-60" /><h2 className="text-xl font-bold">Access Denied</h2></div></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2"><FolderGit2 className="h-6 w-6 text-primary" /> All Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">{projects.length} total projects</p>
        </div>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-muted-foreground font-medium">Name</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Framework</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Type</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Source</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4 font-medium">{p.name}</td>
                    <td className="p-4 text-muted-foreground">{p.framework || "Unknown"}</td>
                    <td className="p-4"><Badge variant="outline" className="text-[10px]">{p.project_type || "Unknown"}</Badge></td>
                    <td className="p-4 text-muted-foreground">{p.source_type}</td>
                    <td className="p-4"><Badge variant="outline" className={`text-[10px] ${p.status === "ready" ? "border-green-500/50 text-green-400" : ""}`}>{p.status}</Badge></td>
                    <td className="p-4 text-muted-foreground font-mono text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
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
