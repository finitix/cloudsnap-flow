import PublicLayout from "@/components/PublicLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Cloud, Zap, Shield, Globe, Target, Sparkles, Rocket, Heart, Eye,
  ArrowRight, Users, Code, Server, GitBranch, BarChart3, Cpu, Lock,
  CheckCircle, Star, Layers
} from "lucide-react";

const timeline = [
  { year: "2025", title: "The Idea", desc: "Frustrated by complex deployment pipelines, we envisioned a platform where any developer could deploy in seconds." },
  { year: "2025", title: "First Prototype", desc: "Built the core auto-detection engine supporting React, Node.js, and Python projects." },
  { year: "2026", title: "AI Auto-Healing", desc: "Integrated AI-powered error analysis that automatically fixes failed deployments." },
  { year: "2026", title: "Multi-Cloud Launch", desc: "Launched support for Vercel, Render, with AWS, GCP, and Azure on the roadmap." },
];

const values = [
  { icon: Zap, title: "Speed First", desc: "Every feature we build prioritizes deployment speed. From import to live in under 60 seconds." },
  { icon: Eye, title: "Transparency", desc: "Real-time logs, clear error messages, and full visibility into every deployment step." },
  { icon: Heart, title: "Developer Love", desc: "We build for developers. Every UX decision is made to reduce friction and save time." },
  { icon: Shield, title: "Security by Default", desc: "Row-level security, encrypted tokens, and zero permanent source code storage." },
  { icon: Code, title: "Framework Agnostic", desc: "18+ frameworks supported. We don't force you into a stack — we adapt to yours." },
  { icon: Layers, title: "Full Stack", desc: "Frontend, backend, or fullstack — we detect, configure, and deploy all of it." },
];

const techSupported = [
  { category: "Frontend", items: ["React", "Next.js", "Vue", "Nuxt", "Angular", "Svelte", "Static HTML"] },
  { category: "Backend", items: ["Node.js", "Express", "Fastify", "NestJS", "Python", "Django", "Flask", "FastAPI"] },
  { category: "Other", items: ["Go", "Java (Maven/Gradle)", "PHP", "Ruby (Rails)", "Docker", "Monorepos"] },
];

export default function About() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-80 h-80 rounded-full bg-primary/4 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/3 w-64 h-64 rounded-full bg-info/4 blur-[100px]" />
        </div>
        <div className="max-w-4xl mx-auto px-6 py-24 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6 border border-primary/20">
            <Sparkles className="h-3 w-3" /> Our Story
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Building the future of<br />
            <span className="gradient-text">cloud deployment</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Cloudsnap Studio was born from a simple belief: deploying code should be as easy as pushing a button.
            No YAML files, no CI/CD pipelines, no config headaches — just ship.
          </p>
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card rounded-2xl p-8 glow-border">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              To democratize cloud deployment. We believe every developer — from students building their first app to 
              teams shipping production software — deserves zero-config, intelligent deployment tools that just work.
            </p>
          </div>
          <div className="glass-card rounded-2xl p-8">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Eye className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Our Vision</h2>
            <p className="text-muted-foreground leading-relaxed">
              A world where deploying any application to any cloud is a one-click operation. Where AI handles errors 
              before you even see them. Where infrastructure is invisible and developers focus purely on building products.
            </p>
          </div>
        </div>
      </section>

      {/* What makes us different */}
      <section className="bg-card/50 border-y border-border/50">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What makes us different</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">We're not another CI/CD tool. We're a deployment intelligence platform.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Cpu, title: "AI-Powered Analysis", desc: "Our engine reads your code, detects the framework, identifies dependencies, and auto-configures build settings — supporting 18+ frameworks across 6 languages." },
              { icon: Shield, title: "Self-Healing Deploys", desc: "When builds fail, our AI reads the error logs, diagnoses the issue (missing deps, wrong commands, port conflicts), and automatically applies fixes and retries." },
              { icon: BarChart3, title: "Real-Time Intelligence", desc: "Live deployment monitoring with CPU/memory tracking, build log streaming, and instant alerts when something needs attention." },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Values</h2>
          <p className="text-muted-foreground">The principles that guide every feature we build.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {values.map((v) => (
            <div key={v.title} className="glass-card rounded-xl p-6 hover:border-primary/20 transition-all hover:-translate-y-0.5 duration-300">
              <v.icon className="h-5 w-5 text-primary mb-3" />
              <h3 className="text-sm font-semibold mb-1.5">{v.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-card/50 border-y border-border/50">
        <div className="max-w-3xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Journey</h2>
            <p className="text-muted-foreground">From idea to platform — here's how we got here.</p>
          </div>
          <div className="space-y-0">
            {timeline.map((item, i) => (
              <div key={i} className="flex gap-6 pb-8 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {item.year.slice(2)}
                  </div>
                  {i < timeline.length - 1 && <div className="w-px flex-1 bg-border/50 mt-2" />}
                </div>
                <div className="pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-primary">{item.year}</span>
                    <h3 className="font-semibold">{item.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Supported Technologies</h2>
          <p className="text-muted-foreground">We auto-detect and deploy all of these — and counting.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {techSupported.map((cat) => (
            <div key={cat.category} className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold text-sm mb-4 text-primary">{cat.category}</h3>
              <div className="space-y-2">
                {cat.items.map((tech) => (
                  <div key={tech} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                    <span>{tech}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cloud Providers */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="glass-card rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Cloud Providers</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { name: "Vercel", status: "live", desc: "Frontend" },
              { name: "Render", status: "live", desc: "Backend" },
              { name: "AWS", status: "soon", desc: "Coming Q3" },
              { name: "Google Cloud", status: "soon", desc: "Coming Q4" },
              { name: "Azure", status: "soon", desc: "Coming Q4" },
            ].map((p) => (
              <div key={p.name} className={`rounded-xl border p-4 ${p.status === "live" ? "border-primary/30 bg-primary/5" : "border-border/50 opacity-50"}`}>
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                {p.status === "live" && (
                  <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary font-medium">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Live
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="glass-card rounded-2xl p-12 text-center glow-border">
          <Rocket className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-4">Ready to simplify deployment?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">Join hundreds of developers who ship faster with Cloudsnap Studio.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="h-12 px-8">
                Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg" className="h-12 px-8">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
