import PublicLayout from "@/components/PublicLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Shield, Globe, Sparkles, Rocket, Heart, ArrowRight,
  Code, Layers, Briefcase, Building2, Lightbulb, Target,
  CheckCircle, Monitor, Database, Cloud, Lock, Users, BarChart3
} from "lucide-react";

const timeline = [
  { year: "2026", label: "MVP", title: "Launch & Core Features", desc: "Multi-cloud deploy, AI auto-detection, auto-healing engine." },
  { year: "2026", label: "Q3", title: "CI/CD & Integrations", desc: "GitHub Actions, GitLab CI, Jenkins, Terraform integrations." },
  { year: "2027", label: "Q1", title: "Enterprise Ready", desc: "SSO, team collaboration, audit logs, RBAC, and compliance." },
  { year: "2027+", label: "Future", title: "Global Scale", desc: "Multi-region, auto-scaling, AI cost optimization engine." },
];

const values = [
  { icon: Heart, title: "Developer First", desc: "Every feature reduces friction and saves developer time. We build tools we'd want to use ourselves." },
  { icon: Shield, title: "Security By Default", desc: "Row-level security, encrypted tokens, zero source storage. No shortcuts on protecting your data." },
  { icon: Zap, title: "Radically Simple", desc: "If it takes more than one click, we haven't finished building it. Simplicity is our north star." },
];

const products = [
  { icon: Cloud, title: "Cloudsnap Studio", desc: "Unified cloud deployment platform. Deploy, monitor, and manage applications across AWS, GCP, Azure, and more — from a single dashboard.", status: "Live" },
  { icon: Code, title: "Finitix DevKit", desc: "Developer productivity toolkit with AI-powered code analysis, automated testing, and intelligent debugging.", status: "Coming 2027" },
  { icon: Database, title: "Finitix Data Engine", desc: "Managed database orchestration. Provision, scale, and monitor databases across providers with zero config.", status: "Coming 2027" },
];

const stats = [
  { value: "2026", label: "Founded" },
  { value: "10+", label: "Integrations" },
  { value: "2K+", label: "Developers" },
  { value: "99.9%", label: "Uptime" },
];

export default function About() {
  return (
    <PublicLayout>
      {/* ═══ HERO ═══ */}
      <section className="section-padding bg-background">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium bg-primary/5 text-primary border-primary/20">
            <Sparkles className="h-3 w-3 mr-1.5" /> About Finitix
          </Badge>
          <h1 className="text-4xl md:text-[52px] font-extrabold tracking-tight leading-[1.1] text-foreground mb-6">
            Building the future of{" "}
            <span className="gradient-text">developer infrastructure.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Finitix is a developer-first technology company on a mission to eliminate infrastructure 
            complexity — so developers can focus on what they do best: building great products.
          </p>
        </div>
      </section>

      {/* ═══ WHO WE ARE ═══ */}
      <section className="bg-secondary/30 section-padding">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Who We Are</p>
              <h2 className="text-3xl font-bold text-foreground mb-5">A company built by developers, for developers.</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Finitix was founded in 2026 with a simple observation: developers spend too much time 
                  fighting infrastructure instead of building products. Between managing five different cloud 
                  dashboards, writing endless YAML configurations, and debugging deployment pipelines at 2am — 
                  something had to change.
                </p>
                <p>
                  We started with <span className="text-foreground font-medium">Cloudsnap Studio</span>, 
                  our flagship product that unifies cloud deployment into a single intelligent dashboard. 
                  But our vision goes far beyond one product — we're building an entire ecosystem of 
                  developer tools that make infrastructure invisible.
                </p>
                <p>
                  At Finitix, we believe that the best infrastructure is the kind you don't have to think about. 
                  Our tools handle the complexity behind the scenes so you can ship faster, sleep better, 
                  and focus on code that matters.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {stats.map((s) => (
                <div key={s.label} className="bg-card border border-border rounded-xl p-6 text-center hover:shadow-card-hover transition-all">
                  <p className="text-3xl font-extrabold text-foreground mb-1">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ PRODUCTS ═══ */}
      <section className="section-padding bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Our Products</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Tools that empower developers</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">From deployment to data, we're building the infrastructure layer developers deserve.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {products.map((p) => (
              <div key={p.title} className="bg-card border border-border rounded-xl p-6 hover:shadow-card-hover hover:-translate-y-0.5 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-11 w-11 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <p.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${p.status === "Live" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                    {p.status}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MISSION ═══ */}
      <section className="bg-secondary/30 section-padding">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-6">Our Mission</p>
          <p className="text-xl md:text-2xl italic text-muted-foreground mb-12 leading-relaxed max-w-3xl mx-auto">
            "Make infrastructure invisible. Let developers focus on building products that change the world."
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {values.map((v) => (
              <div key={v.title} className="bg-card border border-border rounded-xl p-6 hover:shadow-card-hover transition-all">
                <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center mx-auto mb-4">
                  <v.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WHY FINITIX ═══ */}
      <section className="section-padding bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Why Finitix</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">What sets us apart</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Lightbulb, title: "AI-First Approach", desc: "Every product is built with AI at its core — from stack detection to auto-healing." },
              { icon: Lock, title: "Enterprise Security", desc: "SOC 2 ready, encrypted credentials, VPC isolation, and zero-trust architecture." },
              { icon: Globe, title: "Multi-Cloud Native", desc: "Not locked to one provider. Deploy anywhere, manage everywhere." },
              { icon: Users, title: "Community Driven", desc: "Built in the open with developer feedback at every step." },
            ].map((item) => (
              <div key={item.title} className="bg-card border border-border rounded-xl p-5 hover:shadow-card-hover transition-all">
                <item.icon className="h-5 w-5 text-primary mb-3" />
                <h3 className="text-sm font-bold text-foreground mb-1.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ ROADMAP ═══ */}
      <section className="bg-secondary/30 section-padding">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Roadmap</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Where we're going</h2>
          </div>
          <div className="space-y-0">
            {timeline.map((item, i) => (
              <div key={i} className="flex gap-6 pb-8 last:pb-0">
                <div className="flex flex-col items-center">
                  <div className="h-10 w-10 rounded-full bg-primary/5 border border-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {item.label}
                  </div>
                  {i < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-2" />}
                </div>
                <div className="pb-2">
                  <p className="text-[10px] font-mono text-primary mb-0.5">{item.year}</p>
                  <h3 className="font-bold text-foreground mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HIRING ═══ */}
      <section className="section-padding bg-background">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="border-2 border-dashed border-border rounded-2xl p-10">
            <Briefcase className="h-10 w-10 text-primary/30 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-3">We're hiring</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Finitix is growing. We're looking for passionate developers, designers, and DevOps engineers 
              who want to shape the future of cloud infrastructure.
            </p>
            <Link to="/contact">
              <Button variant="outline" size="lg" className="h-11 px-8 text-sm font-semibold">
                View Open Positions <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="section-padding-lg" style={{ background: "linear-gradient(180deg, hsl(210 40% 98%), hsl(200 50% 97%))" }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Rocket className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to simplify deployment?</h2>
          <p className="text-muted-foreground mb-8 text-lg">Try Cloudsnap Studio — built by Finitix for developers everywhere.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="h-12 px-8 font-semibold">
                Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button variant="outline" size="lg" className="h-12 px-8 font-semibold">
                Contact Us
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
