import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
  analyzing: { label: "Analyzing", className: "bg-info/15 text-info" },
  ready: { label: "Ready", className: "bg-primary/15 text-primary" },
  building: { label: "Building", className: "bg-warning/15 text-warning animate-pulse-glow" },
  deploying: { label: "Deploying", className: "bg-warning/15 text-warning animate-pulse-glow" },
  live: { label: "Live", className: "bg-success/15 text-success" },
  error: { label: "Error", className: "bg-destructive/15 text-destructive" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.queued;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", config.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "live" ? "bg-success" : status === "error" ? "bg-destructive" : status === "building" || status === "deploying" ? "bg-warning" : "bg-current")} />
      {config.label}
    </span>
  );
}
