import { Link } from "react-router-dom";
import {
  Cloud, Zap, GitBranch, Shield, ArrowRight, Rocket, Star, Users, Globe,
  Server, CheckCircle, BarChart3, Cpu, Heart, Lock, Eye, Layers, Code,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import PublicLayout from "@/components/PublicLayout";
import SEOHead from "@/components/SEOHead";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const features = [
  { icon: Rocket, title: "Deploy Any Stack", desc: "React, Node.js, Python, Go, Java — auto-detect framework, build command, and deploy." },
  { icon: Layers, title: "Connect All Platforms", desc: "Vercel, Render, AWS — manage every cloud from a single, unified dashboard." },
  { icon: Cpu, title: "AI Stack Detection", desc: "Our engine reads your code and auto-configures everything. No YAML, no configs." },
  { icon: Shield, title: "Auto-Heal Engine", desc: "AI-powered error diagnosis and automatic fix & retry when deployments fail." },
  { icon: BarChart3, title: "Unified Monitoring", desc: "Real-time CPU, memory, logs, and alerts across all your deployments in one view." },
  { icon: Globe, title: "Custom Domains & SSL", desc: "Set custom domains with automatic HTTPS. Your apps, your brand." },
];

const integrations = [
  { name: "Vercel", status: "live" },
  { name: "Render", status: "live" },
  { name: "AWS", status: "live" },
  { name: "GitHub", status: "live" },
  { name: "Docker", status: "live" },
  { name: "GCP", status: "soon" },
  { name: "Azure", status: "soon" },
  { name: "Netlify", status: "soon" },
  { name: "Railway", status: "soon" },
  { name: "GitLab", status: "soon" },
  { name: "Terraform", status: "soon" },
  { name: "Kubernetes", status: "soon" },
];

const pricing = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Perfect for students and hobby projects",
    features: ["1 project", "1 cloud connection", "Auto-detection", "Community support", "Basic monitoring"],
    cta: "Start for Free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    desc: "For developers shipping to production",
    features: ["Unlimited projects", "5 cloud connections", "AI auto-healing", "Priority support", "Advanced monitoring", "Custom domains"],
    cta: "Start Pro Trial",
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Team",
    price: "$99",
    period: "/month",
    desc: "For teams building together",
    features: ["Everything in Pro", "Unlimited connections", "Team collaboration", "Role-based access", "Audit logs", "Shared dashboards"],
    cta: "Start Team Trial",
    highlight: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For organizations at scale",
    features: ["Everything in Team", "SSO / SAML", "Dedicated support", "SLA guarantee", "On-premise option", "Custom integrations"],
    cta: "Contact Sales",
    highlight: false,
  },
];

export default function Index() {
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("feedback").select("*").eq("is_published", true).eq("type", "review").order("created_at", { ascending: false }).limit(3).then(({ data }) => {
      if (data) setReviews(data);
    });
  }, []);

  return (
    <PublicLayout>
      <SEOHead
        title="Cloudsnap Studio — Deploy Anywhere, Monitor Everything"
        description="One dashboard to deploy and manage all your clouds. Connect AWS, Vercel, Railway, and more. One-click deploy with AI auto-healing."
        canonical="https://cloudsnap.studio"
        keywords="cloud deployment platform, automated cloud deployment, one click deployment, deploy app to cloud, devops automation, multi cloud deployment, Cloudsnap Studio"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Cloudsnap Studio",
            applicationCategory: "DeveloperApplication",
            operatingSystem: "Web",
            description: "Automated cloud deployment platform with AI-powered stack detection, one-click deploy, and auto-healing for AWS, Vercel, Render, and more.",
            url: "https://cloudsnap.studio",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            author: { "@type": "Organization", name: "Finitix" },
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Cloudsnap Studio",
            url: "https://cloudsnap.studio",
            logo: "https://cloudsnap.studio/favicon.ico",
            sameAs: ["https://twitter.com/cloudsnap", "https://github.com/cloudsnap"],
          },
        ]}
      />
      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/3 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px]" />
        </div>
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32 text-center relative z-10">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium bg-primary/5 text-primary border-primary/20">
            <Rocket className="h-3 w-3 mr-1.5" />
            Now in Beta — Join 2,000+ developers
          </Badge>

          <h1 className="text-4xl md:text-[56px] font-extrabold tracking-tight leading-[1.1] text-foreground mb-6">
            One Dashboard to Deploy<br className="hidden md:block" />
            and Manage{" "}
            <span className="gradient-text">All Your Clouds.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Connect Vercel, Railway, AWS, GCP, Azure and Netlify. Deploy in one click.
            Monitor everything. Auto-heal failures — all powered by AI.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <Link to="/auth">
              <Button size="lg" className="h-12 px-8 text-sm font-semibold shadow-sm">
                Start for Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/about">
              <Button variant="outline" size="lg" className="h-12 px-8 text-sm font-semibold">
                See How It Works
              </Button>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            Trusted by developers at <span className="font-medium text-foreground/70">Stripe</span>,{" "}
            <span className="font-medium text-foreground/70">Notion</span>, and{" "}
            <span className="font-medium text-foreground/70">500+ startups</span>
          </p>
        </div>
      </section>

      {/* ═══ LOGO STRIP ═══ */}
      <section className="border-y border-border bg-card/50">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <p className="text-xs text-muted-foreground text-center mb-5 uppercase tracking-widest font-medium">Integrates with</p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {["Vercel", "Render", "AWS", "GitHub", "Docker", "Terraform"].map((name) => (
              <span key={name} className="text-sm font-semibold text-muted-foreground/50 hover:text-foreground transition-colors cursor-default">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PROBLEM SECTION ═══ */}
      <section className="section-padding bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">The Problem</p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-10">
            Managing 5 cloud platforms is a full-time job.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { title: "5 dashboards daily", desc: "Switching between Vercel, AWS, Render, and more just to check deployment status.", color: "bg-destructive/5 border-destructive/10 text-destructive" },
              { title: "Hours of config", desc: "Writing YAML files, CI/CD pipelines, and build scripts for every project.", color: "bg-warning/5 border-warning/10 text-warning" },
              { title: "3am crash alerts", desc: "Finding out your app is down from a user tweet, not from your monitoring.", color: "bg-destructive/5 border-destructive/10 text-destructive" },
            ].map((item) => (
              <div key={item.title} className="bg-card border border-border rounded-xl p-6 hover:shadow-card-hover transition-shadow">
                <div className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-semibold mb-3 ${item.color}`}>
                  Pain Point
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SOLUTION SECTION ═══ */}
      <section className="section-padding bg-secondary/30">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">The Solution</p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Everything in one intelligent dashboard.
          </h2>
          <p className="text-muted-foreground max-w-2xl mb-12 leading-relaxed">
            Cloudsnap Studio unifies all your cloud platforms into a single view with AI-powered monitoring and auto-healing.
          </p>

          {/* Dashboard mockup placeholder */}
          <div className="bg-card border border-border rounded-2xl p-8 mb-12 shadow-card">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-secondary rounded-lg p-4">
                <p className="text-[10px] text-muted-foreground mb-1">Deployments</p>
                <p className="text-2xl font-bold text-foreground">247</p>
                <p className="text-[10px] text-success font-medium">↑ 12% this week</p>
              </div>
              <div className="bg-secondary rounded-lg p-4">
                <p className="text-[10px] text-muted-foreground mb-1">Uptime</p>
                <p className="text-2xl font-bold text-foreground">99.9%</p>
                <p className="text-[10px] text-success font-medium">All systems healthy</p>
              </div>
              <div className="bg-secondary rounded-lg p-4">
                <p className="text-[10px] text-muted-foreground mb-1">Auto-Healed</p>
                <p className="text-2xl font-bold text-foreground">38</p>
                <p className="text-[10px] text-primary font-medium">Failures recovered</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {["VPC ✔", "EC2 ✔", "RDS ✔", "ALB ✔"].map((r) => (
                <div key={r} className="bg-success/5 border border-success/10 rounded-lg p-2 text-center">
                  <p className="text-xs font-medium text-success">{r}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: Rocket, title: "One-Click Deploy", desc: "Import from GitHub, detect the stack, and deploy — all in one click." },
              { icon: Shield, title: "AI Auto-Heal", desc: "AI reads error logs, identifies the fix, and automatically retries." },
              { icon: BarChart3, title: "Live Monitoring", desc: "CPU, memory, logs, and alerts across all your deployments." },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="h-12 w-12 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="section-padding bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Features</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Everything you need to deploy</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">From auto-detection to monitoring, we handle the entire deployment lifecycle.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-xl p-6 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
                <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ INTEGRATIONS ═══ */}
      <section id="integrations" className="section-padding bg-secondary/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Integrations</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Works with every tool in your stack.</h2>
            <p className="text-muted-foreground">And we're adding more every month.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {integrations.map((i) => (
              <div key={i.name} className={`bg-card border border-border rounded-xl p-4 text-center hover:shadow-card-hover transition-all ${i.status === "soon" ? "opacity-50" : ""}`}>
                <p className="text-sm font-semibold text-foreground mb-1">{i.name}</p>
                {i.status === "live" ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-success font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
                  </span>
                ) : (
                  <Badge variant="secondary" className="text-[10px] bg-warning/10 text-warning border-warning/20">Coming Soon</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="section-padding bg-background">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Deploy your app in 3 steps.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Dotted line */}
            <div className="hidden md:block absolute top-10 left-[20%] right-[20%] border-t-2 border-dashed border-border" />
            {[
              { step: "1", icon: Code, title: "Connect your platforms", desc: "Link Vercel, Render, or AWS with API tokens. Takes 30 seconds." },
              { step: "2", icon: GitBranch, title: "Import your project", desc: "From a GitHub repo or ZIP upload. We auto-detect your stack." },
              { step: "3", icon: Rocket, title: "Click deploy", desc: "One click. We build, configure, and deploy to your cloud. Done." },
            ].map((item) => (
              <div key={item.step} className="text-center relative z-10">
                <div className="h-16 w-16 rounded-2xl bg-card border-2 border-primary/20 flex items-center justify-center mx-auto mb-5 shadow-card">
                  <item.icon className="h-7 w-7 text-primary" />
                </div>
                <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold mb-3">
                  {item.step}
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="section-padding bg-secondary/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Simple pricing. No surprises.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {pricing.map((plan) => (
              <div key={plan.name} className={`bg-card border rounded-xl p-6 relative transition-all ${plan.highlight ? "border-primary shadow-blue-glow scale-[1.02]" : "border-border hover:shadow-card-hover"}`}>
                {plan.badge && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] px-3">
                    {plan.badge}
                  </Badge>
                )}
                <h3 className="text-lg font-bold text-foreground mb-1">{plan.name}</h3>
                <div className="mb-2">
                  <span className="text-3xl font-extrabold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-5">{plan.desc}</p>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/auth">
                  <Button variant={plan.highlight ? "default" : "outline"} className="w-full" size="sm">
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      {reviews.length > 0 && (
        <section className="section-padding bg-background">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Testimonials</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">What developers say</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {reviews.map((r) => (
                <div key={r.id} className="bg-card border border-border rounded-xl p-6 hover:shadow-card-hover transition-shadow">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: r.rating || 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4 italic">"{r.message}"</p>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {r.name?.[0]?.toUpperCase()}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{r.name}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link to="/reviews">
                <Button variant="outline" size="sm">See All Reviews <ChevronRight className="ml-1 h-3.5 w-3.5" /></Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ═══ FINAL CTA ═══ */}
      <section className="section-padding-lg relative overflow-hidden" style={{ background: "linear-gradient(180deg, hsl(210 40% 98%), hsl(200 50% 97%))" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-[100px]" />
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <Rocket className="h-12 w-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Stop juggling dashboards.<br />Start shipping.
          </h2>
          <p className="text-muted-foreground mb-10 text-lg max-w-lg mx-auto">
            Join 2,000+ developers who deploy smarter.
          </p>
          <Link to="/auth">
            <Button size="lg" className="h-14 px-12 text-base font-semibold shadow-md hover:shadow-lg transition-shadow rounded-xl">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground mt-5">No credit card required. Free forever plan available.</p>
        </div>
      </section>
    </PublicLayout>
  );
}