import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import PublicLayout from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, MapPin, Clock, HelpCircle, BookOpen, MessageSquare, ArrowRight, Send, Shield, Zap, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const faqs = [
  { q: "How do I deploy my first project?", a: "Sign up, connect a cloud provider (Vercel or Render), create a project from GitHub or ZIP upload, and click Deploy. We handle everything else automatically." },
  { q: "What frameworks are supported?", a: "React, Next.js, Vue, Angular, Svelte, Node.js (Express/Fastify/NestJS), Python (Django/Flask/FastAPI), Go, Java, PHP, Ruby, and Docker." },
  { q: "What is auto-healing?", a: "When a deployment fails, our AI analyzes the build logs, identifies the error, suggests a fix, and automatically retries with corrected configuration." },
  { q: "How do I connect my cloud account?", a: "Go to Connections, click Add Connection, select your provider (Vercel/Render), and paste your API token." },
  { q: "Can I use environment variables?", a: "Yes! When deploying to Render, you can add custom environment variables in the project detail page before deploying." },
  { q: "Is my data secure?", a: "Yes. All API tokens are stored securely with row-level security. We never permanently store your source code." },
  { q: "What happens when I delete a project?", a: "All data is removed from our platform AND from your connected cloud provider (Render/Vercel). This is a permanent action." },
  { q: "Do I need an account to give feedback?", a: "No! You can submit reviews and contact us without creating an account." },
];

export default function ContactSupport() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.user_metadata?.display_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) { toast.error("Please fill in all fields."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Please enter a valid email."); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("contact_messages").insert({
        user_id: user?.id || null,
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      });
      if (error) throw error;
      toast.success("Message sent! We'll get back to you within 24 hours.");
      setSubject("");
      setMessage("");
      if (!user) { setName(""); setEmail(""); }
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4 border border-primary/20">
            <HelpCircle className="h-3 w-3" /> Help & Support
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact & Support</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Need help with a deployment? Have a question about our platform? We're here to help. 
            No account required to reach out.
          </p>
        </div>

        {/* Quick help cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {[
            { icon: Mail, title: "Email Us", desc: "support@cloudsnap.studio", sub: "Response within 24h" },
            { icon: Clock, title: "Support Hours", desc: "24/7 Automated Help", sub: "Human support Mon-Fri" },
            { icon: MapPin, title: "Global Team", desc: "Remote-first company", sub: "Serving developers worldwide" },
          ].map((item) => (
            <div key={item.title} className="glass-card rounded-xl p-6 text-center hover:border-primary/20 transition-colors">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
              <p className="text-sm text-foreground/80">{item.desc}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Contact Form */}
          <div className="glass-card rounded-2xl p-8 glow-border">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" /> Send a Message
            </h2>
            <p className="text-sm text-muted-foreground mb-6">We'll respond within 24 hours. No account required.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required maxLength={255} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's this about?" required maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your question, issue, or suggestion..."
                  className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  required
                  maxLength={5000}
                />
                <p className="text-[10px] text-muted-foreground text-right">{message.length}/5000</p>
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Sending..." : "Send Message"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </div>

          {/* Quick Resources */}
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Quick Start Guide
              </h3>
              <div className="space-y-3">
                {[
                  { step: "1", title: "Create an Account", desc: "Sign up free — takes 30 seconds" },
                  { step: "2", title: "Connect Cloud Provider", desc: "Add your Vercel or Render API token" },
                  { step: "3", title: "Import Project", desc: "From GitHub URL or upload a ZIP" },
                  { step: "4", title: "Deploy", desc: "One click — we auto-detect and configure" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">
                      {item.step}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link to="/about" className="glass-card rounded-xl p-4 hover:border-primary/20 transition-all hover:-translate-y-0.5 duration-300 block">
                <Shield className="h-5 w-5 text-primary mb-2" />
                <p className="text-sm font-semibold">About Us</p>
                <p className="text-[10px] text-muted-foreground">Learn about our mission</p>
              </Link>
              <Link to="/reviews" className="glass-card rounded-xl p-4 hover:border-primary/20 transition-all hover:-translate-y-0.5 duration-300 block">
                <MessageSquare className="h-5 w-5 text-primary mb-2" />
                <p className="text-sm font-semibold">Reviews</p>
                <p className="text-[10px] text-muted-foreground">Read user experiences</p>
              </Link>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" /> Frequently Asked Questions
          </h2>
          <p className="text-sm text-muted-foreground mb-6">Quick answers to common questions.</p>
          <div className="space-y-1">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors rounded-lg"
                >
                  <span className="text-sm font-medium pr-4">{faq.q}</span>
                  <span className={`text-muted-foreground transition-transform duration-200 shrink-0 ${expandedFaq === i ? "rotate-45" : ""}`}>+</span>
                </button>
                {expandedFaq === i && (
                  <div className="px-4 pb-4 -mt-1">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
