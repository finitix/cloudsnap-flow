import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Rocket, ExternalLink, Terminal, Cpu, HardDrive, RefreshCw, Trash2, CheckCircle, XCircle, Globe, Server, Plus, X, Settings2, Pencil, ScrollText, AlertTriangle, Zap, Shield, Bell, Activity } from "lucide-react";
import { toast } from "sonner";

interface HealLog {
  id: string;
  attempt_number: number;
  error_category: string;
  error_message: string;
  fix_applied: string;
  result: string;
  created_at: string;
}

interface DeployAlert {
  id: string;
  alert_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

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
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [customStartCommand, setCustomStartCommand] = useState("");
  const [customBuildCommand, setCustomBuildCommand] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [renderLogs, setRenderLogs] = useState<Record<string, string[]>>({});
  const [fetchingLogs, setFetchingLogs] = useState<string | null>(null);
  const [healLogs, setHealLogs] = useState<Record<string, HealLog[]>>({});
  const [alerts, setAlerts] = useState<DeployAlert[]>([]);
  const [triggeringHeal, setTriggeringHeal] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const domainDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDeployments = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("deployments").select("*").eq("project_id", id).order("created_at", { ascending: false });
    if (data) setDeployments(data);
  }, [id]);

  const fetchAlerts = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from("deployment_alerts" as any).select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(10);
    if (data) setAlerts(data as any);
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
      const conns = cRes.data || [];
      setConnections(conns);
      setDeployments(dRes.data || []);
      fetchAlerts();

      const proj = pRes.data;
      if (proj && conns.length > 0) {
        const isBackend = proj.project_type === "backend" || proj.project_type === "fullstack";
        const renderConn = conns.find((c: any) => c.provider === "render");
        const vercelConn = conns.find((c: any) => c.provider === "vercel");
        if (isBackend && renderConn) setSelectedConnection(renderConn.id);
        else if (!isBackend && vercelConn) setSelectedConnection(vercelConn.id);
        else if (conns[0]) setSelectedConnection(conns[0].id);
      }
    };
    load();

    const channel = supabase
      .channel(`deployments-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deployments", filter: `project_id=eq.${id}` }, () => fetchDeployments())
      .subscribe();

    const alertChannel = supabase
      .channel(`alerts-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "deployment_alerts" }, () => fetchAlerts())
      .subscribe();

    return () => { supabase.removeChannel(channel); supabase.removeChannel(alertChannel); };
  }, [user, id, fetchDeployments, fetchAlerts]);

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
    return conn.provider === "vercel" ? ".vercel.app" : conn.provider === "render" ? ".onrender.com" : "";
  };

  const frontendConnections = connections.filter((c) => c.provider === "vercel");
  const backendConnections = connections.filter((c) => c.provider === "render");

  const checkDomainRealtime = useCallback(async (subdomain: string) => {
    const conn = getConn();
    if (!conn || !subdomain || subdomain.length < 2) { setDomainAvailable(null); return; }
    setCheckingDomain(true);
    try {
      const { data } = await supabase.functions.invoke("deploy-project", {
        body: { action: "check-domain", domain: subdomain + getProviderDomain(), provider: conn.provider, token: conn.token },
      });
      setDomainAvailable(data?.available ?? null);
    } catch { setDomainAvailable(null); }
    finally { setCheckingDomain(false); }
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
    if (!projectSubdomain || projectSubdomain.length < 2) { toast.error("Enter a valid project name (2+ chars)."); return; }
    setShowDomainDialog(false);
    if (!selectedConnection || !project) return;
    setDeploying(true);
    const conn = getConn();
    if (!conn) { setDeploying(false); return; }

    try {
      const { data: deployment, error } = await supabase.from("deployments").insert({
        project_id: project.id, user_id: user!.id, cloud_connection_id: conn.id, provider: conn.provider, status: "queued",
      }).select().single();
      if (error) throw error;
      toast.success("Deployment queued!");

      const { data, error: fnError } = await supabase.functions.invoke("deploy-project", {
        body: {
          deploymentId: deployment.id, projectId: project.id, connectionId: conn.id,
          customDomain: projectSubdomain + getProviderDomain(),
          envVars: conn.provider === "render" && envVars.length > 0 ? envVars.filter((e) => e.key && e.value) : undefined,
          customStartCommand: customStartCommand.trim() || undefined,
          customBuildCommand: customBuildCommand.trim() || undefined,
        },
      });
      if (fnError) { toast.error("Deployment failed — check logs."); }
      else if (data?.success) {
        toast.success(data.autoHealed ? `Deployed (auto-healed after ${data.retryCount} retries)!` : "Deployed successfully!");
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setDeploying(false); }
  };

  const handleRedeploy = async (depId: string) => {
    setRedeploying(depId);
    try {
      const { data, error } = await supabase.functions.invoke("deploy-project", { body: { action: "redeploy", deploymentId: depId } });
      if (error) throw error;
      if (data?.success) toast.success("Redeployment successful!");
      else toast.error("Redeploy failed");
      fetchDeployments();
    } catch (err: any) { toast.error("Redeploy failed: " + err.message); }
    finally { setRedeploying(null); }
  };

  const handleTriggerAutoHeal = async (depId: string) => {
    setTriggeringHeal(depId);
    try {
      const { data, error } = await supabase.functions.invoke("deploy-project", { body: { action: "trigger-autoheal", deploymentId: depId } });
      if (error) throw error;
      if (data?.success) toast.success(`Auto-heal succeeded after ${data.retryCount} retries!`);
      else toast.error(data?.error || "Auto-heal failed");
      fetchDeployments();
    } catch (err: any) { toast.error("Auto-heal failed: " + err.message); }
    finally { setTriggeringHeal(null); }
  };

  const handleFetchHealLogs = async (depId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("deploy-project", { body: { action: "autoheal-status", deploymentId: depId } });
      if (error) throw error;
      if (data?.success) setHealLogs((prev) => ({ ...prev, [depId]: data.healLogs }));
    } catch (err: any) { toast.error("Failed to fetch heal logs: " + err.message); }
  };

  const handleMarkAlertRead = async (alertId: string) => {
    await supabase.functions.invoke("deploy-project", { body: { action: "mark-alert-read", alertId } });
    setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, is_read: true } : a));
  };

  const handleDeleteDeployment = async (depId: string) => {
    if (!confirm("Delete this deployment record?")) return;
    try {
      await supabase.functions.invoke("deploy-project", { body: { action: "delete", deploymentId: depId } });
      setDeployments((prev) => prev.filter((d) => d.id !== depId));
      toast.success("Deployment deleted.");
    } catch (err: any) { toast.error("Delete failed: " + err.message); }
  };

  const handleDeleteProject = async () => {
    if (!project || !user) return;
    setDeletingProject(true);
    try {
      const { data, error } = await supabase.functions.invoke("deploy-project", { body: { action: "delete-project", projectId: project.id, userId: user.id } });
      if (error) throw error;
      toast.success("Project deleted.");
      navigate("/projects");
    } catch (err: any) { toast.error("Failed: " + err.message); }
    finally { setDeletingProject(false); }
  };

  const handleFetchLogs = async (depId: string) => {
    setFetchingLogs(depId);
    try {
      const { data, error } = await supabase.functions.invoke("deploy-project", { body: { action: "fetch-logs", deploymentId: depId } });
      if (error) throw error;
      if (data?.success && data.logs) {
        setRenderLogs((prev) => ({ ...prev, [depId]: data.logs.map((l: any) => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level}] ${l.message}`) }));
      } else {
        setRenderLogs((prev) => ({ ...prev, [depId]: ["No logs available."] }));
      }
    } catch (err: any) { toast.error("Failed: " + err.message); }
    finally { setFetchingLogs(null); }
  };

  const handleUpdateEnvVars = async (depId: string) => {
    const validVars = envVars.filter((e) => e.key && e.value);
    if (!validVars.length) { toast.error("Add at least one valid env variable."); return; }
    try {
      const { data, error } = await supabase.functions.invoke("deploy-project", { body: { action: "update-env-vars", deploymentId: depId, envVars: validVars } });
      if (error) throw error;
      toast.success("Environment variables updated!");
    } catch (err: any) { toast.error("Failed: " + err.message); }
  };

  const handleRenameProject = async () => {
    if (!newProjectName.trim() || !project) return;
    setRenaming(true);
    try {
      const { error } = await supabase.from("projects").update({ name: newProjectName.trim() }).eq("id", project.id);
      if (error) throw error;
      setProject({ ...project, name: newProjectName.trim() });
      setShowRenameDialog(false);
      toast.success("Project renamed!");
    } catch (err: any) { toast.error("Rename failed: " + err.message); }
    finally { setRenaming(false); }
  };

  if (!project) return <DashboardLayout><div className="p-8 text-muted-foreground">Loading...</div></DashboardLayout>;

  const conn = getConn();
  const providerSuffix = getProviderDomain();
  const hasBothTypes = frontendConnections.length > 0 && backendConnections.length > 0;
  const unreadAlerts = alerts.filter((a) => !a.is_read);

  const errorCategoryColor: Record<string, string> = {
    dependency_error: "bg-orange-500/15 text-orange-500",
    build_error: "bg-red-500/15 text-red-500",
    port_error: "bg-yellow-500/15 text-yellow-500",
    env_error: "bg-purple-500/15 text-purple-500",
    missing_files_error: "bg-blue-500/15 text-blue-500",
    timeout_error: "bg-cyan-500/15 text-cyan-500",
    unknown_error: "bg-muted text-muted-foreground",
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl">
        {/* Alerts Banner */}
        {unreadAlerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {unreadAlerts.map((alert) => (
              <div key={alert.id} className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Bell className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Auto-Heal Alert</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(alert.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => handleMarkAlertRead(alert.id)}>
                  Dismiss
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setNewProjectName(project.name); setShowRenameDialog(true); }}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {project.framework || "Unknown"} • {project.project_type || "Detecting..."} • {project.source_type}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deletingProject}>
                <Trash2 className="h-4 w-4 mr-2" />{deletingProject ? "Deleting..." : "Delete Project"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{project.name}" permanently?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete the project, all deployments, and files.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Forever</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Project Analysis */}
        <div className="glass-card rounded-xl p-6 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" /> Project Analysis
          </h3>

          {/* Overall info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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

          {/* Separate Frontend & Backend stacks */}
          {(project.project_type === "fullstack" || (project.frontend_framework && project.backend_framework)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Frontend Stack */}
              <div className="border border-border/50 rounded-lg p-4 bg-primary/5">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Frontend Stack</h4>
                  <Badge variant="outline" className="text-[10px] ml-auto">Vercel</Badge>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Framework</span><span className="font-mono font-medium">{project.frontend_framework || project.framework || "Unknown"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Build Command</span><span className="font-mono font-medium">{project.frontend_build_command || project.build_command || "npm run build"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Output Dir</span><span className="font-mono font-medium">{project.frontend_output_dir || project.output_dir || "dist"}</span></div>
                </div>
              </div>

              {/* Backend Stack */}
              <div className="border border-border/50 rounded-lg p-4 bg-accent/5">
                <div className="flex items-center gap-2 mb-3">
                  <Server className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">Backend Stack</h4>
                  <Badge variant="outline" className="text-[10px] ml-auto">Render</Badge>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Framework</span><span className="font-mono font-medium">{project.backend_framework || "Unknown"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Build Command</span><span className="font-mono font-medium">{project.backend_build_command || "npm install"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Start Command</span><span className="font-mono font-medium">{project.backend_start_command || "npm start"}</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Missing info prompt */}
          {project.project_type === "fullstack" && !project.backend_start_command && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
              <p className="text-sm font-semibold text-warning mb-2">⚠️ Missing Configuration</p>
              <p className="text-xs text-muted-foreground mb-3">We couldn't auto-detect the start command for your backend.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start Command (required for backend)</Label>
                  <Input value={customStartCommand} onChange={(e) => setCustomStartCommand(e.target.value)} placeholder="e.g. node server.js" className="font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Build Command</Label>
                  <Input value={customBuildCommand} onChange={(e) => setCustomBuildCommand(e.target.value)} placeholder="e.g. npm install" className="font-mono text-xs" />
                </div>
              </div>
            </div>
          )}

          {/* Auto-Heal Info */}
          <div className="bg-muted/30 rounded-lg p-4 border border-border/50 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Auto-Heal Protection</h4>
              <Badge className="bg-success/15 text-success text-[10px] ml-auto">Active</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              If a deployment fails, the system automatically analyzes the error, applies a fix, and retries up to 3 times.
              Supported error types: dependency errors, build failures, port conflicts, missing env vars, file upload issues, and timeouts.
            </p>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
            <h4 className="text-sm font-semibold mb-2">📋 How to Deploy</h4>
            {project.project_type === "backend" ? (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• This is a <strong>backend</strong> project — deploy with <strong>Render</strong></p>
                <p>• Runtime: {project.backend_framework || project.framework || "Node.js"}</p>
                <p>• Make sure your server listens on <code className="bg-muted px-1 rounded">$PORT</code></p>
              </div>
            ) : project.project_type === "fullstack" ? (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• This is a <strong>fullstack</strong> project with both frontend & backend</p>
                <p>• Frontend ({project.frontend_framework || "React"}) → Deploy to <strong>Vercel</strong></p>
                <p>• Backend ({project.backend_framework || "Node.js"}) → Deploy to <strong>Render</strong></p>
                <p>• Deploy each part separately using the appropriate connection</p>
                <p>• 💡 Set backend URL as an env var in your frontend for API calls</p>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• This is a <strong>frontend</strong> project — deploy with <strong>Vercel</strong></p>
                <p>• Build: <code className="bg-muted px-1 rounded">{project.build_command || "npm run build"}</code></p>
                <p>• Output: <code className="bg-muted px-1 rounded">{project.output_dir || "dist"}</code></p>
              </div>
            )}
          </div>
        </div>

        {/* Deploy Section */}
        <div className="glass-card rounded-xl p-6 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" /> Deploy
          </h3>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs text-muted-foreground mb-2">Cloud connection</p>
              <Select value={selectedConnection} onValueChange={setSelectedConnection}>
                <SelectTrigger><SelectValue placeholder="Choose connection" /></SelectTrigger>
                <SelectContent>
                  {hasBothTypes && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1"><Globe className="h-3 w-3" /> Frontend</div>
                      {frontendConnections.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name || c.provider} ({c.provider})</SelectItem>)}
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1 mt-1"><Server className="h-3 w-3" /> Backend</div>
                      {backendConnections.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name || c.provider} ({c.provider})</SelectItem>)}
                    </>
                  )}
                  {!hasBothTypes && connections.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name || c.provider} ({c.provider})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openDeployDialog} disabled={deploying || !selectedConnection || project.status === "analyzing"}>
              {deploying ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Deploying...</> : <><Rocket className="h-4 w-4 mr-2" />Deploy Now</>}
            </Button>
          </div>
          {connections.length === 0 && <p className="text-xs text-muted-foreground mt-3">No connections. <a href="/connections" className="text-primary hover:underline">Connect a cloud</a> first.</p>}

          {/* Custom Commands */}
          <div className="mt-4 border-t border-border pt-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Terminal className="h-3.5 w-3.5 text-primary" /> Custom Commands (optional)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Build Command</Label>
                <Input value={customBuildCommand} onChange={(e) => setCustomBuildCommand(e.target.value)} placeholder={project.build_command || "npm install"} className="font-mono text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start Command</Label>
                <Input value={customStartCommand} onChange={(e) => setCustomStartCommand(e.target.value)} placeholder="node server.js" className="font-mono text-xs" />
              </div>
            </div>
          </div>

          {/* Environment Variables */}
          {conn?.provider === "render" && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold flex items-center gap-2"><Settings2 className="h-3.5 w-3.5 text-primary" /> Environment Variables</h4>
                <Button variant="outline" size="sm" onClick={() => setEnvVars([...envVars, { key: "", value: "" }])} className="text-xs"><Plus className="h-3 w-3 mr-1" /> Add</Button>
              </div>
              {envVars.length === 0 ? (
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">No environment variables set.</p>
              ) : (
                <div className="space-y-2">
                  {envVars.map((env, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input placeholder="KEY" value={env.key} onChange={(e) => { const u = [...envVars]; u[idx].key = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""); setEnvVars(u); }} className="flex-1 font-mono text-xs" />
                      <Input placeholder="value" type="password" value={env.value} onChange={(e) => { const u = [...envVars]; u[idx].value = e.target.value; setEnvVars(u); }} className="flex-1 font-mono text-xs" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => setEnvVars(envVars.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Deployment History */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold">Deployment History</h3>
            {deployments.some((d) => ["queued", "building", "deploying"].includes(d.status)) && (
              <div className="flex items-center gap-2 text-xs text-primary"><RefreshCw className="h-3 w-3 animate-spin" /> Auto-refreshing</div>
            )}
          </div>
          {deployments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">No deployments yet</div>
          ) : (
            <div className="divide-y divide-border">
              {deployments.map((d) => (
                <div key={d.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={d.status} />
                      <span className="text-sm capitalize">{d.provider}</span>
                      {["queued", "building", "deploying"].includes(d.status) && <RefreshCw className="h-3 w-3 animate-spin text-primary" />}
                      {(d as any).retry_count > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Zap className="h-2.5 w-2.5" /> {(d as any).retry_count} retries
                        </Badge>
                      )}
                      {(d as any).last_error_category && (d as any).last_error_category !== "exhausted" && (
                        <Badge className={`text-[10px] ${errorCategoryColor[(d as any).last_error_category] || errorCategoryColor.unknown_error}`}>
                          {(d as any).last_error_category?.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Auto-Heal button for failed deployments */}
                      {d.status === "error" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTriggerAutoHeal(d.id)}
                          disabled={triggeringHeal === d.id}
                          className="text-xs border-warning/50 text-warning hover:bg-warning/10"
                        >
                          {triggeringHeal === d.id ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Healing...</> : <><Zap className="h-3 w-3 mr-1" />Auto-Heal</>}
                        </Button>
                      )}
                      {d.status === "error" && (
                        <Button variant="outline" size="sm" onClick={() => handleFetchHealLogs(d.id)} className="text-xs">
                          <Activity className="h-3 w-3 mr-1" /> Heal Logs
                        </Button>
                      )}
                      {d.status === "live" && d.provider === "render" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleUpdateEnvVars(d.id)} className="text-xs"><Settings2 className="h-3 w-3 mr-1" />Update Env</Button>
                          <Button variant="outline" size="sm" onClick={() => handleFetchLogs(d.id)} disabled={fetchingLogs === d.id} className="text-xs">
                            {fetchingLogs === d.id ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Fetching...</> : <><ScrollText className="h-3 w-3 mr-1" />Logs</>}
                          </Button>
                        </>
                      )}
                      {d.status === "live" && (
                        <Button variant="outline" size="sm" onClick={() => handleRedeploy(d.id)} disabled={redeploying === d.id} className="text-xs">
                          {redeploying === d.id ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Redeploying...</> : <><RefreshCw className="h-3 w-3 mr-1" />Redeploy</>}
                        </Button>
                      )}
                      {d.live_url && (
                        <a href={d.live_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">Visit <ExternalLink className="h-3 w-3" /></a>
                      )}
                      <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteDeployment(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>

                  {d.status === "live" && d.provider === "render" && (
                    <div className="bg-warning/10 text-warning text-xs rounded-lg p-2">⚠️ Free Render services spin down after ~15min of inactivity.</div>
                  )}

                  {(d.status === "live" || d.cpu_usage != null) && (
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Cpu className="h-3 w-3" /> CPU: {d.cpu_usage != null ? `${d.cpu_usage}%` : "N/A"}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground"><HardDrive className="h-3 w-3" /> Memory: {d.memory_usage != null ? `${d.memory_usage}MB` : "N/A"}</div>
                    </div>
                  )}

                  {d.error_message && (
                    <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-3 font-mono">{d.error_message}</div>
                  )}

                  {/* Heal Logs */}
                  {healLogs[d.id] && healLogs[d.id].length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold flex items-center gap-1"><Activity className="h-3 w-3 text-primary" /> Auto-Heal History</p>
                      <div className="space-y-1">
                        {healLogs[d.id].map((log, idx) => (
                          <div key={idx} className="bg-muted/30 rounded-lg p-3 text-xs border border-border/50">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">Attempt #{log.attempt_number}</span>
                                <Badge className={`text-[10px] ${errorCategoryColor[log.error_category] || ""}`}>{log.error_category?.replace(/_/g, " ")}</Badge>
                                <Badge className={`text-[10px] ${log.result === "success" ? "bg-success/15 text-success" : log.result === "failed" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                                  {log.result}
                                </Badge>
                              </div>
                              <span className="text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-muted-foreground"><strong>Fix:</strong> {log.fix_applied}</p>
                            {log.error_message && <p className="text-destructive/80 font-mono mt-1 truncate">{log.error_message}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {d.logs && (
                    <pre className="bg-muted/50 text-xs rounded-lg p-3 font-mono max-h-64 overflow-auto text-muted-foreground whitespace-pre-wrap">{d.logs}</pre>
                  )}
                  {renderLogs[d.id] && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold flex items-center gap-1"><ScrollText className="h-3 w-3 text-primary" /> Provider Logs</p>
                      <pre className="bg-background/80 text-xs rounded-lg p-3 font-mono max-h-64 overflow-auto text-muted-foreground whitespace-pre-wrap border border-border/50">{renderLogs[d.id].join("\n")}</pre>
                    </div>
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
            <DialogTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> Configure Deployment</DialogTitle>
            <DialogDescription>Choose a name for your deployment on {conn?.provider || "the provider"}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Project Name / Subdomain</p>
              <div className="flex items-center gap-0">
                <div className="relative flex-1">
                  <Input value={projectSubdomain} onChange={(e) => handleSubdomainChange(e.target.value)} placeholder="my-project" className="font-mono text-sm rounded-r-none border-r-0 pr-10" />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingDomain && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {!checkingDomain && domainAvailable === true && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {!checkingDomain && domainAvailable === false && <XCircle className="h-4 w-4 text-red-500" />}
                  </div>
                </div>
                <div className="bg-muted border border-border border-l-0 rounded-r-md px-3 py-2 text-sm text-muted-foreground font-mono">{providerSuffix}</div>
              </div>
              {domainAvailable === false && <p className="text-xs text-destructive mt-1">This name is taken.</p>}
              {domainAvailable === true && <p className="text-xs text-green-500 mt-1">Available!</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDomainDialog(false)}>Cancel</Button>
            <Button onClick={handleDeploy} disabled={deploying || domainAvailable === false || checkingDomain}>
              {deploying ? "Deploying..." : "Deploy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>Enter a new name for your project.</DialogDescription>
          </DialogHeader>
          <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="New project name" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>Cancel</Button>
            <Button onClick={handleRenameProject} disabled={renaming}>{renaming ? "Renaming..." : "Rename"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
