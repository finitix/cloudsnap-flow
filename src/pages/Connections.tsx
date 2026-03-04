import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ExternalLink, Server, Globe, Cloud, Lock } from "lucide-react";
import { toast } from "sonner";

const frontendProviders = [
  { id: "vercel", name: "Vercel", description: "Deploy frontend & full-stack apps", tokenUrl: "https://vercel.com/account/tokens", category: "frontend" },
  { id: "netlify", name: "Netlify", description: "Deploy static sites & serverless", tokenUrl: "https://app.netlify.com/user/applications#personal-access-tokens", category: "frontend" },
];

const backendProviders = [
  { id: "render", name: "Render", description: "Modern PaaS for backend services — Node.js, Python, Ruby, Go. Free tier with HTTPS & managed PostgreSQL.", tokenUrl: "https://dashboard.render.com/account/api-keys", category: "backend" },
  { id: "railway", name: "Railway", description: "Developer-friendly deployment with auto-detection for many languages. Built-in PostgreSQL/MySQL.", tokenUrl: "https://railway.app/account/tokens", category: "backend" },
];

const comingSoonProviders = [
  { id: "aws", name: "AWS", description: "Amazon Web Services — EC2, Lambda, S3, and more", category: "cloud" },
  { id: "gcp", name: "GCP", description: "Google Cloud Platform — App Engine, Cloud Run, GKE", category: "cloud" },
  { id: "azure", name: "Azure", description: "Microsoft Azure — App Service, Functions, AKS", category: "cloud" },
];

export default function Connections() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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
        user_id: user!.id,
        provider: selectedProvider,
        token,
        display_name: displayName || `My ${selectedProvider}`,
      });
      if (error) throw error;
      toast.success(`${selectedProvider} connected!`);
      setOpen(false);
      setToken("");
      setDisplayName("");
      setSelectedProvider("");
      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
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
      toast.success("Connection and related deployments removed");
    } catch (err: any) {
      toast.error("Delete failed: " + err.message);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const getProviderIcon = (provider: string) => {
    if (["vercel", "netlify"].includes(provider)) return <Globe className="h-5 w-5" />;
    if (["render", "railway"].includes(provider)) return <Server className="h-5 w-5" />;
    return <Cloud className="h-5 w-5" />;
  };

  const getCategoryLabel = (provider: string) => {
    if (["vercel", "netlify"].includes(provider)) return "Frontend";
    if (["render", "railway"].includes(provider)) return "Backend";
    return "Cloud";
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Cloud Connections</h1>
            <p className="text-muted-foreground text-sm mt-1">Connect your deployment platforms</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Connect Cloud</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Connect Cloud Provider</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="frontend" className="mt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="frontend" className="flex-1"><Globe className="h-4 w-4 mr-2" />Frontend</TabsTrigger>
                  <TabsTrigger value="backend" className="flex-1"><Server className="h-4 w-4 mr-2" />Backend</TabsTrigger>
                  <TabsTrigger value="cloud" className="flex-1"><Cloud className="h-4 w-4 mr-2" />Cloud</TabsTrigger>
                </TabsList>

                <TabsContent value="frontend" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    {frontendProviders.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProvider(p.id)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          selectedProvider === p.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                      </button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="backend" className="mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    {backendProviders.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProvider(p.id)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          selectedProvider === p.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                      </button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="cloud" className="mt-4">
                  <div className="grid grid-cols-3 gap-3">
                    {comingSoonProviders.map((p) => (
                      <div
                        key={p.id}
                        className="p-4 rounded-xl border border-border/50 text-left opacity-50 relative"
                      >
                        <div className="absolute top-2 right-2">
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <p className="font-semibold text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                        <span className="inline-block mt-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Coming Soon
                        </span>
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
                      <a
                        href={selectedProviderData.tokenUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
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

        {/* Connected */}
        {connections.length === 0 ? (
          <div className="glass-card rounded-xl p-16 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">No connections yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Connect Vercel, Netlify, Render, or Railway to start deploying</p>
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
                    {filtered.map((c) => (
                      <div key={c.id} className="glass-card rounded-xl p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            {getProviderIcon(c.provider)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{c.display_name || c.provider}</p>
                            <p className="text-xs text-muted-foreground capitalize">{c.provider} • Connected {new Date(c.connected_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget({ id: c.id, name: c.display_name || c.provider })}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteTarget?.name}</strong>? This will also delete all deployment records associated with this connection. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Removing..." : "Remove Connection"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
