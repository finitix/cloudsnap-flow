import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Activity, Search, RefreshCw, ExternalLink, Clock, Cpu, HardDrive,
  AlertTriangle, CheckCircle, BarChart3, List, Terminal, Heart,
  Shield, Wifi, WifiOff, Globe, Zap, ArrowUpDown, Info,
  XCircle, Timer, TrendingUp, Server, Eye
} from "lucide-react";
import { toast } from "sonner";

interface HealthCheckResult {
  reachable: boolean;
  statusCode: number;
  responseTime: number;
  error: string;
}

interface ServiceInfo {
  id: string;
  name: string;
  status: string;
  type: string;
  runtime: string;
  plan: string;
  region: string;
  createdAt: string;
  updatedAt: string;
}

interface DeployHistoryItem {
  id: string;
  status: string;
  createdAt: string;
  finishedAt: string;
  commit: string;
}

interface LogEntry {
  timestamp: string;
  message: string;
  level: string;
}

export default function Monitoring() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [deployments, setDeployments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [logLevelFilter, setLogLevelFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [healthData, setHealthData] = useState<Record<string, { health: HealthCheckResult; history: DeployHistoryItem[] }>>({});
  const [serviceData, setServiceData] = useState<Record<string, { info: ServiceInfo | null; logs: LogEntry[]; envKeys: { key: string }[] }>>({});
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeDeployId, setActiveDeployId] = useState<string>("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("projects").select("*").order("created_at", { ascending: false })
      .then(({ data }) => {
        setProjects(data || []);
        if (data?.[0]) setSelectedProjectId(data[0].id);
      });
  }, [user]);

  const fetchDeployments = useCallback(async () => {
    if (!selectedProjectId) return;
    const { data } = await supabase
      .from("deployments")
      .select("*")
      .eq("project_id", selectedProjectId)
      .order("created_at", { ascending: false });
    if (data) {
      setDeployments(data);
      // Auto-select first live deployment
      const live = data.find((d) => d.status === "live");
      if (live && !activeDeployId) setActiveDeployId(live.id);
      else if (data[0] && !activeDeployId) setActiveDeployId(data[0].id);
    }
  }, [selectedProjectId]);

  useEffect(() => { fetchDeployments(); }, [fetchDeployments]);

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

  const fetchHealth = async (depId: string) => {
    setLoadingHealth(true);
    try {
      const { data, error } = await supabase.functions.invoke("deploy-project", {
        body: { action: "fetch-health", deploymentId: depId },
      });
      if (error) throw error;
      if (data?.success) {
        setHealthData((prev) => ({
          ...prev,
          [depId]: { health: data.healthCheck, history: data.deployHistory || [] },
        }));
      }
    } catch (err: any) {
      toast.error("Health check failed: " + err.message);
    } finally {
      setLoadingHealth(false);
    }
  };

  const fetchLogs = async (depId: string) => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase.functions.invoke("deploy-project", {
        body: { action: "fetch-logs", deploymentId: depId },
      });
      if (error) throw error;
      if (data?.success) {
        setServiceData((prev) => ({
          ...prev,
          [depId]: { info: data.serviceInfo, logs: data.logs || [], envKeys: data.envKeys || [] },
        }));
      }
    } catch (err: any) {
      toast.error("Log fetch failed: " + err.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDeployments();
    if (activeDeployId) {
      await Promise.all([fetchHealth(activeDeployId), fetchLogs(activeDeployId)]);
    }
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleInspect = async (depId: string) => {
    setActiveDeployId(depId);
    await Promise.all([fetchHealth(depId), fetchLogs(depId)]);
  };

  const filteredDeployments = deployments.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        d.provider?.toLowerCase().includes(q) ||
        d.status?.toLowerCase().includes(q) ||
        d.logs?.toLowerCase().includes(q) ||
        d.live_url?.toLowerCase().includes(q) ||
        d.error_message?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const activeDep = deployments.find((d) => d.id === activeDeployId);
  const activeHealth = healthData[activeDeployId];
  const activeService = serviceData[activeDeployId];

  // Stats
  const totalDeploys = deployments.length;
  const liveDeploys = deployments.filter((d) => d.status === "live").length;
  const errorDeploys = deployments.filter((d) => d.status === "error").length;
  const activeDeploys = deployments.filter((d) => ["queued", "building", "deploying"].includes(d.status)).length;
  const avgBuildTime = (() => {
    const completed = deployments.filter((d) => d.status === "live" && d.created_at && d.updated_at);
    if (completed.length === 0) return "N/A";
    const avg = completed.reduce((sum, d) => sum + (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()), 0) / completed.length;
    return `${Math.round(avg / 1000)}s`;
  })();
  const successRate = totalDeploys > 0 ? Math.round((liveDeploys / totalDeploys) * 100) : 0;
  const uptimeEstimate = activeHealth?.health?.reachable ? "Online" : activeHealth ? "Offline" : "—";

  // Filter logs by level
  const filteredLogs = (activeService?.logs || []).filter((l) => {
    if (logLevelFilter === "all") return true;
    return l.level === logLevelFilter;
  });

  // Explain errors in plain language
  const explainError = (error: string): string => {
    if (!error) return "";
    const lower = error.toLowerCase();
    if (lower.includes("build_failed")) return "🔧 Your code couldn't be compiled. This usually means there's a syntax error or a missing package. Check the build logs above for the exact line.";
    if (lower.includes("timeout")) return "⏱️ The deployment took too long and was stopped. This can happen with large projects or slow install steps. Try simplifying your build command.";
    if (lower.includes("port") || lower.includes("bind")) return "🔌 Your app isn't listening on the right port. Make sure your server uses process.env.PORT (Render provides this automatically).";
    if (lower.includes("memory") || lower.includes("oom")) return "💾 Your app ran out of memory. Free tier has limited RAM. Try optimizing your code or upgrading your plan.";
    if (lower.includes("econnrefused") || lower.includes("connection refused")) return "🚫 The server started but isn't accepting connections. Check that your app binds to 0.0.0.0 (not just localhost) on the correct port.";
    if (lower.includes("blocked_by_response") || lower.includes("refused to connect")) return "🔒 The browser blocked the connection. This happens when Render's free tier spins down after inactivity (~15 min). Wait 30-60 seconds and try again.";
    if (lower.includes("module not found") || lower.includes("cannot find module")) return "📦 A required package is missing. Make sure all dependencies are listed in package.json and run npm install.";
    if (lower.includes("permission")) return "🔐 Permission denied. Your app doesn't have the right access level to perform this action.";
    if (lower.includes("dns") || lower.includes("getaddrinfo")) return "🌐 DNS lookup failed. The domain or service you're trying to reach doesn't exist or isn't configured properly.";
    return `⚠️ ${error}`;
  };

  // Explain status in plain language
  const explainStatus = (status: string): string => {
    switch (status) {
      case "live": return "Your app is running and accessible to everyone.";
      case "building": return "Your code is being compiled and prepared for deployment.";
      case "deploying": return "Your built app is being uploaded to the server.";
      case "queued": return "Waiting in line to start building. This usually takes a few seconds.";
      case "error": return "Something went wrong. Check the error details below for what happened.";
      case "build_failed": return "The build step failed. Usually a code error or missing dependency.";
      default: return `Status: ${status}`;
    }
  };

  const getResponseTimeColor = (ms: number) => {
    if (ms < 500) return "text-success";
    if (ms < 2000) return "text-warning";
    return "text-destructive";
  };

  const getResponseTimeLabel = (ms: number) => {
    if (ms < 200) return "Excellent";
    if (ms < 500) return "Good";
    if (ms < 2000) return "Slow (might be cold starting)";
    return "Very slow — check service health";
  };

  return (
    <DashboardLayout>
      <div className="p-8 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" /> Monitoring Center
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Real-time health, logs, and deployment analytics — explained simply</p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh All
          </Button>
        </div>

        {/* Project Selector */}
        <div className="glass-card rounded-xl p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select value={selectedProjectId} onValueChange={(v) => { setSelectedProjectId(v); setActiveDeployId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — {p.framework || "Unknown"} ({p.source_type})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProject && (
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedProject.status} />
                <span className="text-xs text-muted-foreground">{selectedProject.framework}</span>
              </div>
            )}
          </div>
        </div>

        {selectedProjectId && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              {[
                { label: "Total Deploys", value: totalDeploys, icon: BarChart3, color: "text-primary" },
                { label: "Live", value: liveDeploys, icon: CheckCircle, color: "text-success" },
                { label: "Errors", value: errorDeploys, icon: AlertTriangle, color: "text-destructive" },
                { label: "In Progress", value: activeDeploys, icon: RefreshCw, color: "text-warning" },
                { label: "Avg Build", value: avgBuildTime, icon: Clock, color: "text-info" },
                { label: "Success Rate", value: `${successRate}%`, icon: TrendingUp, color: successRate >= 80 ? "text-success" : successRate >= 50 ? "text-warning" : "text-destructive" },
                { label: "Status", value: uptimeEstimate, icon: Heart, color: uptimeEstimate === "Online" ? "text-success" : uptimeEstimate === "Offline" ? "text-destructive" : "text-muted-foreground" },
              ].map((s) => (
                <div key={s.label} className="glass-card rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
                    <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                  </div>
                  <p className="text-xl font-bold font-mono">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Success Rate Bar */}
            <div className="glass-card rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Deployment Success Rate</span>
                <span className="text-sm font-mono font-bold">{successRate}%</span>
              </div>
              <Progress value={successRate} className="h-2" />
              <p className="text-xs text-muted-foreground mt-2">
                {successRate === 100 ? "🎉 Perfect record! All deployments succeeded." :
                 successRate >= 80 ? "👍 Healthy — most deployments succeed." :
                 successRate >= 50 ? "⚠️ Some issues — review failed deployments below." :
                 totalDeploys === 0 ? "No deployments yet." :
                 "🔴 Many failures — check your build configuration and logs."}
              </p>
            </div>

            {/* Main Tabs */}
            <Tabs defaultValue="health" className="space-y-4">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="health"><Heart className="h-4 w-4 mr-2" />Health & Network</TabsTrigger>
                <TabsTrigger value="timeline"><List className="h-4 w-4 mr-2" />Deploy Timeline</TabsTrigger>
                <TabsTrigger value="logs"><Terminal className="h-4 w-4 mr-2" />Service Logs</TabsTrigger>
                <TabsTrigger value="errors"><AlertTriangle className="h-4 w-4 mr-2" />Error Analysis</TabsTrigger>
                <TabsTrigger value="infra"><Server className="h-4 w-4 mr-2" />Infrastructure</TabsTrigger>
              </TabsList>

              {/* ═══ Health & Network Tab ═══ */}
              <TabsContent value="health">
                <div className="glass-card rounded-xl p-6">
                  {!activeDeployId ? (
                    <p className="text-muted-foreground text-sm text-center py-8">Select a deployment from the timeline to inspect its health.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold flex items-center gap-2">
                          <Heart className="h-4 w-4 text-primary" />
                          Health Check — {activeDep?.live_url?.replace("https://", "") || "N/A"}
                        </h3>
                        <Button variant="outline" size="sm" onClick={() => fetchHealth(activeDeployId)} disabled={loadingHealth}>
                          {loadingHealth ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
                          Run Health Check
                        </Button>
                      </div>

                      {activeHealth ? (
                        <div className="space-y-6">
                          {/* Connection Status */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
                              <div className="flex items-center gap-2 mb-2">
                                {activeHealth.health.reachable ? <Wifi className="h-5 w-5 text-success" /> : <WifiOff className="h-5 w-5 text-destructive" />}
                                <span className="font-medium">Connectivity</span>
                              </div>
                              <p className="text-2xl font-bold">{activeHealth.health.reachable ? "Reachable" : "Unreachable"}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {activeHealth.health.reachable
                                  ? "✅ Your app is responding to requests."
                                  : "❌ Can't reach your app. " + (activeHealth.health.error || "It may be spun down or misconfigured.")}
                              </p>
                            </div>

                            <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
                              <div className="flex items-center gap-2 mb-2">
                                <Globe className="h-5 w-5 text-info" />
                                <span className="font-medium">HTTP Status</span>
                              </div>
                              <p className="text-2xl font-bold">{activeHealth.health.statusCode || "—"}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {activeHealth.health.statusCode === 200 ? "✅ 200 OK — Everything is working perfectly." :
                                 activeHealth.health.statusCode === 301 || activeHealth.health.statusCode === 302 ? "↩️ Redirect — Your app is redirecting to another page." :
                                 activeHealth.health.statusCode === 404 ? "🔍 404 Not Found — The page doesn't exist at this URL." :
                                 activeHealth.health.statusCode === 500 ? "💥 500 Server Error — Your app crashed while handling the request." :
                                 activeHealth.health.statusCode === 502 ? "🔄 502 Bad Gateway — Your app isn't running or crashed on startup." :
                                 activeHealth.health.statusCode === 503 ? "😴 503 Unavailable — Service is down, possibly spinning up." :
                                 activeHealth.health.statusCode === 0 ? "No response received from the server." :
                                 `HTTP ${activeHealth.health.statusCode}`}
                              </p>
                            </div>

                            <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
                              <div className="flex items-center gap-2 mb-2">
                                <Timer className="h-5 w-5 text-warning" />
                                <span className="font-medium">Response Time</span>
                              </div>
                              <p className={`text-2xl font-bold ${getResponseTimeColor(activeHealth.health.responseTime)}`}>
                                {activeHealth.health.responseTime}ms
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {getResponseTimeLabel(activeHealth.health.responseTime)}
                              </p>
                            </div>
                          </div>

                          {/* Network & Ports Info */}
                          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                              <Shield className="h-4 w-4 text-primary" /> Network & Ports — What You Need to Know
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <ArrowUpDown className="h-3.5 w-3.5 mt-0.5 text-success shrink-0" />
                                  <div>
                                    <p className="font-medium text-foreground">Inbound (traffic coming in)</p>
                                    <p>Port <code className="bg-muted px-1 rounded">443</code> (HTTPS) is open — this is how users access your app. Render handles SSL/TLS automatically.</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <ArrowUpDown className="h-3.5 w-3.5 mt-0.5 text-info shrink-0" />
                                  <div>
                                    <p className="font-medium text-foreground">Internal Port</p>
                                    <p>Your app must listen on <code className="bg-muted px-1 rounded">$PORT</code> (Render sets this, usually 10000). Don't hardcode a port number.</p>
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <ArrowUpDown className="h-3.5 w-3.5 mt-0.5 text-warning shrink-0" />
                                  <div>
                                    <p className="font-medium text-foreground">Outbound (traffic going out)</p>
                                    <p>All outbound connections are allowed — your app can call any external API, database, or service without restrictions.</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <Shield className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                                  <div>
                                    <p className="font-medium text-foreground">Security</p>
                                    <p>HTTPS is enforced automatically. HTTP requests are redirected to HTTPS. Your app runs in an isolated container.</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Recent Deploy History from Provider */}
                          {activeHealth.history.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-3">Recent Deploy History (from Render)</h4>
                              <div className="space-y-2">
                                {activeHealth.history.map((h) => (
                                  <div key={h.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-2 text-xs">
                                    <div className="flex items-center gap-3">
                                      {h.status === "live" ? <CheckCircle className="h-3.5 w-3.5 text-success" /> :
                                       h.status === "build_failed" ? <XCircle className="h-3.5 w-3.5 text-destructive" /> :
                                       <RefreshCw className="h-3.5 w-3.5 text-warning" />}
                                      <span className="font-mono">{h.status}</span>
                                      {h.commit && <span className="text-muted-foreground truncate max-w-[200px]">"{h.commit}"</span>}
                                    </div>
                                    <span className="text-muted-foreground">{h.createdAt ? new Date(h.createdAt).toLocaleString() : "—"}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          <Heart className="h-8 w-8 mx-auto mb-3 opacity-30" />
                          <p>Click "Run Health Check" to test your deployment's connectivity, response time, and status.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>

              {/* ═══ Deploy Timeline Tab ═══ */}
              <TabsContent value="timeline">
                <div className="glass-card rounded-xl overflow-hidden">
                  {/* Filters */}
                  <div className="p-4 border-b border-border flex items-center gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search logs, URLs, errors..." className="pl-9 text-sm" />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                        <SelectItem value="building">Building</SelectItem>
                        <SelectItem value="deploying">Deploying</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="queued">Queued</SelectItem>
                      </SelectContent>
                    </Select>
                    {activeDeploys > 0 && (
                      <div className="flex items-center gap-2 text-xs text-primary ml-auto">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Live updating
                      </div>
                    )}
                  </div>

                  {filteredDeployments.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground text-sm">No deployments match your filters</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredDeployments.map((d) => (
                        <div key={d.id} className={`p-4 space-y-3 hover:bg-muted/10 transition-colors ${activeDeployId === d.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <StatusBadge status={d.status} />
                              <span className="text-sm font-medium capitalize">{d.provider}</span>
                              <span className="text-xs text-muted-foreground font-mono">{d.deploy_id?.slice(0, 12) || "—"}</span>
                              {["queued", "building", "deploying"].includes(d.status) && <RefreshCw className="h-3 w-3 animate-spin text-primary" />}
                            </div>
                            <div className="flex items-center gap-3">
                              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleInspect(d.id)}>
                                <Eye className="h-3 w-3 mr-1" /> Inspect
                              </Button>
                              {d.live_url && (
                                <a href={d.live_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                  {d.live_url.replace("https://", "")} <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Plain-language status explanation */}
                          <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                            <Info className="h-3 w-3 inline mr-1" />
                            {explainStatus(d.status)}
                          </p>

                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                              Duration: {d.updated_at && d.created_at ? `${Math.round((new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / 1000)}s` : "—"}
                            </span>
                            <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU: {d.cpu_usage ?? "N/A"}</span>
                            <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> Mem: {d.memory_usage ?? "N/A"}</span>
                          </div>

                          {d.error_message && (
                            <div className="space-y-2">
                              <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-3 font-mono">{d.error_message}</div>
                              <div className="bg-muted/30 text-xs rounded-lg p-3 text-muted-foreground">
                                {explainError(d.error_message)}
                              </div>
                            </div>
                          )}

                          {d.logs && (
                            <details className="group">
                              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                                View build logs ({d.logs.split("\n").filter(Boolean).length} lines)
                              </summary>
                              <pre className="mt-2 bg-background/80 text-xs rounded-lg p-3 font-mono max-h-80 overflow-auto text-muted-foreground whitespace-pre-wrap border border-border/50">{d.logs}</pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ═══ Service Logs Tab ═══ */}
              <TabsContent value="logs">
                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-primary" /> Live Service Logs
                    </h3>
                    <div className="flex items-center gap-2">
                      <Select value={logLevelFilter} onValueChange={setLogLevelFilter}>
                        <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Levels</SelectItem>
                          <SelectItem value="info">Info</SelectItem>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="error">Error</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={() => activeDeployId && fetchLogs(activeDeployId)} disabled={loadingLogs || !activeDeployId}>
                        {loadingLogs ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Fetch Logs
                      </Button>
                    </div>
                  </div>

                  {!activeDeployId ? (
                    <p className="text-muted-foreground text-sm text-center py-8">Select a deployment from the timeline first, then fetch its logs.</p>
                  ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <Terminal className="h-8 w-8 mx-auto mb-3 opacity-30" />
                      <p>No logs loaded. Click "Fetch Logs" to pull the latest service logs from the provider.</p>
                    </div>
                  ) : (
                    <div className="bg-background/80 rounded-lg border border-border/50 max-h-[500px] overflow-auto">
                      {filteredLogs.map((log, i) => (
                        <div key={i} className={`flex items-start gap-3 px-4 py-1.5 text-xs font-mono border-b border-border/20 hover:bg-muted/20 ${
                          log.level === "error" ? "bg-destructive/5" : log.level === "warning" ? "bg-warning/5" : ""
                        }`}>
                          <span className="text-muted-foreground shrink-0 w-[140px]">
                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "—"}
                          </span>
                          <span className={`shrink-0 w-[50px] uppercase font-bold ${
                            log.level === "error" ? "text-destructive" : log.level === "warning" ? "text-warning" : "text-muted-foreground"
                          }`}>{log.level}</span>
                          <span className="text-foreground whitespace-pre-wrap break-all">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ═══ Error Analysis Tab ═══ */}
              <TabsContent value="errors">
                <div className="glass-card rounded-xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" /> Error Analysis — What Went Wrong & How to Fix It
                  </h3>

                  {errorDeploys === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                      <CheckCircle className="h-10 w-10 mx-auto mb-3 text-success opacity-50" />
                      <p className="font-medium">No errors found! 🎉</p>
                      <p>All your deployments are healthy.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {deployments
                        .filter((d) => d.status === "error" || d.error_message)
                        .map((d) => (
                          <div key={d.id} className="bg-destructive/5 rounded-xl p-4 border border-destructive/20">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <XCircle className="h-4 w-4 text-destructive" />
                                <span className="text-sm font-medium capitalize">{d.provider}</span>
                                <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                              </div>
                              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => handleInspect(d.id)}>
                                <Eye className="h-3 w-3 mr-1" /> Inspect
                              </Button>
                            </div>

                            {/* Raw error */}
                            <div className="bg-background/60 rounded-lg p-3 font-mono text-xs text-destructive mb-3">
                              {d.error_message || "Unknown error"}
                            </div>

                            {/* Plain-language explanation */}
                            <div className="bg-muted/30 rounded-lg p-3 text-sm">
                              <p className="font-medium mb-1">💡 What This Means</p>
                              <p className="text-muted-foreground text-xs">{explainError(d.error_message || "")}</p>
                            </div>

                            {/* Common fixes */}
                            <div className="mt-3 bg-muted/20 rounded-lg p-3 text-xs text-muted-foreground">
                              <p className="font-medium text-foreground mb-1">🔧 Common Fixes</p>
                              <ul className="space-y-1 list-disc list-inside">
                                <li>Check your build/start commands match your project setup</li>
                                <li>Ensure all dependencies are in package.json (not just installed locally)</li>
                                <li>Make sure your server listens on <code className="bg-muted px-1 rounded">process.env.PORT</code></li>
                                <li>Review the build logs for the specific error line</li>
                              </ul>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ═══ Infrastructure Tab ═══ */}
              <TabsContent value="infra">
                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Server className="h-4 w-4 text-primary" /> Infrastructure Details
                    </h3>
                    <Button variant="outline" size="sm" onClick={() => activeDeployId && fetchLogs(activeDeployId)} disabled={loadingLogs || !activeDeployId}>
                      {loadingLogs ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Load Info
                    </Button>
                  </div>

                  {!activeDeployId ? (
                    <p className="text-muted-foreground text-sm text-center py-8">Select a deployment from the timeline to view infrastructure details.</p>
                  ) : !activeService?.info ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <Server className="h-8 w-8 mx-auto mb-3 opacity-30" />
                      <p>Click "Load Info" to fetch infrastructure details from the provider.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Service Overview */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: "Service Name", value: activeService.info.name || "—" },
                          { label: "Runtime", value: activeService.info.runtime || "—" },
                          { label: "Plan", value: activeService.info.plan || "free" },
                          { label: "Region", value: activeService.info.region || "oregon" },
                        ].map((item) => (
                          <div key={item.label} className="bg-muted/50 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                            <p className="text-sm font-mono font-medium capitalize">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Environment Variables (keys only) */}
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-primary" /> Environment Variables ({activeService.envKeys.length})
                        </h4>
                        {activeService.envKeys.length === 0 ? (
                          <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">No environment variables configured.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {activeService.envKeys.map((e, i) => (
                              <span key={i} className="bg-muted/50 rounded-md px-2.5 py-1 text-xs font-mono border border-border/50">
                                {e.key}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* What's Running — Plain Language */}
                      <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        <h4 className="text-sm font-semibold mb-3">📋 How Your Service Works</h4>
                        <div className="space-y-3 text-xs text-muted-foreground">
                          <div className="flex items-start gap-2">
                            <Globe className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                            <p><strong className="text-foreground">URL:</strong> Your app is accessible at <code className="bg-muted px-1 rounded">{activeDep?.live_url || "—"}</code>. Anyone with this URL can access it.</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <Server className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                            <p><strong className="text-foreground">Container:</strong> Your app runs in an isolated container with its own filesystem and network. It can't affect other services.</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <Zap className="h-3.5 w-3.5 mt-0.5 text-warning shrink-0" />
                            <p><strong className="text-foreground">Cold Starts:</strong> On the free plan, your service shuts down after ~15 minutes of no traffic. The next request wakes it up (takes 30-60 seconds).</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <Shield className="h-3.5 w-3.5 mt-0.5 text-success shrink-0" />
                            <p><strong className="text-foreground">Auto Deploy:</strong> When you push to your GitHub repo, Render automatically rebuilds and redeploys your app.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}

        {!selectedProjectId && projects.length === 0 && (
          <div className="glass-card rounded-xl p-16 text-center">
            <Activity className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h3 className="font-semibold mb-2">No projects to monitor</h3>
            <p className="text-sm text-muted-foreground">Create a project first to see monitoring data</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
