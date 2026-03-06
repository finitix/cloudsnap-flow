import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Rocket, ExternalLink, Terminal, Cpu, HardDrive, RefreshCw, Trash2, CheckCircle, XCircle, Globe, Server } from "lucide-react";
import { toast } from "sonner";

export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnection, setSelectedConnection] = useState("");
  const [deployments, setDeployments] = useState<any[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [redeploying, setRedeploying] = useState<string | null>(null);
  const [showDomainDialog, setShowDomainDialog] = useState(false);
  const [projectSubdomain, setProjectSubdomain] = useState("");
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
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

  const getProviderDomain = () => {
    const conn = getConn();
    if (!conn) return "";
    if (conn.provider === "vercel") return ".vercel.app";
    if (conn.provider === "render") return ".onrender.com";
    return "";
  };

  const frontendConnections = connections.filter((c) => c.provider === "vercel");
  const backendConnections = connections.filter((c) => c.provider === "render");

  const checkDomainRealtime = useCallback(async (subdomain: string) => {
    const conn = getConn();
    if (!conn || !subdomain || subdomain.length < 2) { setDomainAvailable(null); return; }
    const domain = subdomain + getProviderDomain();
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

  const handleSubdomainChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setProjectSubdomain(cleaned);
    setDomainAvailable(null);
    if (domainDebounceRef.current) clearTimeout(domainDebounceRef.current);
    domainDebounceRef.current = setTimeout(() => checkDomainRealtime(cleaned), 800);
  };

  const openDeployDialog = () => {
    if (!getConn() || !project) return;
    const pn = project.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    setProjectSubdomain(pn);
    setDomainAvailable(null);
    setShowDomainDialog(true);
    setTimeout(() => checkDomainRealtime(pn), 300);
  };

  const handleDeploy = async () => {
    if (!projectSubdomain || projectSubdomain.length < 2) {
      toast.error("Please enter a valid project name (at least 2 characters).");
      return;
    }
    setShowDomainDialog(false);
    if (!selectedConnection || !project) return;
    setDeploying(true);
    const conn = getConn();
    if (!conn) { setDeploying(false); return; }

    const fullDomain = projectSubdomain + getProviderDomain();

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
          customDomain: fullDomain,
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

  const handleRedeploy = async (depId: string) => {
    setRedeploying(depId);
    try {
      const { data, error } = await supabase.functions.invoke("deploy-project", {
        body: { action: "redeploy", deploymentId: depId },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Redeployment successful!");
      } else {
        toast.error("Redeploy failed");
      }
      fetchDeployments();
    } catch (err: any) {
      toast.error("Redeploy failed: " + err.message);
    } finally {
      setRedeploying(null);
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


  const handleDeleteProject = async () => {
    if (!project || !user) return;
    setDeletingProject(true);
    try {
      // Delete all deployments for this project
      await supabase.from("deployments").delete().eq("project_id", project.id);

      // Delete storage files for this project
      const { data: files } = await supabase.storage.from("project-uploads").list(`${user.id}`);
      if (files?.length) {
        const projectFiles = files.filter((f) => f.name.includes(project.id) || f.name.includes(project.name));
        if (projectFiles.length > 0) {
          await supabase.storage.from("project-uploads").remove(projectFiles.map((f) => `${user.id}/${f.name}`));
        }
      }

      // Delete the project itself
      const { error } = await supabase.from("projects").delete().eq("id", project.id);
      if (error) throw error;

      toast.success("Project deleted permanently.");
      navigate("/projects");
    } catch (err: any) {
      toast.error("Failed to delete project: " + err.message);
    } finally {
      setDeletingProject(false);
    }
  };

  if (!project) return <DashboardLayout><div className="p-8 text-muted-foreground">Loading...</div></DashboardLayout>;

  const conn = getConn();
  const providerSuffix = getProviderDomain();
  const hasBothTypes = frontendConnections.length > 0 && backendConnections.length > 0;

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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deletingProject}>
                <Trash2 className="h-4 w-4 mr-2" />
                {deletingProject ? "Deleting..." : "Delete Project"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{project.name}" permanently?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the project, all its deployments, and associated files. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
              <Select value={selectedConnection} onValueChange={(v) => { setSelectedConnection(v); }}>
                <SelectTrigger><SelectValue placeholder="Choose connection" /></SelectTrigger>
                <SelectContent>
                  {connections.length > 0 && hasBothTypes && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> Frontend</div>
                      {frontendConnections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.display_name || c.provider} ({c.provider})</SelectItem>
                      ))}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-1"><Server className="h-3 w-3" /> Backend</div>
                      {backendConnections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.display_name || c.provider} ({c.provider})</SelectItem>
                      ))}
                    </>
                  )}
                  {connections.length > 0 && !hasBothTypes && connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.display_name || c.provider} ({c.provider})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openDeployDialog} disabled={deploying || !selectedConnection || project.status === "analyzing"}>
              {deploying ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Deploying...</> : <><Rocket className="h-4 w-4 mr-2" />Deploy Now</>}
            </Button>
          </div>
          {connections.length === 0 && (
            <p className="text-xs text-muted-foreground mt-3">No connections. <a href="/connections" className="text-primary hover:underline">Connect a cloud</a> first.</p>
          )}
          {hasBothTypes && (
            <p className="text-xs text-muted-foreground mt-3 bg-muted/50 rounded-lg p-2">
              💡 You have both frontend (Vercel) and backend (Render) connections. Select the appropriate one for your deployment target.
            </p>
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
                      {d.status === "live" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRedeploy(d.id)}
                          disabled={redeploying === d.id}
                          className="text-xs"
                        >
                          {redeploying === d.id ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Redeploying...</> : <><RefreshCw className="h-3 w-3 mr-1" />Redeploy</>}
                        </Button>
                      )}
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
              <Globe className="h-5 w-5 text-primary" /> Configure Project Name
            </DialogTitle>
            <DialogDescription>
              Choose a name for your deployment on {conn?.provider || "the provider"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Project Name / Subdomain</p>
              <div className="flex items-center gap-0">
                <div className="relative flex-1">
                  <Input
                    value={projectSubdomain}
                    onChange={(e) => handleSubdomainChange(e.target.value)}
                    placeholder="my-project"
                    className="font-mono text-sm rounded-r-none border-r-0 pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingDomain && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {!checkingDomain && domainAvailable === true && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {!checkingDomain && domainAvailable === false && <XCircle className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
                <div className="bg-muted border border-border rounded-r-md px-3 py-2 text-sm text-muted-foreground font-mono whitespace-nowrap">
                  {providerSuffix || ".provider.app"}
                </div>
              </div>
              {domainAvailable === true && (
                <p className="text-xs text-green-500 mt-1">✅ {projectSubdomain}{providerSuffix} is available!</p>
              )}
              {domainAvailable === false && (
                <p className="text-xs text-destructive mt-1">❌ {projectSubdomain}{providerSuffix} already exists. Try a different name.</p>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                Your site will be deployed to: <span className="font-mono text-foreground font-medium">{projectSubdomain}{providerSuffix}</span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDomainDialog(false)}>Cancel</Button>
            <Button onClick={handleDeploy} disabled={deploying || !projectSubdomain || domainAvailable === false}>
              <Rocket className="h-4 w-4 mr-2" /> Deploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
