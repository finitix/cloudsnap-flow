import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Shield, Users, FolderGit2, Rocket, Plug, Star, Mail, CheckCircle, AlertTriangle, Clock, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [stats, setStats] = useState({
    users: 0, projects: 0, deployments: 0, connections: 0,
    feedback: 0, contacts: 0, liveDeployments: 0, errorDeployments: 0,
    publishedReviews: 0, newMessages: 0,
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentDeployments, setRecentDeployments] = useState<any[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      const [profilesRes, projectsRes, deploymentsRes, connectionsRes, feedbackRes, contactsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("deployments").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("cloud_connections").select("id", { count: "exact", head: true }),
        supabase.from("feedback").select("*"),
        supabase.from("contact_messages").select("*"),
      ]);

      const allUsers = profilesRes.data || [];
      const allDeployments = deploymentsRes.data || [];
      const allFeedback = feedbackRes.data || [];
      const allContacts = contactsRes.data || [];

      setStats({
        users: allUsers.length,
        projects: projectsRes.count || 0,
        deployments: allDeployments.length,
        connections: connectionsRes.count || 0,
        feedback: allFeedback.length,
        contacts: allContacts.length,
        liveDeployments: allDeployments.filter((d: any) => d.status === "live").length,
        errorDeployments: allDeployments.filter((d: any) => d.status === "error").length,
        publishedReviews: allFeedback.filter((f: any) => f.is_published).length,
        newMessages: allContacts.filter((c: any) => c.status === "new").length,
      });
      setRecentUsers(allUsers.slice(0, 5));
      setRecentDeployments(allDeployments.slice(0, 5));
    };
    load();
  }, [isAdmin]);

  if (adminLoading) return <AdminLayout><div className="p-8 text-muted-foreground">Checking permissions...</div></AdminLayout>;
  if (!isAdmin) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="glass-card rounded-xl p-12 text-center max-w-sm">
        <Shield className="h-12 w-12 mx-auto mb-4 text-destructive opacity-60" />
        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
        <p className="text-sm text-muted-foreground">You don't have admin privileges.</p>
      </div>
    </div>
  );

  const statCards = [
    { label: "Total Users", value: stats.users, icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Projects", value: stats.projects, icon: FolderGit2, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Deployments", value: stats.deployments, icon: Rocket, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Connections", value: stats.connections, icon: Plug, color: "text-violet-400", bg: "bg-violet-400/10" },
    { label: "Live Deploys", value: stats.liveDeployments, icon: CheckCircle, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Failed Deploys", value: stats.errorDeployments, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-400/10" },
    { label: "Reviews", value: stats.feedback, icon: Star, color: "text-yellow-400", bg: "bg-yellow-400/10" },
    { label: "New Messages", value: stats.newMessages, icon: Mail, color: "text-purple-400", bg: "bg-purple-400/10" },
  ];

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-destructive" /> Platform Overview
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Complete admin dashboard — all platform metrics at a glance</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {statCards.map((s) => (
            <div key={s.label} className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
                <div className={`h-8 w-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
              </div>
              <p className="text-3xl font-bold">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Users */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Recent Users</h2>
              <a href="/admin/users" className="text-xs text-primary hover:underline">View all →</a>
            </div>
            {recentUsers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No users yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {recentUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold">
                        {(u.display_name || u.email || "U")[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.display_name || "No name"}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Deployments */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2"><Rocket className="h-4 w-4 text-primary" /> Recent Deployments</h2>
              <a href="/admin/deployments" className="text-xs text-primary hover:underline">View all →</a>
            </div>
            {recentDeployments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No deployments yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {recentDeployments.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                    <div>
                      <p className="text-sm font-medium capitalize">{d.provider}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{d.live_url || "No URL"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        d.status === "live" ? "bg-green-500/15 text-green-400" :
                        d.status === "error" ? "bg-red-500/15 text-red-400" :
                        d.status === "building" ? "bg-yellow-500/15 text-yellow-400" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${
                          d.status === "live" ? "bg-green-400" :
                          d.status === "error" ? "bg-red-400" :
                          d.status === "building" ? "bg-yellow-400 animate-pulse" :
                          "bg-muted-foreground"
                        }`} />
                        {d.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">{new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick stats summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Star className="h-4 w-4 text-yellow-400" /> Reviews Summary</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Reviews</span>
                <span className="font-medium">{stats.feedback}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Published</span>
                <span className="font-medium text-green-400">{stats.publishedReviews}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pending</span>
                <span className="font-medium text-yellow-400">{stats.feedback - stats.publishedReviews}</span>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Mail className="h-4 w-4 text-purple-400" /> Support Messages</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Messages</span>
                <span className="font-medium">{stats.contacts}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">New / Unresolved</span>
                <span className="font-medium text-primary">{stats.newMessages}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Resolved</span>
                <span className="font-medium text-green-400">{stats.contacts - stats.newMessages}</span>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Deployment Health</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Success Rate</span>
                <span className="font-medium text-green-400">
                  {stats.deployments > 0 ? Math.round((stats.liveDeployments / stats.deployments) * 100) : 0}%
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Live</span>
                <span className="font-medium text-green-400">{stats.liveDeployments}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Failed</span>
                <span className="font-medium text-red-400">{stats.errorDeployments}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
