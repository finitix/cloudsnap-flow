import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Cpu, HardDrive, RefreshCw, Loader2, Terminal, Clock } from "lucide-react";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  projectId: string;
  awsConnectionId?: string;
  instanceId?: string;
}

export default function AWSMonitoringDashboard({ projectId, awsConnectionId, instanceId }: Props) {
  const [metrics, setMetrics] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchMetrics = async () => {
    if (!awsConnectionId || !instanceId) { toast.error("No instance to monitor"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("aws-deploy", {
        body: { action: "get-cloudwatch-metrics", awsConnectionId, instanceId },
      });
      if (error) throw error;
      if (data?.success) setMetrics(data.metrics);
      else toast.error(data?.error || "Failed to fetch metrics");
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const fetchLogs = async () => {
    if (!awsConnectionId || !instanceId) return;
    setLogsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("aws-deploy", {
        body: { action: "get-instance-logs", awsConnectionId, instanceId },
      });
      if (error) throw error;
      if (data?.success) setLogs(data.logs || []);
      else toast.error(data?.error || "Failed to fetch logs");
    } catch (err: any) { toast.error(err.message); }
    finally { setLogsLoading(false); }
  };

  const cpuData = metrics?.cpu?.map((d: any, i: number) => ({
    time: `${i * 5}m ago`,
    value: d.Average || 0,
  })) || [];

  const memoryData = metrics?.networkIn?.map((d: any, i: number) => ({
    time: `${i * 5}m ago`,
    bytesIn: (d.Average || 0) / 1024,
  })) || [];

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">CloudWatch Monitoring</h3>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchMetrics(); fetchLogs(); }} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      {!metrics && !loading ? (
        <div className="text-center py-8">
          <Activity className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground mb-3">Click refresh to load CloudWatch metrics</p>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <Activity className="h-3.5 w-3.5 mr-1.5" /> Load Metrics
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="cpu">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="cpu"><Cpu className="h-3.5 w-3.5 mr-1.5" />CPU</TabsTrigger>
            <TabsTrigger value="network"><HardDrive className="h-3.5 w-3.5 mr-1.5" />Network</TabsTrigger>
            <TabsTrigger value="logs"><Terminal className="h-3.5 w-3.5 mr-1.5" />Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="cpu" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading CPU metrics...
              </div>
            ) : cpuData.length > 0 ? (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-muted/30 rounded-lg px-3 py-1.5">
                    <p className="text-[10px] text-muted-foreground">Current CPU</p>
                    <p className="text-lg font-bold">{cpuData[cpuData.length - 1]?.value?.toFixed(1) || 0}%</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg px-3 py-1.5">
                    <p className="text-[10px] text-muted-foreground">Average</p>
                    <p className="text-lg font-bold">{(cpuData.reduce((a: number, b: any) => a + b.value, 0) / cpuData.length).toFixed(1)}%</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={cpuData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="%" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="CPU %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground">No CPU data available yet</p>
            )}
          </TabsContent>

          <TabsContent value="network" className="mt-4">
            {memoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={memoryData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} unit="KB" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="bytesIn" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="Network In (KB)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-8 text-sm text-muted-foreground">No network data available</p>
            )}
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading logs...
              </div>
            ) : logs.length > 0 ? (
              <div className="bg-muted/30 rounded-lg p-3 max-h-[300px] overflow-y-auto font-mono text-xs space-y-0.5">
                {logs.map((log, i) => (
                  <div key={i} className="text-muted-foreground hover:text-foreground transition-colors">{log}</div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Terminal className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground mb-3">No logs loaded</p>
                <Button variant="outline" size="sm" onClick={fetchLogs}>
                  <Terminal className="h-3.5 w-3.5 mr-1.5" /> Fetch Logs
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Auto-stop info */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span>Auto-stop enabled: Idle EC2 instances stop after 30 minutes to protect your Free Tier</span>
        </div>
      </div>
    </div>
  );
}
