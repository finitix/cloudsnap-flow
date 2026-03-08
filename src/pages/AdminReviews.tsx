import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Eye, EyeOff, Shield } from "lucide-react";
import { toast } from "sonner";

export default function AdminReviews() {
  const { isAdmin, loading } = useAdmin();
  const [feedback, setFeedback] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("feedback").select("*").order("created_at", { ascending: false }).then(({ data }) => setFeedback(data || []));
  }, [isAdmin]);

  const togglePublish = async (id: string, current: boolean) => {
    const { error } = await supabase.from("feedback").update({ is_published: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setFeedback((prev) => prev.map((f) => f.id === id ? { ...f, is_published: !current } : f));
    toast.success(current ? "Unpublished" : "Published on website");
  };

  if (loading) return <AdminLayout><div className="p-8 text-muted-foreground">Loading...</div></AdminLayout>;
  if (!isAdmin) return <AdminLayout><div className="p-8"><div className="glass-card rounded-xl p-12 text-center"><Shield className="h-10 w-10 mx-auto mb-4 text-destructive opacity-60" /><h2 className="text-xl font-bold">Access Denied</h2></div></div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Star className="h-6 w-6 text-yellow-400" /> Reviews & Feedback</h1>
          <p className="text-muted-foreground text-sm mt-1">{feedback.length} total — {feedback.filter(f => f.is_published).length} published</p>
        </div>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {feedback.map((f) => (
              <div key={f.id} className="p-5 hover:bg-muted/10 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">
                        {f.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium">{f.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{f.email}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] ml-1">{f.type}</Badge>
                      {f.is_published && <Badge className="text-[10px] bg-green-500/15 text-green-400 border-0">Published</Badge>}
                    </div>
                    <div className="flex gap-0.5 mb-2">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3 w-3 ${i < (f.rating || 5) ? "fill-primary text-primary" : "text-muted-foreground/20"}`} />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-2 font-mono">{new Date(f.created_at).toLocaleString()}</p>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0" onClick={() => togglePublish(f.id, f.is_published)}>
                    {f.is_published ? <><EyeOff className="h-3.5 w-3.5 mr-1.5" />Unpublish</> : <><Eye className="h-3.5 w-3.5 mr-1.5" />Publish</>}
                  </Button>
                </div>
              </div>
            ))}
            {feedback.length === 0 && <div className="p-12 text-center text-muted-foreground text-sm">No feedback yet.</div>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
