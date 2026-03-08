import PublicLayout from "@/components/PublicLayout";
import { Cloud, Zap, Shield, Globe, Target, Sparkles } from "lucide-react";

export default function About() {
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">About Cloudsnap Studio</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            We're building the future of cloud deployment — zero config, AI-powered, and accessible to everyone.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" /> Our Mission
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Cloudsnap Studio was born from frustration with complex deployment pipelines. We believe every developer 
            should be able to deploy their projects in seconds, regardless of framework or language. Our AI-powered 
            platform analyzes your code, configures the build, and handles deployment to your preferred cloud provider — all automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[
            { icon: Cloud, title: "Multi-Cloud", desc: "Deploy to Vercel, Render, and more providers coming soon. One platform, any cloud." },
            { icon: Zap, title: "AI-Powered", desc: "Smart auto-detection of your stack with AI-driven error analysis and auto-healing." },
            { icon: Shield, title: "Self-Healing", desc: "When deployments fail, our AI analyzes the error and automatically applies fixes." },
            { icon: Globe, title: "Global Scale", desc: "Deploy to edge networks worldwide with custom domains and SSL certificates." },
          ].map((item) => (
            <div key={item.title} className="glass-card rounded-xl p-6">
              <item.icon className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" /> What We Support
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {["React", "Next.js", "Vue", "Angular", "Svelte", "Node.js", "Express", "Python", "Django", "FastAPI", "Flask", "Go", "Java (Spring)", "PHP", "Ruby (Rails)", "Docker", "Static HTML", "Nuxt"].map((tech) => (
              <div key={tech} className="rounded-lg bg-muted/50 px-4 py-2.5 text-sm font-medium text-center">
                {tech}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
