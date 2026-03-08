import { useState, useEffect } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle, Shield } from "lucide-react";
import { toast } from "sonner";

export default function AdminMessages() {
  const { isAdmin, loading } = useAdmin();
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).then(({ data }) => setMessages(data || []));
  }, [isAdmin]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("contact_messages").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
    toast.success(`Marked as ${status}`);
  };

  if (loading) return <AdminLayout><div className="p-8 text-muted-foreground">Loading...</div></AdminLayout>;
  if (!isAdmin) return <AdminLayout><div className="p-8"><div className="glass-card rounded-xl p-12 text-center"><Shield className="h-10 w-10 mx-auto mb-4 text-destructive opacity-60" /><h2 className="text-xl font-bold">Access Denied</h2></div></div></AdminLayout>;

  const newCount = messages.filter(m => m.status === "new").length;

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="h-6 w-6 text-purple-400" /> Support Messages</h1>
          <p className="text-muted-foreground text-sm mt-1">{messages.length} total — {newCount} unresolved</p>
        </div>
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {messages.map((m) => (
              <div key={m.id} className="p-5 hover:bg-muted/10 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-7 w-7 rounded-full bg-purple-400/15 flex items-center justify-center text-[10px] font-bold text-purple-400">
                        {m.name[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{m.name}</span>
                      <span className="text-xs text-muted-foreground">{m.email}</span>
                      <Badge variant="outline" className={`text-[10px] ${
                        m.status === "new" ? "border-primary/50 text-primary" :
                        m.status === "resolved" ? "border-green-500/50 text-green-400" : ""
                      }`}>{m.status}</Badge>
                    </div>
                    <p className="text-sm font-medium mb-1">{m.subject}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{m.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-2 font-mono">{new Date(m.created_at).toLocaleString()}</p>
                  </div>
                  {m.status === "new" && (
                    <Button variant="outline" size="sm" className="shrink-0" onClick={() => updateStatus(m.id, "resolved")}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" />Resolve
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {messages.length === 0 && <div className="p-12 text-center text-muted-foreground text-sm">No messages yet.</div>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
