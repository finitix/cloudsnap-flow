import PublicLayout from "@/components/PublicLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HelpCircle, BookOpen, MessageSquare, Zap, Shield, GitBranch, ArrowRight } from "lucide-react";

const faqs = [
  { q: "How do I deploy my first project?", a: "Sign up, connect a cloud provider (Vercel or Render), create a project from GitHub or ZIP upload, and click Deploy. We handle everything else automatically." },
  { q: "What frameworks are supported?", a: "React, Next.js, Vue, Angular, Svelte, Node.js (Express/Fastify/NestJS), Python (Django/Flask/FastAPI), Go, Java, PHP, Ruby, and Docker." },
  { q: "What is auto-healing?", a: "When a deployment fails, our AI analyzes the build logs, identifies the error, suggests a fix, and automatically retries with corrected configuration." },
  { q: "How do I connect my cloud account?", a: "Go to Connections, click Add Connection, select your provider (Vercel/Render), and paste your API token." },
  { q: "Can I use environment variables?", a: "Yes! When deploying to Render, you can add custom environment variables in the project detail page before deploying." },
  { q: "Is my data secure?", a: "Yes. All API tokens are stored securely and only used for deployment operations. We never store your source code." },
];

export default function Support() {
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Support Center</h1>
          <p className="text-muted-foreground">Find answers to common questions or reach out to our team.</p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {[
            { icon: BookOpen, title: "Documentation", desc: "Step-by-step guides for all features", link: "/about" },
            { icon: MessageSquare, title: "Contact Support", desc: "Get help from our team directly", link: "/contact" },
            { icon: HelpCircle, title: "Community", desc: "Share feedback and reviews", link: "/reviews" },
          ].map((item) => (
            <Link key={item.title} to={item.link} className="glass-card rounded-xl p-6 hover:border-primary/30 transition-all hover:-translate-y-0.5 duration-300 block">
              <item.icon className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </Link>
          ))}
        </div>

        {/* FAQ */}
        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" /> Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="border-b border-border/50 pb-4 last:border-0 last:pb-0">
                <h3 className="text-sm font-semibold mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground text-sm mb-4">Still need help?</p>
          <Link to="/contact">
            <Button>
              Contact Support <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
