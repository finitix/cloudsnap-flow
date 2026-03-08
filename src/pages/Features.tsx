import { Link } from "react-router-dom";
import {
  Rocket, Layers, Cpu, Shield, BarChart3, Globe, ArrowRight, Zap,
  GitBranch, Lock, Eye, RefreshCw, Terminal, Database, Cloud, Server,
  CheckCircle, Code, Box, Settings, Activity, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PublicLayout from "@/components/PublicLayout";

const coreFeatures = [
  { icon: Rocket, title: "Deploy Any Stack", desc: "React, Node.js, Python, Go, Java — auto-detect framework, build command, and deploy. No configuration files needed.", details: ["Auto-detect 15+ frameworks", "Zero-config deployments", "Docker support built-in"] },
  { icon: Layers, title: "Connect All Platforms", desc: "Vercel, Render, AWS — manage every cloud from a single, unified dashboard with one-click connections.", details: ["One-click platform linking", "Unified credential management", "Cross-platform visibility"] },
  { icon: Cpu, title: "AI Stack Detection", desc: "Our engine reads your code and auto-configures everything. No YAML, no configs, no guesswork.", details: ["Reads package.json, requirements.txt, pom.xml", "Detects ports & env vars", "Suggests optimal settings"] },
  { icon: Shield, title: "Auto-Heal Engine", desc: "AI-powered error diagnosis and automatic fix & retry when deployments fail. Sleep through the night.", details: ["Categorizes 50+ error types", "Auto-retry with fixes", "Detailed heal logs"] },
  { icon: BarChart3, title: "Unified Monitoring", desc: "Real-time CPU, memory, logs, and alerts across all your deployments in one view.", details: ["CloudWatch integration", "Custom alert thresholds", "30-day metric history"] },
  { icon: Globe, title: "Custom Domains & SSL", desc: "Set custom domains with automatic HTTPS. Your apps, your brand, zero hassle.", details: ["Let's Encrypt auto-SSL", "DNS verification wizard", "Wildcard support"] },
];

const advancedFeatures = [
  { icon: Database, title: "Managed Databases", desc: "PostgreSQL & MySQL via AWS RDS. Auto-provisioned, secured, and connected to your app." },
  { icon: Server, title: "Free Tier Optimized", desc: "Smart defaults that keep you within AWS free-tier limits. Auto-stop idle servers after 30 min." },
  { icon: Lock, title: "Security First", desc: "VPC isolation, private subnets for databases, encrypted credentials. No shortcuts on security." },
  { icon: RefreshCw, title: "Auto-Stop Idle Servers", desc: "EC2 instances automatically stop after 30 minutes of inactivity. Protect your AWS bill." },
  { icon: Terminal, title: "Live Logs", desc: "Stream application logs in real-time from the dashboard. No SSH required." },
  { icon: Eye, title: "Deployment Tracking", desc: "Full lifecycle visibility: Queued → Building → Deploying → Live. Never wonder what's happening." },
  { icon: GitBranch, title: "GitHub Integration", desc: "Connect your repo and deploy on push. Branch previews coming soon." },
  { icon: Cloud, title: "Multi-Cloud Ready", desc: "Start with AWS today. GCP, Azure, Vercel, and Railway support coming soon." },
];

const integrationCategories = [
  {
    title: "Cloud Platforms",
    icon: Cloud,
    items: [
      { name: "AWS", desc: "EC2, RDS, VPC, S3, CloudWatch — full infrastructure automation.", status: "live" },
      { name: "GCP", desc: "Compute Engine, Cloud SQL, and Cloud Run support.", status: "soon" },
      { name: "Azure", desc: "Azure App Service, SQL Database, and Virtual Machines.", status: "soon" },
    ],
  },
  {
    title: "Hosting Platforms",
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
    icon: GitBranch,
    items: [
      { name: "GitHub", desc: "Connect repos, deploy on push, branch previews.", status: "live" },
      { name: "GitLab", desc: "Full GitLab integration with pipeline support.", status: "soon" },
      { name: "Bitbucket", desc: "Atlassian Bitbucket repository support.", status: "soon" },
    ],
  },
  {
    title: "Containers & Orchestration",
    icon: Box,
    items: [
      { name: "Docker", desc: "Build and deploy Docker containers automatically.", status: "live" },
      { name: "Kubernetes", desc: "Orchestrate containers at scale with K8s.", status: "soon" },
      { name: "ECS / Fargate", desc: "AWS container orchestration without servers.", status: "soon" },
    ],
  },
  {
    title: "Infrastructure as Code",
    icon: Settings,
    items: [
      { name: "Terraform", desc: "Import Terraform configs and manage state.", status: "soon" },
      { name: "Ansible", desc: "Configuration management and provisioning.", status: "soon" },
      { name: "Pulumi", desc: "Infrastructure as code using real programming languages.", status: "soon" },
    ],
  },
  {
    title: "Monitoring & Alerts",
    icon: Activity,
    items: [
      { name: "CloudWatch", desc: "AWS metrics, logs, and alerting built-in.", status: "live" },
      { name: "Datadog", desc: "Advanced APM and infrastructure monitoring.", status: "soon" },
      { name: "Slack", desc: "Deployment notifications and alerts to your channels.", status: "soon" },
    ],
  },
];

export default function Features() {
  const liveCount = integrationCategories.reduce((sum, c) => sum + c.items.filter((i) => i.status === "live").length, 0);
  const totalCount = integrationCategories.reduce((sum, c) => sum + c.items.length, 0);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
        </div>
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24 text-center relative z-10">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium bg-primary/5 text-primary border-primary/20">
            <Zap className="h-3 w-3 mr-1.5" />
            Features & Integrations
          </Badge>
          <h1 className="text-4xl md:text-[56px] font-extrabold tracking-tight leading-[1.1] text-foreground mb-6">
            Everything you need to{" "}
            <span className="gradient-text">deploy with confidence.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            From auto-detection to monitoring, Cloudsnap handles the entire deployment lifecycle. Connect your favorite tools — all in one dashboard.
          </p>
          <Link to="/auth">
            <Button size="lg" className="h-12 px-8 text-sm font-semibold shadow-sm">
              Start for Free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Core Features */}
      <section className="section-padding bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Core Features</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Built for modern developers</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Six powerful features that make cloud deployment effortless.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreFeatures.map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-6 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 group">
                <div className="h-12 w-12 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/10 transition-colors">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{f.desc}</p>
                <ul className="space-y-1.5">
                  {f.details.map((d) => (
                    <li key={d} className="text-xs text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-success shrink-0" /> {d}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Advanced Features */}
      <section className="section-padding bg-secondary/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Advanced</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">And so much more</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Enterprise-grade features designed for students and startups.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {advancedFeatures.map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-5 hover:shadow-card-hover transition-all">
                <f.icon className="h-5 w-5 text-primary mb-3" />
                <h3 className="text-sm font-bold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="section-padding bg-background">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Comparison</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Why Cloudsnap?</h2>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left p-4 text-muted-foreground font-medium">Feature</th>
                  <th className="text-center p-4 text-primary font-bold">Cloudsnap</th>
                  <th className="text-center p-4 text-muted-foreground font-medium">Others</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Unified multi-cloud dashboard", true, false],
                  ["AI stack auto-detection", true, false],
                  ["Auto-heal failed deployments", true, false],
                  ["Free-tier optimization", true, false],
                  ["Zero-config deployments", true, "Partial"],
                  ["Built-in monitoring", true, "Partial"],
                  ["Custom domains & SSL", true, true],
                ].map(([feature, us, them], i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-4 text-foreground font-medium">{feature as string}</td>
                    <td className="p-4 text-center">
                      {us === true ? <CheckCircle className="h-4 w-4 text-success mx-auto" /> : <span className="text-muted-foreground text-xs">{String(us)}</span>}
                    </td>
                    <td className="p-4 text-center">
                      {them === true ? <CheckCircle className="h-4 w-4 text-success mx-auto" /> : them === false ? <span className="text-muted-foreground">✕</span> : <span className="text-xs text-warning">{String(them)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ Integrations Section ═══ */}
      <section className="section-padding bg-secondary/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Integrations</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Works with every tool <span className="gradient-text">in your stack.</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {liveCount} live integrations · {totalCount - liveCount} coming soon. Connect your favorite platforms.
            </p>
          </div>

          <div className="space-y-10">
            {integrationCategories.map((cat) => (
              <div key={cat.title}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center">
                    <cat.icon className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">{cat.title}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cat.items.map((item) => (
                    <div key={item.name} className={`bg-card border border-border rounded-xl p-5 hover:shadow-card-hover transition-all ${item.status === "soon" ? "opacity-60" : ""}`}>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-foreground">{item.name}</h4>
                        {item.status === "live" ? (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
                          </span>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] bg-warning/10 text-warning border-warning/20">Coming Soon</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
          <Rocket className="h-12 w-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to deploy smarter?
          </h2>
          <p className="text-muted-foreground mb-10 text-lg max-w-lg mx-auto">Start for free. No credit card required.</p>
          <Link to="/auth">
            <Button size="lg" className="h-14 px-12 text-base font-semibold shadow-md hover:shadow-lg transition-shadow rounded-xl">
              Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground mt-5">Join 2,000+ developers deploying smarter</p>
        </div>
      </section>
    </PublicLayout>
  );
}
