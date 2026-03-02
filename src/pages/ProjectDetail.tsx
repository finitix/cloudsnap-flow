import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Rocket, ExternalLink, Terminal, Cpu, HardDrive, RefreshCw, Trash2, CheckCircle, XCircle, Globe } from "lucide-react";
import { toast } from "sonner";

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [deployments, setDeployments] = useState<any[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  const [showDomainDialog, setShowDomainDialog] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const domainDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDeployments = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from("deployments")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false });
    if (data) setDeployments(data);
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    const load = async () => {
      const [pRes, cRes, dRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", id).single(),
        supabase.from("cloud_connections").select("*"),
        supabase.from("deployments").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      ]);
      setProject(pRes.data);
      setConnections(cRes.data || []);
      setDeployments(dRes.data || []);
      if (cRes.data?.[0]) setSelectedConnection(cRes.data[0].id);
    };
    load();

    const channel = supabase
      .channel(`deployments-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deployments", filter: `project_id=eq.${id}` }, () => {
        fetchDeployments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, id, fetchDeployments]);

  // Auto-refresh polling when deployments are active
  useEffect(() => {
    const hasActive = deployments.some((d) => ["queued", "building", "deploying"].includes(d.status));
    if (hasActive && !pollingRef.current) {
      pollingRef.current = setInterval(fetchDeployments, 3000);
    } else if (!hasActive && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [deployments, fetchDeployments]);

  const getConn = () => connections.find((c) => c.id === selectedConnection);

  const checkNameAvailability = async () => {
    const conn = getConn();
    if (!conn || !project) return;
    setCheckingName(true);
    setNameAvailable(null);
    try {
      const { data, error } = await supabase.functions.invoke("deploy-project", {
        body: { action: "check-name", name: project.name, provider: conn.provider, token: conn.token },
      });
      if (error) throw error;
      setNameAvailable(data.available);
      toast(data.available ? `"${data.projectName}" is available!` : `"${data.projectName}" exists — will deploy to it.`);
    } catch (err: any) {
      toast.error("Check failed: " + err.message);
    } finally {
      setCheckingName(false);
    }
  };

  // Real-time domain check with debounce
  const checkDomainRealtime = useCallback(async (domain: string) => {
    const conn = getConn();
    if (!conn || !domain || domain.length < 3) { setDomainAvailable(null); return; }
    setCheckingDomain(true);
    try {
      const { data, error } = await supabase.functions.invoke("deploy-project", {
        body: { action: "check-domain", domain, provider: conn.provider, token: conn.token },
      });
      if (error) throw error;
      setDomainAvailable(data.available);
    } catch {
      setDomainAvailable(null);
    } finally {
      setCheckingDomain(false);
    }
  }, [selectedConnection, connections]);

  const handleDomainChange = (value: string) => {
    setCustomDomain(value);
    setDomainAvailable(null);
    // Debounce domain check — 800ms after user stops typing
    if (domainDebounceRef.current) clearTimeout(domainDebounceRef.current);
    domainDebounceRef.current = setTimeout(() => checkDomainRealtime(value), 800);
  };

  const openDeployDialog = () => {
    const conn = getConn();
    if (!conn || !project) return;
    const pn = project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    setCustomDomain(conn.provider === "vercel" ? `${pn}.vercel.app` : conn.provider === "netlify" ? `${pn}.netlify.app` : "");
    setDomainAvailable(null);
    setShowDomainDialog(true);
  };

  const handleDeploy = async () => {
    setShowDomainDialog(false);
    if (!selectedConnection || !project) return;
    setDeploying(true);
    const conn = getConn();
    if (!conn) { setDeploying(false); return; }

    try {
      const { data: deployment, error } = await supabase.from("deployments").insert({
        project_id: project.id,
        user_id: user!.id,
        cloud_connection_id: conn.id,
        provider: conn.provider,
        status: "queued",
      }).select().single();
      if (error) throw error;

      toast.success("Deployment queued!");

      const { data, error: fnError } = await supabase.functions.invoke("deploy-project", {
        body: {
          deploymentId: deployment.id,
          projectId: project.id,
          connectionId: conn.id,
          customDomain: customDomain || undefined,
        },
      });
      if (fnError) {
        console.error("Deploy error:", fnError);
        toast.error("Deployment failed — check logs.");
      } else if (data?.success) {
        toast.success("Deployed successfully!");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeploying(false);
    }
  };

  const handleDeleteDeployment = async (depId: string) => {
    if (!confirm("Delete this deployment record?")) return;
    try {
      const { error } = await supabase.functions.invoke("deploy-project", {
        body: { action: "delete", deploymentId: depId },
      });
      if (error) throw error;
      setDeployments((prev) => prev.filter((d) => d.id !== depId));
      toast.success("Deployment deleted.");
    } catch (err: any) {
      toast.error("Delete failed: " + err.message);
    }
  };

  if (!project) return <DashboardLayout><div className="p-8 text-muted-foreground">Loading...</div></DashboardLayout>;

  const conn = getConn();

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {project.framework || "Unknown"} • {project.project_type || "Detecting..."} • {project.source_type}
            </p>
          </div>
        </div>

        {/* Analysis */}
        <div className="glass-card rounded-xl p-6 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" /> Project Analysis
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Framework", value: project.framework || "..." },
              { label: "Type", value: project.project_type || "..." },
              { label: "Build", value: project.build_command || "..." },
              { label: "Output", value: project.output_dir || "..." },
            ].map((item) => (
              <div key={item.label} className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className="text-sm font-mono font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Deploy */}
        <div className="glass-card rounded-xl p-6 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" /> Deploy
          </h3>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs text-muted-foreground mb-2">Cloud connection</p>
              <Select value={selectedConnection} onValueChange={(v) => { setSelectedConnection(v); setNameAvailable(null); }}>
                <SelectTrigger><SelectValue placeholder="Choose connection" /></SelectTrigger>
                <SelectContent>
                  {connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.display_name || c.provider} ({c.provider})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={checkNameAvailability} disabled={checkingName || !selectedConnection}>
              {checkingName ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : nameAvailable === true ? <CheckCircle className="h-4 w-4 mr-2 text-primary" /> : nameAvailable === false ? <XCircle className="h-4 w-4 mr-2 text-destructive" /> : null}
              Check Name
            </Button>
            <Button onClick={openDeployDialog} disabled={deploying || !selectedConnection || project.status === "analyzing"}>
              {deploying ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Deploying...</> : <><Rocket className="h-4 w-4 mr-2" />Deploy Now</>}
            </Button>
          </div>
          {nameAvailable === true && <p className="text-xs text-primary mt-2">✅ Name available.</p>}
          {nameAvailable === false && <p className="text-xs text-muted-foreground mt-2">⚠️ Exists — will update.</p>}
          {connections.length === 0 && (
            <p className="text-xs text-muted-foreground mt-3">No connections. <a href="/connections" className="text-primary hover:underline">Connect a cloud</a> first.</p>
          )}
        </div>

        {/* Deployment History */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Deployment History</h3>
            {deployments.some((d) => ["queued", "building", "deploying"].includes(d.status)) && (
              <div className="flex items-center gap-2 text-xs text-primary">
                <RefreshCw className="h-3 w-3 animate-spin" /> Auto-refreshing
              </div>
            )}
          </div>
          {deployments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">No deployments yet</div>
          ) : (
            <div className="divide-y divide-border">
              {deployments.map((d) => (
                <div key={d.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={d.status} />
                      <span className="text-sm capitalize">{d.provider}</span>
                      {["queued", "building", "deploying"].includes(d.status) && (
                        <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {d.live_url && (
                        <a href={d.live_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                          Visit <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteDeployment(d.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {(d.status === "live" || d.cpu_usage != null) && (
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Cpu className="h-3 w-3" /> CPU: {d.cpu_usage != null ? `${d.cpu_usage}%` : "N/A"}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <HardDrive className="h-3 w-3" /> Memory: {d.memory_usage != null ? `${d.memory_usage}MB` : "N/A"}
                      </div>
                    </div>
                  )}
                  {d.error_message && (
                    <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-3 font-mono">{d.error_message}</div>
                  )}
                  {d.logs && (
                    <pre className="bg-muted/50 text-xs rounded-lg p-3 font-mono max-h-64 overflow-auto text-muted-foreground whitespace-pre-wrap">{d.logs}</pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Domain Dialog */}
      <Dialog open={showDomainDialog} onOpenChange={setShowDomainDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" /> Configure Domain
            </DialogTitle>
            <DialogDescription>Set a domain for your deployment. It checks availability in real-time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Domain / Subdomain</p>
              <div className="relative">
                <Input
                  value={customDomain}
                  onChange={(e) => handleDomainChange(e.target.value)}
                  placeholder={`my-project${conn?.provider === "vercel" ? ".vercel.app" : ".netlify.app"}`}
                  className="font-mono text-sm pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingDomain && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!checkingDomain && domainAvailable === true && <CheckCircle className="h-4 w-4 text-primary" />}
                  {!checkingDomain && domainAvailable === false && <XCircle className="h-4 w-4 text-destructive" />}
                </div>
              </div>
              {domainAvailable === true && <p className="text-xs text-primary mt-1">✅ Available!</p>}
              {domainAvailable === false && <p className="text-xs text-destructive mt-1">❌ Taken — you can still try deploying.</p>}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Default provider subdomain is assigned automatically.</p>
              <p>• Custom domains can also be added after deployment.</p>
              <p>• Domain availability is checked as you type.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDomainDialog(false)}>Cancel</Button>
            <Button onClick={handleDeploy} disabled={deploying}>
              <Rocket className="h-4 w-4 mr-2" /> Deploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
