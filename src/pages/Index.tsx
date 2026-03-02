import { Link } from "react-router-dom";
import { Cloud, Zap, GitBranch, Shield, ArrowRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Cloud, title: "Multi-Cloud Deploy", desc: "Vercel, Netlify — deploy to any cloud with one click" },
  { icon: Zap, title: "Auto-Detection", desc: "We analyze your project and configure everything automatically" },
  { icon: GitBranch, title: "GitHub Import", desc: "Import directly from GitHub or upload a ZIP file" },
  { icon: Shield, title: "Auto-Healing", desc: "Real-time monitoring with automatic recovery" },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cloud className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg tracking-tight">Cloudsnap Studio</span>
          </div>
          <Link to="/auth">
            <Button variant="outline" size="sm">Sign In</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-info/5 blur-[100px]" />
        </div>
        <div className="max-w-4xl mx-auto px-6 py-32 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-8">
            <Rocket className="h-3.5 w-3.5" />
            Deploy anything in seconds
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Ship faster with<br />
            <span className="gradient-text">Cloudsnap Studio</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10">
            Upload your project, we detect the stack, configure the build, and deploy — all automatically. Zero config needed.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="h-12 px-8">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f) => (
            <div key={f.title} className="glass-card rounded-xl p-8 hover:border-primary/30 transition-colors">
              <f.icon className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline visual */}
      <section className="max-w-4xl mx-auto px-6 pb-32">
        <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {["Login", "Connect Cloud", "Upload Project", "Auto Detect", "Deploy", "Monitor"].map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary text-sm font-bold">
                  {i + 1}
                </div>
                <span className="text-xs text-muted-foreground mt-2 whitespace-nowrap">{step}</span>
              </div>
              {i < 5 && <ArrowRight className="hidden md:block h-4 w-4 text-muted-foreground/30" />}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" />
            Cloudsnap Studio
          </div>
          <p>© 2026</p>
        </div>
      </footer>
    </div>
  );
}
