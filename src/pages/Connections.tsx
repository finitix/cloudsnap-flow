import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, ExternalLink, Server, Globe, Cloud, Lock, RefreshCw,
  ChevronDown, ChevronUp, User, FolderGit2, CreditCard, Activity, Loader2,
  Shield, Key, MapPin, AlertTriangle, CheckCircle, ArrowRight, Clock
} from "lucide-react";
import { toast } from "sonner";

const frontendProviders = [
  { id: "vercel", name: "Vercel", description: "Deploy frontend & full-stack apps", tokenUrl: "https://vercel.com/account/tokens", category: "frontend" },
];
const backendProviders = [
  { id: "render", name: "Render", description: "Modern PaaS for backend services", tokenUrl: "https://dashboard.render.com/u/settings#api-keys", category: "backend" },
];

const AWS_REGIONS = [
  { id: "us-east-1", name: "US East (N. Virginia)", flag: "🇺🇸" },
  { id: "us-west-2", name: "US West (Oregon)", flag: "🇺🇸" },
  { id: "eu-west-1", name: "EU (Ireland)", flag: "🇪🇺" },
  { id: "ap-south-1", name: "Asia Pacific (Mumbai)", flag: "🇮🇳" },
  { id: "ap-southeast-1", name: "Asia Pacific (Singapore)", flag: "🇸🇬" },
];

const AWS_SETUP_STEPS = [
  {
    step: 1,
    title: "Create an AWS Account",
    description: "Sign up at aws.amazon.com. Students can use AWS Educate for free credits.",
    link: "https://aws.amazon.com/free/",
  },
  {
    step: 2,
    title: "Create an IAM User",
    description: "Go to IAM → Users → Create User. Attach 'AdministratorAccess' or custom policy with EC2, VPC, RDS permissions.",
    link: "https://console.aws.amazon.com/iam/home#/users",
  },
  {
    step: 3,
    title: "Generate Access Keys",
    description: "Select your IAM user → Security credentials → Create access key → Choose 'Application running outside AWS'.",
    link: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
  },
  {
    step: 4,
    title: "Copy & Paste Keys",
    description: "Copy your Access Key ID and Secret Access Key. Paste them in the form above and click 'Validate Credentials'.",
  },
  {
    step: 5,
    title: "Select Region & Connect",
    description: "Choose your preferred AWS region (us-east-1 recommended for Free Tier). Click 'Connect AWS' to finish.",
  },
];

export default function Connections() {
  const { user } = useAuth();
  const [connections, setConnections] = useState<any[]>([]);
  const [awsConnections, setAwsConnections] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [awsOpen, setAwsOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [providerData, setProviderData] = useState<Record<string, any>>({});
  const [billingData, setBillingData] = useState<Record<string, any>>({});
  const [loadingInfo, setLoadingInfo] = useState<string | null>(null);
  const [loadingBilling, setLoadingBilling] = useState<string | null>(null);

  // AWS form
  const [awsAccessKey, setAwsAccessKey] = useState("");
  const [awsSecretKey, setAwsSecretKey] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [awsDisplayName, setAwsDisplayName] = useState("");
  const [awsConnType, setAwsConnType] = useState("iam_keys");
  const [awsRoleArn, setAwsRoleArn] = useState("");
  const [awsValidating, setAwsValidating] = useState(false);
  const [awsValidated, setAwsValidated] = useState(false);
  const [freeTierInfo, setFreeTierInfo] = useState<any>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("cloud_connections").select("*").order("connected_at", { ascending: false });
    setConnections(data || []);
    const { data: awsData } = await supabase.from("aws_connections").select("*").order("created_at", { ascending: false });
    setAwsConnections(awsData || []);
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

  const handleValidateAws = async () => {
    if (!awsAccessKey || !awsSecretKey) return;
    setAwsValidating(true);
    setAwsValidated(false);
    try {
      const { data, error } = await supabase.functions.invoke("aws-deploy", {
        body: { action: "validate-aws", accessKeyId: awsAccessKey, secretAccessKey: awsSecretKey, region: awsRegion },
      });
      if (error) throw error;
      if (data?.success) { setAwsValidated(true); toast.success("AWS credentials validated!"); }
      else toast.error(data?.error || "Invalid credentials");
    } catch (err: any) { toast.error(err.message); }
    finally { setAwsValidating(false); }
  };

  const handleConnectAws = async () => {
    if (!awsAccessKey || !awsSecretKey) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("aws-deploy", {
        body: {
          action: "connect-aws", accessKeyId: awsAccessKey, secretAccessKey: awsSecretKey,
          region: awsRegion, displayName: awsDisplayName || "My AWS Account",
          connectionType: awsConnType, roleArn: awsRoleArn || undefined,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("AWS account connected!");
        setAwsOpen(false); setAwsAccessKey(""); setAwsSecretKey(""); setAwsDisplayName(""); setAwsValidated(false);
        load();
      } else toast.error(data?.error || "Failed to connect");
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "aws") {
        const { data, error } = await supabase.functions.invoke("aws-deploy", {
          body: { action: "delete-aws-connection", connectionId: deleteTarget.id },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error);
      } else {
        const { error } = await supabase.functions.invoke("deploy-project", {
          body: { action: "delete-connection", connectionId: deleteTarget.id },
        });
        if (error) throw error;
      }
      toast.success("Connection removed");
      load();
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

  const checkFreeTier = async (awsConnId: string) => {
    try {
      const { data } = await supabase.functions.invoke("aws-deploy", {
        body: { action: "check-free-tier", awsConnectionId: awsConnId },
      });
      if (data?.success) setFreeTierInfo(data.freeTier);
    } catch {}
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
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />Connect Provider</Button>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Connect Cloud Provider</DialogTitle></DialogHeader>
              <Tabs defaultValue="frontend" className="mt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="frontend" className="flex-1"><Globe className="h-4 w-4 mr-2" />Frontend</TabsTrigger>
                  <TabsTrigger value="backend" className="flex-1"><Server className="h-4 w-4 mr-2" />Backend</TabsTrigger>
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

        {/* ═══ Connected Accounts (shown first) ═══ */}
        {(connections.length > 0 || awsConnections.length > 0) && (
          <div className="mb-8 space-y-6">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-green-400">Connected Accounts</h2>
            </div>

            {/* AWS Connections */}
            {awsConnections.map((c) => (
              <div key={c.id} className="glass-card rounded-xl overflow-hidden border border-green-500/20">
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                      <Cloud className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{c.display_name}</p>
                        <Badge className="bg-green-500/15 text-green-400 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px]">{c.default_region}</Badge>
                        <Badge variant="outline" className="text-[10px]">{c.connection_type === "assume_role" ? "Assume Role" : "IAM Keys"}</Badge>
                        <span className="text-xs text-muted-foreground">Connected {new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => checkFreeTier(c.id)}>
                      <Activity className="h-3.5 w-3.5 mr-1.5" /> Free Tier Status
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget({ id: c.id, name: c.display_name, type: "aws" })}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                {freeTierInfo && (
                  <div className="border-t border-border p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Free Tier Usage</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">EC2 Instances</p>
                        <p className="text-sm font-semibold">{freeTierInfo.ec2?.used || 0} / {freeTierInfo.ec2?.limit || 1}</p>
                        {freeTierInfo.ec2?.withinLimit ? (
                          <span className="text-[10px] text-green-400">Within limit</span>
                        ) : (
                          <span className="text-[10px] text-red-400">Exceeding limit</span>
                        )}
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Est. Monthly Cost</p>
                        <p className="text-sm font-semibold">${freeTierInfo.estimatedMonthlyCost?.toFixed(2) || "0.00"}</p>
                      </div>
                      {freeTierInfo.warning && (
                        <div className="bg-amber-500/10 rounded-lg p-3">
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-amber-400" />
                            <p className="text-xs text-amber-400 font-medium">Warning</p>
                          </div>
                          <p className="text-[10px] text-amber-300 mt-1">{freeTierInfo.warning}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Vercel / Render Connections */}
            {connections.map((c) => {
              const isExpanded = expandedId === c.id;
              const info = providerData[c.id];
              const bill = billingData[c.id];
              return (
                <div key={c.id} className="glass-card rounded-xl overflow-hidden border border-green-500/20">
                  <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => toggleExpand(c.id)}>
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {getProviderIcon(c.provider)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{c.display_name || c.provider}</p>
                          <Badge className="bg-green-500/15 text-green-400 text-[10px]"><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">{c.provider} • {getCategoryLabel(c.provider)} • Connected {new Date(c.connected_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: c.id, name: c.display_name || c.provider, type: "cloud" }); }}>
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
                        <TabsContent value="overview" className="mt-4">
                          {loadingInfo === c.id ? (
                            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
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
                        <TabsContent value="projects" className="mt-4">
                          {info?.projects?.length > 0 ? (
                            <div className="space-y-2">
                              {info.projects.slice(0, 10).map((p: any, i: number) => (
                                <div key={i} className="flex items-center justify-between bg-muted/30 rounded-lg p-3">
                                  <p className="text-sm font-medium">{p.name}</p>
                                  <Badge variant="outline" className="text-[10px]">{p.framework || "Unknown"}</Badge>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-center py-8 text-muted-foreground text-sm">No projects on this provider</p>
                          )}
                        </TabsContent>
                        <TabsContent value="billing" className="mt-4">
                          {bill ? (
                            <div className="bg-muted/50 rounded-lg p-4">
                              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{JSON.stringify(bill, null, 2)}</pre>
                            </div>
                          ) : (
                            <p className="text-center py-8 text-muted-foreground text-sm">Loading billing info...</p>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ Add New Connection — Cloud Provider Cards ═══ */}
        <div className="mb-2 flex items-center gap-2">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Add New Connection</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* AWS — Live */}
          <div
            className="glass-card rounded-xl p-6 cursor-pointer border-2 border-transparent hover:border-primary/40 transition-all group"
            onClick={() => setAwsOpen(true)}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Cloud className="h-6 w-6 text-amber-400" />
              </div>
              <Badge className="bg-green-500/15 text-green-400 text-[10px]">
                <CheckCircle className="h-3 w-3 mr-1" /> Live
              </Badge>
            </div>
            <h3 className="font-bold text-lg mb-1">Amazon Web Services</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Deploy EC2, RDS, VPC infrastructure with Free Tier optimization
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Server className="h-3 w-3" /> EC2</span>
              <span>•</span><span>RDS</span><span>•</span><span>VPC</span><span>•</span><span>S3</span>
            </div>
            {awsConnections.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-green-400 font-medium">{awsConnections.length} account{awsConnections.length > 1 ? "s" : ""} connected</p>
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Connect AWS
            </Button>
          </div>

          {/* GCP — Coming Soon */}
          <div className="glass-card rounded-xl p-6 opacity-60 cursor-not-allowed relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-muted/20" />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Cloud className="h-6 w-6 text-blue-400" />
              </div>
              <Badge className="bg-muted text-muted-foreground text-[10px]">
                <Clock className="h-3 w-3 mr-1" /> Coming Soon
              </Badge>
            </div>
            <h3 className="font-bold text-lg mb-1 relative z-10">Google Cloud Platform</h3>
            <p className="text-xs text-muted-foreground mb-4 relative z-10">
              Deploy to GCE, Cloud Run, Cloud SQL with Always Free tier
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground relative z-10">
              <span>GCE</span><span>•</span><span>Cloud Run</span><span>•</span><span>Cloud SQL</span>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4 relative z-10" disabled>
              Coming Soon
            </Button>
          </div>

          {/* Azure — Coming Soon */}
          <div className="glass-card rounded-xl p-6 opacity-60 cursor-not-allowed relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-transparent to-muted/20" />
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="h-12 w-12 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                <Cloud className="h-6 w-6 text-cyan-400" />
              </div>
              <Badge className="bg-muted text-muted-foreground text-[10px]">
                <Clock className="h-3 w-3 mr-1" /> Coming Soon
              </Badge>
            </div>
            <h3 className="font-bold text-lg mb-1 relative z-10">Microsoft Azure</h3>
            <p className="text-xs text-muted-foreground mb-4 relative z-10">
              Deploy to Azure VMs, App Service, Azure SQL with free tier
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground relative z-10">
              <span>VMs</span><span>•</span><span>App Service</span><span>•</span><span>Azure SQL</span>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4 relative z-10" disabled>
              Coming Soon
            </Button>
          </div>
        </div>

        {/* ═══ AWS Connect Dialog ═══ */}
        <Dialog open={awsOpen} onOpenChange={setAwsOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Cloud className="h-5 w-5 text-amber-400" /> Connect AWS Account</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>Your credentials are stored securely and only used for infrastructure provisioning. We recommend creating an IAM user with limited permissions.</span>
              </div>

              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={awsDisplayName} onChange={(e) => setAwsDisplayName(e.target.value)} placeholder="My AWS Account" />
              </div>

              <div className="space-y-2">
                <Label>Connection Type</Label>
                <Select value={awsConnType} onValueChange={setAwsConnType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iam_keys">IAM Access Keys</SelectItem>
                    <SelectItem value="assume_role">Assume Role (Recommended)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Key className="h-3 w-3" /> Access Key ID</Label>
                  <Input type="password" value={awsAccessKey} onChange={(e) => { setAwsAccessKey(e.target.value); setAwsValidated(false); }} placeholder="AKIA..." />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Lock className="h-3 w-3" /> Secret Access Key</Label>
                  <Input type="password" value={awsSecretKey} onChange={(e) => { setAwsSecretKey(e.target.value); setAwsValidated(false); }} placeholder="••••••••" />
                </div>
              </div>

              {awsConnType === "assume_role" && (
                <div className="space-y-2">
                  <Label>Role ARN</Label>
                  <Input value={awsRoleArn} onChange={(e) => setAwsRoleArn(e.target.value)} placeholder="arn:aws:iam::123456789:role/CloudsnapRole" />
                </div>
              )}

              <div className="space-y-2">
                <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Default Region</Label>
                <Select value={awsRegion} onValueChange={setAwsRegion}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AWS_REGIONS.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.flag} {r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleValidateAws} disabled={awsValidating || !awsAccessKey || !awsSecretKey} className="flex-1">
                  {awsValidating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validating...</> :
                   awsValidated ? <><CheckCircle className="h-4 w-4 mr-2 text-green-400" /> Validated</> :
                   <><Shield className="h-4 w-4 mr-2" /> Validate Credentials</>}
                </Button>
                <Button onClick={handleConnectAws} disabled={loading || !awsValidated} className="flex-1">
                  {loading ? "Connecting..." : "Connect AWS"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ═══ AWS Step-by-Step Guide ═══ */}
        <div className="glass-card rounded-xl p-6 mb-8">
          <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
            <Cloud className="h-4 w-4 text-amber-400" />
            How to Connect AWS — Step by Step
          </h3>
          <p className="text-xs text-muted-foreground mb-5">Follow these steps to connect your AWS account to Cloudsnap Studio</p>
          <div className="space-y-4">
            {AWS_SETUP_STEPS.map((s) => (
              <div key={s.step} className="flex gap-4 items-start">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {s.step}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold">{s.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                  {s.link && (
                    <a href={s.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                      Open in AWS <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                {s.step < AWS_SETUP_STEPS.length && <ArrowRight className="h-4 w-4 text-muted-foreground/30 mt-2 shrink-0 hidden md:block" />}
              </div>
            ))}
          </div>
          <Button variant="outline" className="mt-5" onClick={() => setAwsOpen(true)}>
            <Cloud className="h-4 w-4 mr-2" /> Start Connecting AWS
          </Button>
        </div>

        {/* ═══ Detailed IAM Policy Guide ═══ */}
        <div className="glass-card rounded-xl p-6 mb-8">
          <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            IAM Policies — What to Select & Why
          </h3>
          <p className="text-xs text-muted-foreground mb-5">
            IAM (Identity and Access Management) policies control what your Cloudsnap connection can do in AWS. Here's a detailed breakdown of each policy you need.
          </p>

          {/* Policy Overview */}
          <div className="bg-muted/30 rounded-lg p-4 mb-5 border border-border">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Security Best Practice</p>
                <p>Never use your AWS root account. Always create a dedicated IAM user with only the permissions Cloudsnap needs. This follows the <strong>Principle of Least Privilege</strong>.</p>
              </div>
            </div>
          </div>

          {/* Required Policies */}
          <div className="space-y-4 mb-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
              <CheckCircle className="h-3.5 w-3.5" /> Required Policies
            </h4>

            <div className="bg-muted/20 rounded-lg p-4 border border-border space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-primary/10 text-primary text-[10px] border-primary/20">Required</Badge>
                  <p className="text-sm font-semibold">AmazonEC2FullAccess</p>
                </div>
                <p className="text-xs text-muted-foreground ml-0.5">Allows Cloudsnap to create, start, stop, and terminate EC2 instances (virtual servers). Also covers Security Groups (firewall rules), Key Pairs, and Elastic IPs. This is the core policy for deploying your applications on virtual machines.</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono ml-0.5">ARN: arn:aws:iam::aws:policy/AmazonEC2FullAccess</p>
              </div>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 border border-border space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-primary/10 text-primary text-[10px] border-primary/20">Required</Badge>
                  <p className="text-sm font-semibold">AmazonVPCFullAccess</p>
                </div>
                <p className="text-xs text-muted-foreground ml-0.5">Allows creation and management of Virtual Private Clouds (VPCs), subnets, route tables, internet gateways, and NAT gateways. VPCs isolate your infrastructure in a private network — every deployment needs one.</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono ml-0.5">ARN: arn:aws:iam::aws:policy/AmazonVPCFullAccess</p>
              </div>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 border border-border space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-primary/10 text-primary text-[10px] border-primary/20">Required</Badge>
                  <p className="text-sm font-semibold">AmazonRDSFullAccess</p>
                </div>
                <p className="text-xs text-muted-foreground ml-0.5">Allows Cloudsnap to provision and manage RDS databases (MySQL, PostgreSQL). Includes creating DB instances, managing backups, and configuring DB subnet groups. Required if your project uses a database.</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono ml-0.5">ARN: arn:aws:iam::aws:policy/AmazonRDSFullAccess</p>
              </div>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 border border-border space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-primary/10 text-primary text-[10px] border-primary/20">Required</Badge>
                  <p className="text-sm font-semibold">AmazonS3FullAccess</p>
                </div>
                <p className="text-xs text-muted-foreground ml-0.5">Allows management of S3 buckets for file storage, static assets, build artifacts, and deployment packages. Used to store your project files during the deployment process.</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono ml-0.5">ARN: arn:aws:iam::aws:policy/AmazonS3FullAccess</p>
              </div>
            </div>
          </div>

          {/* Recommended Policies */}
          <div className="space-y-4 mb-6">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5" /> Recommended Policies
            </h4>

            <div className="bg-muted/20 rounded-lg p-4 border border-border/50 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-amber-500/10 text-amber-400 text-[10px] border-amber-500/20">Recommended</Badge>
                  <p className="text-sm font-semibold">CloudWatchFullAccess</p>
                </div>
                <p className="text-xs text-muted-foreground ml-0.5">Enables real-time monitoring of your infrastructure — CPU usage, memory, network traffic, and application logs. Powers the Monitoring dashboard in Cloudsnap. Without this, you won't see live metrics.</p>
              </div>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 border border-border/50 space-y-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-amber-500/10 text-amber-400 text-[10px] border-amber-500/20">Recommended</Badge>
                  <p className="text-sm font-semibold">IAMReadOnlyAccess</p>
                </div>
                <p className="text-xs text-muted-foreground ml-0.5">Allows Cloudsnap to verify your IAM configuration and validate credentials. Read-only — cannot create or modify IAM users/roles. Used during the "Validate Credentials" step.</p>
              </div>
            </div>
          </div>

          {/* Quick-Start vs Custom */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="bg-green-500/5 rounded-lg p-4 border border-green-500/20">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-400" /> Quick Start (Students)
              </h4>
              <p className="text-xs text-muted-foreground mb-3">If you're learning or experimenting, attach the <strong>AdministratorAccess</strong> managed policy. This grants full access to all AWS services — simple but not recommended for production.</p>
              <div className="bg-muted/30 rounded p-2 font-mono text-[10px] text-muted-foreground">
                Policy: AdministratorAccess<br />
                ARN: arn:aws:iam::aws:policy/AdministratorAccess
              </div>
            </div>
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Production (Best Practice)
              </h4>
              <p className="text-xs text-muted-foreground mb-3">For real projects, attach only the 4 required + 2 recommended policies listed above. This limits what Cloudsnap can access, protecting your other AWS resources.</p>
              <div className="bg-muted/30 rounded p-2 font-mono text-[10px] text-muted-foreground">
                Attach: EC2, VPC, RDS, S3<br />
                + CloudWatch, IAMReadOnly
              </div>
            </div>
          </div>

          {/* How to Attach Policies */}
          <div className="bg-muted/30 rounded-lg p-4 border border-border">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3 flex items-center gap-2">
              <Key className="h-3.5 w-3.5 text-primary" /> How to Attach Policies in AWS Console
            </h4>
            <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Go to <a href="https://console.aws.amazon.com/iam/home#/users" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">IAM → Users</a> and select your IAM user</li>
              <li>Click the <strong>"Permissions"</strong> tab, then <strong>"Add permissions"</strong></li>
              <li>Choose <strong>"Attach policies directly"</strong></li>
              <li>Search for each policy name (e.g., "AmazonEC2FullAccess") and check the box</li>
              <li>Click <strong>"Next"</strong> → <strong>"Add permissions"</strong></li>
              <li>Go to <strong>"Security credentials"</strong> tab → <strong>"Create access key"</strong></li>
              <li>Select <strong>"Application running outside AWS"</strong> and create the key</li>
              <li>Copy both keys and paste them in the Connect AWS form above</li>
            </ol>
          </div>
        </div>

        {connections.length === 0 && awsConnections.length === 0 && (
          <div className="glass-card rounded-xl p-12 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">No connections yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Click on a cloud provider above to get started</p>
          </div>
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Connection</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <strong>{deleteTarget?.name}</strong>?
                {deleteTarget?.type === "aws" && " This will not delete any AWS infrastructure — you must delete resources manually."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground">
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
