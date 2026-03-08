import PublicLayout from "@/components/PublicLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Shield, Globe, Target, Sparkles, Rocket, Heart, Eye,
  ArrowRight, Code, CheckCircle, Layers, Users, Briefcase, ExternalLink
} from "lucide-react";

const timeline = [
  { year: "2026", label: "MVP", title: "Launch & Core Features", desc: "Multi-cloud deploy, AI auto-detection, auto-healing engine." },
  { year: "2026", label: "Q3", title: "CI/CD & Integrations", desc: "GitHub Actions, GitLab CI, Jenkins, Terraform integrations." },
  { year: "2027", label: "Q1", title: "Enterprise Ready", desc: "SSO, team collaboration, audit logs, RBAC, and compliance." },
  { year: "2027+", label: "Future", title: "Global Scale", desc: "Multi-region, auto-scaling, AI cost optimization engine." },
];

const values = [
  { icon: Heart, title: "Developer First", desc: "Every feature reduces friction and saves developer time." },
  { icon: Shield, title: "Security By Default", desc: "Row-level security, encrypted tokens, zero source storage." },
  { icon: Zap, title: "Radically Simple", desc: "If it takes more than one click, we haven't finished building it." },
];

export default function About() {
  return (
    <PublicLayout>
      {/* ═══ HERO ═══ */}
      <section className="section-padding bg-background">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium bg-primary/5 text-primary border-primary/20">
            <Sparkles className="h-3 w-3 mr-1.5" /> Our Story
          </Badge>
          <h1 className="text-4xl md:text-[52px] font-extrabold tracking-tight leading-[1.1] text-foreground mb-6">
            Built by a developer who was<br className="hidden md:block" />
            tired of switching dashboards.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Cloudsnap Studio was born out of frustration — and a dream to make cloud management 
            feel effortless for every developer on the planet.
          </p>
        </div>
      </section>

      {/* ═══ FOUNDER ═══ */}
      <section className="bg-secondary/30 section-padding">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-start">
            {/* Left — Photo */}
            <div className="text-center md:text-left">
              <div className="h-32 w-32 rounded-full bg-primary/10 flex items-center justify-center mx-auto md:mx-0 mb-4">
                <Users className="h-12 w-12 text-primary/40" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Jnaneswar Kandukuri</h3>
              <p className="text-sm text-muted-foreground mb-3">Founder & CEO, Finitix</p>
              <div className="flex items-center gap-3 justify-center md:justify-start">
                <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">Twitter <ExternalLink className="h-3 w-3" /></a>
                <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">LinkedIn <ExternalLink className="h-3 w-3" /></a>
                <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">GitHub <ExternalLink className="h-3 w-3" /></a>
              </div>
            </div>

            {/* Right — Story */}
            <div className="md:col-span-2 space-y-4 text-muted-foreground leading-relaxed">
              <p>
                I started building Cloudsnap Studio because I was tired. Tired of switching between five different cloud dashboards 
                every single day. Tired of writing YAML files. Tired of debugging deployment pipelines at 2am.
              </p>
              <p>
                As a full-stack developer, I spent more time configuring infrastructure than actually building products. 
                I knew there had to be a better way — a single dashboard where I could connect all my clouds, 
                deploy with one click, and let AI handle the failures.
              </p>
              <p>
                That's why I built Cloudsnap. Not as another CI/CD tool, but as a deployment intelligence platform 
                designed for developers who care about shipping fast and sleeping well at night.
              </p>
              <p className="text-foreground font-medium">
                Our vision: make cloud deployment as easy as saving a file. We're just getting started.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ABOUT FINITIX ═══ */}
      <section className="section-padding bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">About Finitix</p>
              <h2 className="text-3xl font-bold text-foreground mb-4">The company behind Cloudsnap</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Finitix is building developer tools that remove infrastructure complexity so developers 
                can focus on what matters — building products that change the world.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                We're a remote-first team passionate about great developer experience, clean code, 
                and making powerful tools accessible to everyone.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-xl p-5 text-center">
                <p className="text-2xl font-extrabold text-foreground">2026</p>
                <p className="text-xs text-muted-foreground mt-1">Founded</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5 text-center">
                <p className="text-2xl font-extrabold text-foreground">10+</p>
                <p className="text-xs text-muted-foreground mt-1">Integrations</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5 text-center">
                <p className="text-2xl font-extrabold text-foreground">2K+</p>
                <p className="text-xs text-muted-foreground mt-1">Developers</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ MISSION ═══ */}
      <section className="bg-secondary/30 section-padding">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xl md:text-2xl italic text-muted-foreground mb-10 leading-relaxed">
            "Our mission is simple — make cloud deployment as easy as saving a file."
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

      {/* ═══ VISION / ROADMAP ═══ */}
      <section className="section-padding bg-background">
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

      {/* ═══ TEAM ═══ */}
      <section className="bg-secondary/30 section-padding">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-foreground mb-3">The team building Cloudsnap</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center gap-4 mb-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">JK</div>
                <div>
                  <p className="font-bold text-foreground">Jnaneswar Kandukuri</p>
                  <p className="text-xs text-muted-foreground">Founder & CEO</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Full-stack developer turned founder. Building the future of cloud deployment.</p>
            </div>
            <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-center">
              <Briefcase className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <h3 className="font-bold text-foreground mb-1">We're hiring</h3>
              <p className="text-sm text-muted-foreground mb-4">Join us in building the future of cloud deployment.</p>
              <Button variant="outline" size="sm">
                Join Us <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="section-padding-lg" style={{ background: "linear-gradient(180deg, hsl(210 40% 98%), hsl(200 50% 97%))" }}>
        <div className="max-w-3xl mx-auto px-6 text-center">
          <Rocket className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to simplify deployment?</h2>
          <p className="text-muted-foreground mb-8 text-lg">Join hundreds of developers who ship faster.</p>
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