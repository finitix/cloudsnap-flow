import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, MessageSquare, Star, FolderGit2, Rocket, Shield, Eye, EyeOff, CheckCircle, Clock, Mail, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [users, setUsers] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [stats, setStats] = useState({ users: 0, projects: 0, deployments: 0, feedback: 0, contacts: 0, liveDeployments: 0 });

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const [profilesRes, feedbackRes, contactsRes, projectsRes, deploymentsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("feedback").select("*").order("created_at", { ascending: false }),
        supabase.from("contact_messages").select("*").order("created_at", { ascending: false }),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("deployments").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      
      const allUsers = profilesRes.data || [];
      const allFeedback = feedbackRes.data || [];
      const allContacts = contactsRes.data || [];
      const allProjects = projectsRes.data || [];
      const allDeployments = deploymentsRes.data || [];

      setUsers(allUsers);
      setFeedback(allFeedback);
      setContacts(allContacts);
      setProjects(allProjects);
      setDeployments(allDeployments);
      setStats({
        users: allUsers.length,
        projects: allProjects.length,
        deployments: allDeployments.length,
        feedback: allFeedback.length,
        contacts: allContacts.length,
        liveDeployments: allDeployments.filter((d: any) => d.status === "live").length,
      });
    };
    load();
  }, [isAdmin]);

  const togglePublish = async (id: string, current: boolean) => {
    const { error } = await supabase.from("feedback").update({ is_published: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setFeedback((prev) => prev.map((f) => f.id === id ? { ...f, is_published: !current } : f));
    toast.success(current ? "Unpublished" : "Published");
  };

  const updateContactStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("contact_messages").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    toast.success(`Marked as ${status}`);
  };

  if (adminLoading) return <DashboardLayout><div className="p-8 text-muted-foreground">Checking permissions...</div></DashboardLayout>;
  if (!isAdmin) return <DashboardLayout><div className="p-8"><div className="glass-card rounded-xl p-12 text-center"><Shield className="h-10 w-10 mx-auto mb-4 text-destructive opacity-60" /><h2 className="text-xl font-bold mb-2">Access Denied</h2><p className="text-sm text-muted-foreground">You don't have admin privileges.</p></div></div></DashboardLayout>;

  const statCards = [
    { label: "Total Users", value: stats.users, icon: Users, color: "text-primary" },
    { label: "Projects", value: stats.projects, icon: FolderGit2, color: "text-blue-400" },
    { label: "Deployments", value: stats.deployments, icon: Rocket, color: "text-green-400" },
    { label: "Live", value: stats.liveDeployments, icon: CheckCircle, color: "text-emerald-400" },
    { label: "Feedback", value: stats.feedback, icon: Star, color: "text-yellow-400" },
    { label: "Messages", value: stats.contacts, icon: Mail, color: "text-purple-400" },
  ];

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Admin Dashboard
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Platform overview and management</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="users">
          <TabsList className="mb-6">
            <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1.5" />Users</TabsTrigger>
            <TabsTrigger value="feedback"><Star className="h-3.5 w-3.5 mr-1.5" />Reviews</TabsTrigger>
            <TabsTrigger value="contacts"><Mail className="h-3.5 w-3.5 mr-1.5" />Messages</TabsTrigger>
            <TabsTrigger value="projects"><FolderGit2 className="h-3.5 w-3.5 mr-1.5" />Projects</TabsTrigger>
            <TabsTrigger value="deployments"><Rocket className="h-3.5 w-3.5 mr-1.5" />Deploys</TabsTrigger>
          </TabsList>

          {/* Users */}
          <TabsContent value="users">
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold">All Users ({users.length})</h3>
              </div>
              <div className="divide-y divide-border">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                        {(u.display_name || u.email || "U")[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.display_name || "No name"}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">{new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
                {users.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No users yet.</div>}
              </div>
            </div>
          </TabsContent>

          {/* Feedback */}
          <TabsContent value="feedback">
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold">All Reviews & Feedback ({feedback.length})</h3>
              </div>
              <div className="divide-y divide-border">
                {feedback.map((f) => (
                  <div key={f.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{f.name}</p>
                          <Badge variant="outline" className="text-[10px]">{f.type}</Badge>
                          {f.is_published && <Badge className="text-[10px] bg-green-500/15 text-green-500">Published</Badge>}
                        </div>
                        <div className="flex gap-0.5 mb-1">
                          {Array.from({ length: f.rating || 5 }).map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-primary text-primary" />
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground">{f.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{f.email} • {new Date(f.created_at).toLocaleString()}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => togglePublish(f.id, f.is_published)}>
                        {f.is_published ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
                        {f.is_published ? "Hide" : "Publish"}
                      </Button>
                    </div>
                  </div>
                ))}
                {feedback.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No feedback yet.</div>}
              </div>
            </div>
          </TabsContent>

          {/* Contacts */}
          <TabsContent value="contacts">
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold">Contact Messages ({contacts.length})</h3>
              </div>
              <div className="divide-y divide-border">
                {contacts.map((c) => (
                  <div key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{c.name}</p>
                          <Badge variant="outline" className={`text-[10px] ${c.status === "new" ? "border-primary text-primary" : c.status === "resolved" ? "border-green-500 text-green-500" : ""}`}>
                            {c.status}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground/80 mb-1">{c.subject}</p>
                        <p className="text-sm text-muted-foreground">{c.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{c.email} • {new Date(c.created_at).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-1">
                        {c.status === "new" && (
                          <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateContactStatus(c.id, "resolved")}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {contacts.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No messages yet.</div>}
              </div>
            </div>
          </TabsContent>

          {/* Projects */}
          <TabsContent value="projects">
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold">All Projects ({projects.length})</h3>
              </div>
              <div className="divide-y divide-border">
                {projects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.framework || "Unknown"} • {p.project_type || "Unknown"} • {p.source_type}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                      <span className="text-xs text-muted-foreground font-mono">{new Date(p.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {projects.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No projects yet.</div>}
              </div>
            </div>
          </TabsContent>

          {/* Deployments */}
          <TabsContent value="deployments">
            <div className="glass-card rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold">Recent Deployments ({deployments.length})</h3>
              </div>
              <div className="divide-y divide-border">
                {deployments.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium capitalize">{d.provider}</p>
                      <p className="text-xs text-muted-foreground">{d.live_url || "No URL"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-[10px] ${d.status === "live" ? "border-green-500 text-green-500" : d.status === "error" ? "border-red-500 text-red-500" : ""}`}>
                        {d.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">{new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {deployments.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No deployments yet.</div>}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
