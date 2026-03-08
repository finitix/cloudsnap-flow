import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Cloud, Server, Database, Globe, Shield, Loader2, Play, Square, Trash2,
  CheckCircle, AlertTriangle, Clock, Activity, DollarSign, HardDrive
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  projectId: string;
  awsConnectionId?: string;
}

const RESOURCE_ICONS: Record<string, any> = {
  vpc: Shield,
  ec2: Server,
  rds: Database,
  alb: Globe,
  s3: HardDrive,
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/15 text-green-400",
  running: "bg-green-500/15 text-green-400",
  creating: "bg-amber-500/15 text-amber-400",
  stopped: "bg-muted text-muted-foreground",
  error: "bg-red-500/15 text-red-400",
  deleted: "bg-muted text-muted-foreground",
};

export default function AWSInfrastructureDashboard({ projectId, awsConnectionId }: Props) {
  const [infrastructure, setInfrastructure] = useState<any>(null);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadInfra = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("aws-deploy", {
        body: { action: "get-infrastructure", projectId },
      });
      if (data?.success) {
        setInfrastructure(data.infrastructure);
        setResources(data.resources || []);
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadInfra(); }, [projectId]);

  // Realtime updates
  useEffect(() => {
    if (!infrastructure?.id) return;
    const channel = supabase
      .channel(`infra-${infrastructure.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "aws_infrastructure", filter: `id=eq.${infrastructure.id}` }, () => loadInfra())
      .on("postgres_changes", { event: "*", schema: "public", table: "aws_resources", filter: `infrastructure_id=eq.${infrastructure.id}` }, () => loadInfra())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [infrastructure?.id]);

  const handleDeploy = async (appType: string, databaseEngine: string) => {
    if (!awsConnectionId) { toast.error("No AWS connection found"); return; }
    setDeploying(true);
    try {
      const { data, error } = await supabase.functions.invoke("aws-deploy", {
        body: { action: "deploy-aws", projectId, awsConnectionId, appType, databaseEngine },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("AWS infrastructure created! Resources are being provisioned...");
        loadInfra();
      } else {
        toast.error(data?.error || "Deployment failed");
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setDeploying(false); }
  };

  const handleStopStart = async (resourceId: string, action: "stop" | "start") => {
    if (!awsConnectionId) return;
    setActionLoading(resourceId);
    try {
      const { data } = await supabase.functions.invoke("aws-deploy", {
        body: { action: action === "stop" ? "stop-instance" : "start-instance", resourceId, awsConnectionId },
      });
      if (data?.success) {
        toast.success(`Instance ${action === "stop" ? "stopped" : "started"}`);
        loadInfra();
      } else {
        toast.error(data?.error || "Action failed");
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setActionLoading(null); }
  };

  const handleDeleteInfra = async () => {
    if (!infrastructure?.id) return;
    setDeleting(true);
    try {
      const { data } = await supabase.functions.invoke("aws-deploy", {
        body: { action: "delete-infrastructure", infrastructureId: infrastructure.id },
      });
      if (data?.success) {
        toast.success("Infrastructure deleted");
        setInfrastructure(null);
        setResources([]);
      } else {
        toast.error(data?.error || "Delete failed");
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setDeleting(false); setShowDeleteDialog(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading AWS infrastructure...
      </div>
    );
  }

  // No infrastructure yet — show deploy button
  if (!infrastructure || infrastructure.status === "deleted") {
    return (
      <div className="glass-card rounded-xl p-8 text-center">
        <Cloud className="h-10 w-10 mx-auto mb-4 text-amber-400 opacity-60" />
        <h3 className="font-semibold mb-2">Deploy to AWS</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create VPC, EC2, and optional RDS infrastructure on AWS Free Tier
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => handleDeploy("frontend", "none")} disabled={deploying}>
            {deploying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deploying...</> : <><Globe className="h-4 w-4 mr-2" /> Deploy Frontend</>}
          </Button>
          <Button variant="outline" onClick={() => handleDeploy("backend", "postgresql")} disabled={deploying}>
            <Server className="h-4 w-4 mr-2" /> Deploy Backend + DB
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">Free tier: t2.micro EC2 + db.t3.micro RDS</p>
      </div>
    );
  }

  const isCreating = ["creating_vpc", "creating_subnets", "creating_security_groups", "launching_compute", "creating_database", "creating_resources"].includes(infrastructure.status);

  return (
    <div className="space-y-4">
      {/* Infrastructure Status Header */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Cloud className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">AWS Infrastructure</h3>
              <p className="text-xs text-muted-foreground">{infrastructure.region}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-[10px] ${STATUS_STYLES[infrastructure.status] || "bg-muted text-muted-foreground"}`}>
              {isCreating && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              {infrastructure.status}
            </Badge>
            <Button variant="outline" size="sm" onClick={loadInfra}>
              <Activity className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
            </Button>
          </div>
        </div>

        {/* Cost estimate */}
        <div className="flex items-center gap-4 bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs text-muted-foreground">Estimated Monthly Cost:</span>
            <span className="text-sm font-semibold text-green-400">${infrastructure.estimated_monthly_cost?.toFixed(2) || "0.00"}</span>
          </div>
          {infrastructure.estimated_monthly_cost === 0 && (
            <Badge className="bg-green-500/15 text-green-400 text-[10px]">
              <CheckCircle className="h-3 w-3 mr-1" /> Free Tier
            </Badge>
          )}
        </div>
      </div>

      {/* Resource Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* VPC Card */}
        {infrastructure.vpc_id && (
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">VPC</span>
              <Badge className="bg-green-500/15 text-green-400 text-[10px] ml-auto">Active</Badge>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">VPC ID</span><span className="font-mono">{infrastructure.vpc_id}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">CIDR</span><span className="font-mono">10.0.0.0/16</span></div>
              {infrastructure.public_subnet_id && <div className="flex justify-between"><span className="text-muted-foreground">Public Subnet</span><span className="font-mono text-[10px]">{infrastructure.public_subnet_id}</span></div>}
              {infrastructure.private_subnet_id && <div className="flex justify-between"><span className="text-muted-foreground">Private Subnet</span><span className="font-mono text-[10px]">{infrastructure.private_subnet_id}</span></div>}
            </div>
          </div>
        )}

        {/* Resource Cards */}
        {resources.filter(r => r.status !== "deleted").map((r) => {
          const Icon = RESOURCE_ICONS[r.resource_type] || Cloud;
          return (
            <div key={r.id} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold uppercase">{r.resource_type}</span>
                <Badge className={`text-[10px] ml-auto ${STATUS_STYLES[r.status] || "bg-muted text-muted-foreground"}`}>
                  {r.status === "creating" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  {r.status}
                </Badge>
              </div>
              <div className="space-y-1.5 text-xs">
                {r.resource_id && <div className="flex justify-between"><span className="text-muted-foreground">Resource ID</span><span className="font-mono text-[10px]">{r.resource_id}</span></div>}
                {r.public_ip && <div className="flex justify-between"><span className="text-muted-foreground">Public IP</span><span className="font-mono">{r.public_ip}</span></div>}
                {r.public_url && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">URL</span>
                    <a href={r.public_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono text-[10px] truncate max-w-[150px]">{r.public_url}</a>
                  </div>
                )}
                {r.config?.instanceType && <div className="flex justify-between"><span className="text-muted-foreground">Instance Type</span><span className="font-mono">{r.config.instanceType}</span></div>}
                {r.config?.engine && <div className="flex justify-between"><span className="text-muted-foreground">Engine</span><span className="font-mono">{r.config.engine}</span></div>}
                {r.monthly_cost_estimate !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost/month</span>
                    <span className={`font-medium ${r.monthly_cost_estimate === 0 ? "text-green-400" : "text-foreground"}`}>
                      ${r.monthly_cost_estimate.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* EC2 Actions */}
              {r.resource_type === "ec2" && r.resource_id && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  {r.status === "running" ? (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleStopStart(r.resource_id, "stop")} disabled={actionLoading === r.resource_id}>
                      {actionLoading === r.resource_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Square className="h-3 w-3 mr-1" /> Stop</>}
                    </Button>
                  ) : r.status === "stopped" ? (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleStopStart(r.resource_id, "start")} disabled={actionLoading === r.resource_id}>
                      {actionLoading === r.resource_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Play className="h-3 w-3 mr-1" /> Start</>}
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Error display */}
      {infrastructure.error_message && (
        <div className="glass-card rounded-xl p-4 bg-red-500/5 border-red-500/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-400">Deployment Error</p>
              <p className="text-xs text-muted-foreground mt-1">{infrastructure.error_message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete AWS Infrastructure</AlertDialogTitle>
            <AlertDialogDescription>
              This will terminate all EC2 instances, delete RDS databases, remove VPC, and clean up all associated AWS resources. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInfra} disabled={deleting} className="bg-destructive text-destructive-foreground">
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</> : "Delete Everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
