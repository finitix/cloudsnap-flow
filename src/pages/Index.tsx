import { Link } from "react-router-dom";
import { Cloud, Zap, GitBranch, Shield, ArrowRight, Rocket, Star, Users, Globe, Server, CheckCircle, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicLayout from "@/components/PublicLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const features = [
  { icon: Cloud, title: "Multi-Cloud Deploy", desc: "Vercel, Render — deploy to any cloud with one click. More providers coming soon." },
  { icon: Zap, title: "Smart Auto-Detection", desc: "We analyze your project structure and configure everything automatically — React, Node, Python, Go, and more." },
  { icon: GitBranch, title: "GitHub Integration", desc: "Import directly from any public GitHub repository or upload a ZIP file." },
  { icon: Shield, title: "AI Auto-Healing", desc: "Real-time monitoring with AI-powered automatic error recovery and fix suggestions." },
  { icon: BarChart3, title: "Live Monitoring", desc: "Track CPU, memory usage, and deployment health with real-time dashboards." },
  { icon: Globe, title: "Custom Domains", desc: "Set custom domains for your deployments with automatic SSL certificates." },
];

const stats = [
  { label: "Deployments", value: "10K+", icon: Rocket },
  { label: "Uptime", value: "99.9%", icon: CheckCircle },
  { label: "Providers", value: "5+", icon: Server },
  { label: "Users", value: "500+", icon: Users },
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
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-info/5 blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/3 blur-[150px]" />
        </div>
        <div className="max-w-5xl mx-auto px-6 py-28 md:py-36 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-8 border border-primary/20">
            <Rocket className="h-3.5 w-3.5" />
            Deploy anything in seconds — Zero config needed
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.08] mb-6">
            Ship faster with<br />
            <span className="gradient-text">Cloudsnap Studio</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload your project, we detect the stack, configure the build, and deploy — all automatically. 
            AI-powered auto-healing keeps your apps running.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="h-12 px-8 text-base">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/about">
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-6 -mt-8 mb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="glass-card rounded-xl p-5 text-center">
              <s.icon className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to deploy</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">From auto-detection to monitoring, we handle the entire deployment lifecycle.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="glass-card rounded-xl p-6 hover:border-primary/30 transition-all hover:-translate-y-0.5 duration-300">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-card/50 border-y border-border/50">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-muted-foreground">From code to production in three simple steps.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Connect", desc: "Link your cloud provider (Vercel, Render) and import your project from GitHub or upload a ZIP." },
              { step: "02", title: "Detect & Configure", desc: "Our AI analyzes your codebase, detects the stack, and auto-configures build settings." },
              { step: "03", title: "Deploy & Monitor", desc: "One-click deploy with real-time monitoring, auto-healing, and live logs." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">What users say</h2>
            <p className="text-muted-foreground">Real feedback from our community.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reviews.map((r) => (
              <div key={r.id} className="glass-card rounded-xl p-6">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: r.rating || 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{r.message}"</p>
                <p className="text-sm font-medium">{r.name}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/reviews">
              <Button variant="outline">See All Reviews</Button>
            </Link>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="glass-card rounded-2xl p-12 text-center glow-border">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to deploy?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">Join hundreds of developers shipping faster with Cloudsnap Studio.</p>
          <Link to="/auth">
            <Button size="lg" className="h-12 px-8">
              Start Deploying
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
