import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const providers = [
  { id: "vercel", name: "Vercel", description: "Deploy frontend & full-stack apps", tokenUrl: "https://vercel.com/account/tokens" },
  { id: "netlify", name: "Netlify", description: "Deploy static sites & serverless", tokenUrl: "https://app.netlify.com/user/applications#personal-access-tokens" },
];

export default function Connections() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("cloud_connections").select("*").order("connected_at", { ascending: false });
    setConnections(data || []);
  };

  useEffect(() => { load(); }, [user]);

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

  const handleDelete = async (id: string) => {
    await supabase.from("cloud_connections").delete().eq("id", id);
    toast.success("Connection removed");
    load();
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Cloud Connections</h1>
            <p className="text-muted-foreground text-sm mt-1">Connect your deployment platforms</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Connect Cloud</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect Cloud Provider</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  {providers.map((p) => (
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
                {selectedProvider && (
                  <>
                    <div className="space-y-2">
                      <Label>Display Name</Label>
                      <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={`My ${selectedProvider}`} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>API Token</Label>
                        <a
                          href={providers.find((p) => p.id === selectedProvider)?.tokenUrl}
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
                      {loading ? "Connecting..." : "Connect"}
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {connections.length === 0 ? (
          <div className="glass-card rounded-xl p-16 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">No connections yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Connect Vercel or Netlify to start deploying</p>
            <Button variant="outline" onClick={() => setOpen(true)}>Connect Cloud</Button>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((c) => (
              <div key={c.id} className="glass-card rounded-xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase">
                    {c.provider[0]}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{c.display_name || c.provider}</p>
                    <p className="text-xs text-muted-foreground capitalize">{c.provider} • Connected {new Date(c.connected_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
