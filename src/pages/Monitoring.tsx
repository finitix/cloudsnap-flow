import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Search, RefreshCw, ExternalLink, Clock, Cpu, HardDrive, AlertTriangle, CheckCircle, BarChart3, List, Terminal } from "lucide-react";

export default function Monitoring() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [deployments, setDeployments] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
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
    if (data) setDeployments(data);
  }, [selectedProjectId]);

  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  // Auto-refresh
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDeployments();
    setTimeout(() => setRefreshing(false), 500);
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

  // Stats
  const totalDeploys = deployments.length;
  const liveDeploys = deployments.filter((d) => d.status === "live").length;
  const errorDeploys = deployments.filter((d) => d.status === "error").length;
  const activeDeploys = deployments.filter((d) => ["queued", "building", "deploying"].includes(d.status)).length;
  const avgBuildTime = (() => {
    const completed = deployments.filter((d) => d.status === "live" && d.created_at && d.updated_at);
    if (completed.length === 0) return "N/A";
    const avg = completed.reduce((sum, d) => {
      return sum + (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime());
    }, 0) / completed.length;
    return `${Math.round(avg / 1000)}s`;
  })();
  const successRate = totalDeploys > 0 ? `${Math.round((liveDeploys / totalDeploys) * 100)}%` : "N/A";

  return (
    <DashboardLayout>
      <div className="p-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" /> Monitoring
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Advanced deployment monitoring & logs</p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Project Selector */}
        <div className="glass-card rounded-xl p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.framework || "Unknown"} ({p.source_type})
                    </SelectItem>
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {[
                { label: "Total Deploys", value: totalDeploys, icon: BarChart3, color: "text-primary" },
                { label: "Live", value: liveDeploys, icon: CheckCircle, color: "text-green-400" },
                { label: "Errors", value: errorDeploys, icon: AlertTriangle, color: "text-red-400" },
                { label: "Active", value: activeDeploys, icon: RefreshCw, color: "text-yellow-400" },
                { label: "Avg Build", value: avgBuildTime, icon: Clock, color: "text-blue-400" },
                { label: "Success Rate", value: successRate, icon: Activity, color: "text-emerald-400" },
              ].map((s) => (
                <div key={s.label} className="glass-card rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
                    <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-bold font-mono">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search logs, URLs, errors..."
                  className="pl-9 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
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

            {/* Deployment Logs */}
            <Tabs defaultValue="timeline" className="glass-card rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border">
                <TabsList>
                  <TabsTrigger value="timeline"><List className="h-4 w-4 mr-2" />Timeline</TabsTrigger>
                  <TabsTrigger value="logs"><Terminal className="h-4 w-4 mr-2" />Raw Logs</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="timeline" className="m-0">
                {filteredDeployments.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground text-sm">No deployments match your filters</div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredDeployments.map((d) => (
                      <div key={d.id} className="p-4 space-y-3 hover:bg-muted/10 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <StatusBadge status={d.status} />
                            <span className="text-sm font-medium capitalize">{d.provider}</span>
                            <span className="text-xs text-muted-foreground font-mono">{d.deploy_id?.slice(0, 12) || "—"}</span>
                            {["queued", "building", "deploying"].includes(d.status) && (
                              <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {d.live_url && (
                              <a href={d.live_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                                {d.live_url.replace("https://", "")} <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                            <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                            Duration: {d.updated_at && d.created_at
                              ? `${Math.round((new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / 1000)}s`
                              : "—"}
                          </span>
                          <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU: {d.cpu_usage ?? "N/A"}</span>
                          <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> Mem: {d.memory_usage ?? "N/A"}</span>
                        </div>

                        {d.error_message && (
                          <div className="bg-destructive/10 text-destructive text-xs rounded-lg p-3 font-mono">{d.error_message}</div>
                        )}
                        {d.logs && (
                          <details className="group">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                              View build logs ({d.logs.split("\n").filter(Boolean).length} lines)
                            </summary>
                            <pre className="mt-2 bg-background/80 text-xs rounded-lg p-3 font-mono max-h-80 overflow-auto text-muted-foreground whitespace-pre-wrap border border-border/50">
                              {d.logs}
                            </pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="logs" className="m-0">
                <div className="bg-background/80 p-1">
                  <pre className="text-xs font-mono p-4 max-h-[600px] overflow-auto text-muted-foreground whitespace-pre-wrap">
                    {filteredDeployments.length === 0
                      ? "No logs to display."
                      : filteredDeployments
                          .map((d) => {
                            const header = `═══ ${d.provider.toUpperCase()} | ${d.status.toUpperCase()} | ${new Date(d.created_at).toLocaleString()} ═══`;
                            return `${header}\n${d.logs || "(no logs)"}\n${d.error_message ? `ERROR: ${d.error_message}\n` : ""}`;
                          })
                          .join("\n")}
                  </pre>
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
