import { Link } from "react-router-dom";
import {
  ArrowRight, Zap, Cloud, Server, GitBranch, Box, Settings,
  Activity, MessageSquare, CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PublicLayout from "@/components/PublicLayout";

const categories = [
  {
    title: "Cloud Platforms",
    desc: "Deploy to any major cloud provider from one dashboard.",
    icon: Cloud,
    items: [
      { name: "AWS", desc: "EC2, RDS, VPC, S3, CloudWatch — full infrastructure automation.", status: "live" },
      { name: "GCP", desc: "Compute Engine, Cloud SQL, and Cloud Run support.", status: "soon" },
      { name: "Azure", desc: "Azure App Service, SQL Database, and Virtual Machines.", status: "soon" },
    ],
  },
  {
    title: "Hosting Platforms",
    desc: "Connect your existing hosting accounts.",
    icon: Server,
    items: [
      { name: "Vercel", desc: "Instant frontend deployments with edge network.", status: "live" },
      { name: "Render", desc: "Managed services for web apps, APIs, and databases.", status: "live" },
      { name: "Netlify", desc: "JAMstack hosting with serverless functions.", status: "soon" },
      { name: "Railway", desc: "Deploy apps and databases with zero config.", status: "soon" },
    ],
  },
  {
    title: "Source Control",
    desc: "Import and deploy from your repositories.",
    icon: GitBranch,
    items: [
      { name: "GitHub", desc: "Connect repos, deploy on push, branch previews.", status: "live" },
      { name: "GitLab", desc: "Full GitLab integration with pipeline support.", status: "soon" },
      { name: "Bitbucket", desc: "Atlassian Bitbucket repository support.", status: "soon" },
    ],
  },
  {
    title: "Containers & Orchestration",
    desc: "Container-first deployment workflows.",
    icon: Box,
    items: [
      { name: "Docker", desc: "Build and deploy Docker containers automatically.", status: "live" },
      { name: "Kubernetes", desc: "Orchestrate containers at scale with K8s.", status: "soon" },
      { name: "ECS / Fargate", desc: "AWS container orchestration without servers.", status: "soon" },
    ],
  },
  {
    title: "Infrastructure as Code",
    desc: "Integrate with your existing IaC tools.",
    icon: Settings,
    items: [
      { name: "Terraform", desc: "Import Terraform configs and manage state.", status: "soon" },
      { name: "Ansible", desc: "Configuration management and provisioning.", status: "soon" },
      { name: "Pulumi", desc: "Infrastructure as code using real programming languages.", status: "soon" },
    ],
  },
  {
    title: "Monitoring & Alerts",
    desc: "Stay informed about your deployments.",
    icon: Activity,
    items: [
      { name: "CloudWatch", desc: "AWS metrics, logs, and alerting built-in.", status: "live" },
      { name: "Datadog", desc: "Advanced APM and infrastructure monitoring.", status: "soon" },
      { name: "Slack", desc: "Deployment notifications and alerts to your channels.", status: "soon" },
    ],
  },
];

export default function Integrations() {
  const liveCount = categories.reduce((sum, c) => sum + c.items.filter((i) => i.status === "live").length, 0);
  const totalCount = categories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 right-1/4 w-[500px] h-[500px] rounded-full bg-accent/5 blur-[120px]" />
        </div>
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24 text-center relative z-10">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium bg-primary/5 text-primary border-primary/20">
            <Zap className="h-3 w-3 mr-1.5" />
            {liveCount} Live · {totalCount - liveCount} Coming Soon
          </Badge>
          <h1 className="text-4xl md:text-[56px] font-extrabold tracking-tight leading-[1.1] text-foreground mb-6">
            Works with every tool{" "}
            <span className="gradient-text">in your stack.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect your favorite cloud platforms, hosting providers, source control, and DevOps tools — all in one dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="h-12 px-8 text-sm font-semibold shadow-sm">
                Start Connecting <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/features">
              <Button variant="outline" size="lg" className="h-12 px-8 text-sm font-semibold">
                View Features
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Integration Categories */}
      {categories.map((cat, idx) => (
        <section key={cat.title} className={`section-padding ${idx % 2 === 0 ? "bg-background" : "bg-secondary/30"}`}>
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center">
                <cat.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">{cat.title}</p>
            </div>
            <p className="text-muted-foreground text-sm mb-8">{cat.desc}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {cat.items.map((item) => (
                <div key={item.name} className={`bg-card border border-border rounded-xl p-6 hover:shadow-card-hover transition-all ${item.status === "soon" ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-foreground">{item.name}</h3>
                    {item.status === "live" ? (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
                      </span>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] bg-warning/10 text-warning border-warning/20">Coming Soon</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  {item.status === "live" && (
                    <Link to="/auth" className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-3 hover:underline">
                      Connect now <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Request Integration */}
      <section className="section-padding bg-background">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="bg-card border border-dashed border-primary/30 rounded-2xl p-10">
            <MessageSquare className="h-10 w-10 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-3">Don't see your tool?</h2>
            <p className="text-muted-foreground mb-6">We're adding new integrations every month. Let us know what you need.</p>
            <Link to="/contact">
              <Button variant="outline" size="lg" className="h-11 px-8 text-sm font-semibold">
                Request an Integration
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding-lg relative overflow-hidden" style={{ background: "linear-gradient(180deg, hsl(210 40% 98%), hsl(200 50% 97%))" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-[100px]" />
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <Cloud className="h-12 w-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Connect your stack in seconds.
          </h2>
          <p className="text-muted-foreground mb-10 text-lg max-w-lg mx-auto">One dashboard for all your clouds. Start for free.</p>
          <Link to="/auth">
            <Button size="lg" className="h-14 px-12 text-base font-semibold shadow-md hover:shadow-lg transition-shadow rounded-xl">
              Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground mt-5">No credit card required</p>
        </div>
      </section>
    </PublicLayout>
  );
}
