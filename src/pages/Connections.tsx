import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Trash2, ExternalLink, Server, Globe, Cloud, Lock, RefreshCw,
  ChevronDown, ChevronUp, User, FolderGit2, CreditCard, Activity, Loader2
} from "lucide-react";
import { toast } from "sonner";

const frontendProviders = [
  { id: "vercel", name: "Vercel", description: "Deploy frontend & full-stack apps", tokenUrl: "https://vercel.com/account/tokens", category: "frontend" },
];
const backendProviders = [
  { id: "render", name: "Render", description: "Modern PaaS for backend services", tokenUrl: "https://dashboard.render.com/u/settings#api-keys", category: "backend" },
];
const comingSoonProviders = [
  { id: "aws", name: "AWS", description: "Amazon Web Services", category: "cloud" },
  { id: "gcp", name: "GCP", description: "Google Cloud Platform", category: "cloud" },
  { id: "azure", name: "Azure", description: "Microsoft Azure", category: "cloud" },
];

export default function Connections() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [providerData, setProviderData] = useState<Record<string, any>>({});
  const [billingData, setBillingData] = useState<Record<string, any>>({});
  const [loadingInfo, setLoadingInfo] = useState<string | null>(null);
  const [loadingBilling, setLoadingBilling] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("cloud_connections").select("*").order("connected_at", { ascending: false });
    setConnections(data || []);
  };

  useEffect(() => { load(); }, [user]);

  const allProviders = [...frontendProviders, ...backendProviders];
  const selectedProviderData = allProviders.find((p) => p.id === selectedProvider);

  const handleConnect = async () => {
    if (!token || !selectedProvider) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("cloud_connections").insert({
        user_id: user!.id, provider: selectedProvider, token,
        display_name: displayName || `My ${selectedProvider}`,
      });
      if (error) throw error;
      toast.success(`${selectedProvider} connected!`);
      setOpen(false); setToken(""); setDisplayName(""); setSelectedProvider("");
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("deploy-project", {
        body: { action: "delete-connection", connectionId: deleteTarget.id },
      });
      if (error) throw error;
      setConnections((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Connection removed");
    } catch (err: any) { toast.error("Delete failed: " + err.message); }
    finally { setDeleting(false); setDeleteTarget(null); }
  };

  const toggleExpand = async (connId: string) => {
    if (expandedId === connId) { setExpandedId(null); return; }
    setExpandedId(connId);
    if (!providerData[connId]) fetchProviderInfo(connId);
    if (!billingData[connId]) fetchBilling(connId);
  };

  const fetchProviderInfo = async (connId: string) => {
    setLoadingInfo(connId);
    try {
      const { data, error } = await supabase.functions.invoke("deploy-project", {
        body: { action: "fetch-provider-info", connectionId: connId },
      });
      if (error) throw error;
      if (data?.success) setProviderData((prev) => ({ ...prev, [connId]: data.providerInfo }));
    } catch (err: any) { toast.error("Failed to load info: " + err.message); }
    finally { setLoadingInfo(null); }
  };

  const fetchBilling = async (connId: string) => {
    setLoadingBilling(connId);
    try {
      const { data, error } = await supabase.functions.invoke("deploy-project", {
        body: { action: "fetch-billing", connectionId: connId },
      });
      if (error) throw error;
      if (data?.success) setBillingData((prev) => ({ ...prev, [connId]: data.billing }));
    } catch (err: any) { toast.error("Failed to load billing: " + err.message); }
    finally { setLoadingBilling(null); }
  };

  const getProviderIcon = (provider: string) => {
    if (provider === "vercel") return <Globe className="h-5 w-5" />;
    if (provider === "render") return <Server className="h-5 w-5" />;
    return <Cloud className="h-5 w-5" />;
  };

  const getCategoryLabel = (provider: string) => {
    if (provider === "vercel") return "Frontend";
    if (provider === "render") return "Backend";
    return "Cloud";
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Cloud Connections</h1>
            <p className="text-muted-foreground text-sm mt-1">Connect and manage your deployment platforms</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Connect Cloud</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Connect Cloud Provider</DialogTitle></DialogHeader>
              <Tabs defaultValue="frontend" className="mt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="frontend" className="flex-1"><Globe className="h-4 w-4 mr-2" />Frontend</TabsTrigger>
                  <TabsTrigger value="backend" className="flex-1"><Server className="h-4 w-4 mr-2" />Backend</TabsTrigger>
                  <TabsTrigger value="cloud" className="flex-1"><Cloud className="h-4 w-4 mr-2" />Cloud</TabsTrigger>
                </TabsList>
                <TabsContent value="frontend" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    {frontendProviders.map((p) => (
                      <button key={p.id} onClick={() => setSelectedProvider(p.id)} className={`p-4 rounded-xl border text-left transition-all ${selectedProvider === p.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                      </button>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="backend" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    {backendProviders.map((p) => (
                      <button key={p.id} onClick={() => setSelectedProvider(p.id)} className={`p-4 rounded-xl border text-left transition-all ${selectedProvider === p.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                      </button>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="cloud" className="mt-4">
                  <div className="grid grid-cols-3 gap-3">
                    {comingSoonProviders.map((p) => (
                      <div key={p.id} className="p-4 rounded-xl border border-border/50 text-left opacity-50 relative">
                        <div className="absolute top-2 right-2"><Lock className="h-3 w-3 text-muted-foreground" /></div>
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                        <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Coming Soon</span>
                      </div>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
              {selectedProvider && selectedProviderData && (
                <div className="space-y-4 mt-4 pt-4 border-t border-border">
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={`My ${selectedProviderData.name}`} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>API Token</Label>
                      <a href={selectedProviderData.tokenUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                        Get token <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your token here" />
                  </div>
                  <Button onClick={handleConnect} disabled={loading || !token} className="w-full">
                    {loading ? "Connecting..." : `Connect ${selectedProviderData.name}`}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {connections.length === 0 ? (
          <div className="glass-card rounded-xl p-16 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">No connections yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Connect Vercel or Render to start deploying</p>
            <Button variant="outline" onClick={() => setOpen(true)}>Connect Cloud</Button>
          </div>
        ) : (
          <div className="space-y-6">
            {["Frontend", "Backend"].map((category) => {
              const filtered = connections.filter((c) => getCategoryLabel(c.provider) === category);
              if (filtered.length === 0) return null;
              return (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    {category === "Frontend" ? <Globe className="h-3.5 w-3.5" /> : <Server className="h-3.5 w-3.5" />}
                    {category} Deployment
                  </h3>
                  <div className="space-y-3">
                    {filtered.map((c) => {
                      const isExpanded = expandedId === c.id;
                      const info = providerData[c.id];
                      const bill = billingData[c.id];
                      return (
                        <div key={c.id} className="glass-card rounded-xl overflow-hidden">
                          <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => toggleExpand(c.id)}>
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                {getProviderIcon(c.provider)}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{c.display_name || c.provider}</p>
                                <p className="text-xs text-muted-foreground capitalize">{c.provider} • Connected {new Date(c.connected_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: c.id, name: c.display_name || c.provider }); }}>
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="border-t border-border">
                              <Tabs defaultValue="overview" className="p-4">
                                <TabsList className="w-full justify-start">
                                  <TabsTrigger value="overview"><User className="h-3.5 w-3.5 mr-1.5" />Overview</TabsTrigger>
                                  <TabsTrigger value="projects"><FolderGit2 className="h-3.5 w-3.5 mr-1.5" />Projects</TabsTrigger>
                                  <TabsTrigger value="billing"><CreditCard className="h-3.5 w-3.5 mr-1.5" />Billing</TabsTrigger>
                                </TabsList>

                                {/* Overview Tab */}
                                <TabsContent value="overview" className="mt-4">
                                  {loadingInfo === c.id ? (
                                    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                                      <Loader2 className="h-4 w-4 animate-spin" /> Loading provider info...
                                    </div>
                                  ) : info ? (
                                    <div className="space-y-4">
                                      {info.user && (
                                        <div className="bg-muted/50 rounded-lg p-4">
                                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Account</h4>
                                          <div className="grid grid-cols-3 gap-4">
                                            {info.user.name && <div><p className="text-xs text-muted-foreground">Name</p><p className="text-sm font-medium">{info.user.name}</p></div>}
                                            {info.user.username && <div><p className="text-xs text-muted-foreground">Username</p><p className="text-sm font-mono">{info.user.username}</p></div>}
                                            {info.user.email && <div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm">{info.user.email}</p></div>}
                                          </div>
                                        </div>
                                      )}
                                      <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-muted/30 rounded-lg p-3">
                                          <p className="text-xs text-muted-foreground">Provider</p>
                                          <p className="text-sm font-semibold capitalize">{c.provider}</p>
                                        </div>
                                        <div className="bg-muted/30 rounded-lg p-3">
                                          <p className="text-xs text-muted-foreground">Projects</p>
                                          <p className="text-sm font-semibold">{info.projects?.length || 0}</p>
                                        </div>
                                        <div className="bg-muted/30 rounded-lg p-3">
                                          <p className="text-xs text-muted-foreground">Connected</p>
                                          <p className="text-sm font-semibold">{new Date(c.connected_at).toLocaleDateString()}</p>
                                        </div>
                                      </div>
                                      <Button variant="outline" size="sm" onClick={() => fetchProviderInfo(c.id)}>
                                        <RefreshCw className="h-3 w-3 mr-1.5" /> Refresh
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                      <Activity className="h-8 w-8 mx-auto mb-3 opacity-30" />
                                      <p>Loading provider information...</p>
                                    </div>
                                  )}
                                </TabsContent>

                                {/* Projects Tab */}
                                <TabsContent value="projects" className="mt-4">
                                  {loadingInfo === c.id ? (
                                    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                                      <Loader2 className="h-4 w-4 animate-spin" /> Loading projects...
                                    </div>
                                  ) : info?.projects?.length > 0 ? (
                                    <div className="space-y-2">
                                      {info.projects.map((p: any, i: number) => (
                                        <div key={p.id || i} className="bg-muted/30 rounded-lg p-3 flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                                            <div>
                                              <p className="text-sm font-medium">{p.name}</p>
                                              <p className="text-xs text-muted-foreground">
                                                {p.framework || p.runtime || p.type || "—"} • {p.plan || "free"}
                                                {p.region ? ` • ${p.region}` : ""}
                                                {p.status ? ` • ${p.status}` : ""}
                                              </p>
                                            </div>
                                          </div>
                                          {(p.url || p.state) && (
                                            <div className="flex items-center gap-2">
                                              {p.state && <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${p.state === "READY" || p.state === "active" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"}`}>{p.state}</span>}
                                              {p.url && (
                                                <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                                  <ExternalLink className="h-3 w-3" />
                                                </a>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                      <FolderGit2 className="h-8 w-8 mx-auto mb-3 opacity-30" />
                                      <p>No projects found on this provider</p>
                                    </div>
                                  )}
                                </TabsContent>

                                {/* Billing Tab */}
                                <TabsContent value="billing" className="mt-4">
                                  {loadingBilling === c.id ? (
                                    <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                                      <Loader2 className="h-4 w-4 animate-spin" /> Loading billing info...
                                    </div>
                                  ) : bill ? (
                                    <div className="space-y-4">
                                      {bill.summary && (
                                        <div className="bg-muted/50 rounded-lg p-4">
                                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Plan & Usage</h4>
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <div><p className="text-xs text-muted-foreground">Plan</p><p className="text-sm font-semibold capitalize">{bill.summary.plan}</p></div>
                                            {bill.summary.projectCount !== undefined && <div><p className="text-xs text-muted-foreground">Projects</p><p className="text-sm font-semibold">{bill.summary.projectCount}</p></div>}
                                            {bill.summary.serviceCount !== undefined && <div><p className="text-xs text-muted-foreground">Services</p><p className="text-sm font-semibold">{bill.summary.serviceCount}</p></div>}
                                            {bill.summary.freeServices !== undefined && <div><p className="text-xs text-muted-foreground">Free / Paid</p><p className="text-sm font-semibold">{bill.summary.freeServices} / {bill.summary.paidServices}</p></div>}
                                            {bill.summary.bandwidthUsed && <div><p className="text-xs text-muted-foreground">Bandwidth</p><p className="text-sm font-semibold">{bill.summary.bandwidthUsed}</p></div>}
                                            {bill.summary.buildMinutes && <div><p className="text-xs text-muted-foreground">Build Minutes</p><p className="text-sm font-semibold">{bill.summary.buildMinutes}</p></div>}
                                          </div>
                                          {bill.summary.note && <p className="text-xs text-muted-foreground mt-3 bg-muted/30 rounded p-2">{bill.summary.note}</p>}
                                        </div>
                                      )}
                                      {bill.usage?.length > 0 && (
                                        <div>
                                          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Service Breakdown</h4>
                                          <div className="space-y-1.5">
                                            {bill.usage.map((u: any, i: number) => (
                                              <div key={i} className="bg-muted/30 rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                                                <span className="font-medium">{u.name}</span>
                                                <div className="flex items-center gap-3">
                                                  <span className="text-muted-foreground">{u.type}</span>
                                                  <span className={`px-1.5 py-0.5 rounded font-mono ${u.plan === "free" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>{u.plan}</span>
                                                  <span className={`${u.status === "active" ? "text-green-500" : "text-muted-foreground"}`}>{u.status}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      <Button variant="outline" size="sm" onClick={() => fetchBilling(c.id)}>
                                        <RefreshCw className="h-3 w-3 mr-1.5" /> Refresh Billing
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="text-center py-8 text-muted-foreground text-sm">
                                      <CreditCard className="h-8 w-8 mx-auto mb-3 opacity-30" />
                                      <p>Loading billing information...</p>
                                    </div>
                                  )}
                                </TabsContent>
                              </Tabs>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteTarget?.name}</strong>? This will also delete all deployment records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Removing..." : "Remove Connection"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
