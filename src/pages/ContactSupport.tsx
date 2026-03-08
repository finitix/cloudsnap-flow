import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import PublicLayout from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Mail, Clock, HelpCircle, BookOpen, MessageSquare, ArrowRight, Send, Shield,
  CheckCircle, ExternalLink, ChevronDown
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const faqs = [
  { q: "Is my cloud data safe with Cloudsnap?", a: "Absolutely. All API tokens are stored with row-level security. We never permanently store your source code, and all communications are encrypted in transit." },
  { q: "What platforms do you support?", a: "Currently: Vercel, Render, and AWS. GCP, Azure, Netlify, and Railway are coming soon. We support 18+ frameworks across React, Node.js, Python, Go, Java, and more." },
  { q: "Do you store my API keys?", a: "Your API tokens are stored securely with database-level encryption and row-level security policies. They are only used to interact with your cloud providers." },
  { q: "Can I use Cloudsnap with a team?", a: "Team features are coming in our Team and Enterprise plans. This includes shared dashboards, role-based access, and audit logs." },
  { q: "Is there a free plan?", a: "Yes! Our Free plan is free forever and includes 1 project, 1 cloud connection, auto-detection, and basic monitoring. No credit card required." },
  { q: "How does the auto-heal engine work?", a: "When a deployment fails, our AI reads the error logs, categorizes the failure (dependency error, build error, port conflict, etc.), suggests a fix, and automatically retries with corrected configuration. Up to 3 retries." },
  { q: "What is your uptime SLA?", a: "We target 99.9% uptime for our platform. Your deployed applications' uptime depends on your chosen cloud provider." },
  { q: "Can I self-host Cloudsnap?", a: "Enterprise plan customers can request on-premise deployment. Contact our sales team for details." },
];

export default function ContactSupport() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.user_metadata?.display_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
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
        name: name.trim(), email: email.trim(),
        subject: `[${category}] ${subject.trim()}`,
        message: message.trim(),
      });
      if (error) throw error;
      toast.success("Message sent! We'll get back to you within 24 hours.");
      setSubject(""); setMessage("");
      if (!user) { setName(""); setEmail(""); }
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <PublicLayout>
      {/* ═══ HERO ═══ */}
      <section className="section-padding bg-background">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium bg-primary/5 text-primary border-primary/20">
            <HelpCircle className="h-3 w-3 mr-1.5" /> Contact & Support
          </Badge>
          <h1 className="text-4xl md:text-[52px] font-extrabold tracking-tight leading-[1.1] text-foreground mb-4">
            We're here to help.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Whether you have a question, found a bug, or want to talk enterprise — 
            reach out and we'll get back to you within 24 hours.
          </p>
        </div>
      </section>

      {/* ═══ CONTACT OPTIONS ═══ */}
      <div className="max-w-5xl mx-auto px-6 -mt-4 mb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: Mail, title: "Send us a message", desc: "For general questions and feedback", action: "Use form below" },
            { icon: MessageSquare, title: "Join our community", desc: "Get help from the Cloudsnap developer community", action: "Join Discord", link: "#" },
            { icon: Shield, title: "Enterprise inquiries", desc: "Custom plans, security reviews, onboarding", action: "Talk to sales", link: "/contact" },
          ].map((item) => (
            <div key={item.title} className="bg-card border border-border rounded-xl p-6 hover:shadow-card-hover transition-shadow">
              <div className="h-10 w-10 rounded-lg bg-primary/5 flex items-center justify-center mb-4">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">{item.title}</h3>
              <p className="text-xs text-muted-foreground mb-3">{item.desc}</p>
              {item.link ? (
                <a href={item.link} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                  {item.action} <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="text-xs font-semibold text-primary">{item.action} ↓</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ FORM + SIDEBAR ═══ */}
      <div className="max-w-5xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form */}
          <div className="lg:col-span-3 bg-card border border-border rounded-xl p-8">
            <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" /> Send a Message
            </h2>
            <p className="text-sm text-muted-foreground mb-6">We typically respond within 24 hours.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Full Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Email Address</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required maxLength={255} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Question</SelectItem>
                    <SelectItem value="bug">Bug Report</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                    <SelectItem value="enterprise">Enterprise Inquiry</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's this about?" required maxLength={500} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Message</Label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your question, issue, or suggestion..."
                  className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  required maxLength={5000}
                />
                <p className="text-[10px] text-muted-foreground text-right">{message.length}/5000</p>
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? "Sending..." : "Send Message"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-5">
            {/* Contact details */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-sm font-bold text-foreground mb-4">Contact Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">support@cloudsnap.studio</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Response within 24 hours</span>
                </div>
              </div>
            </div>

            {/* Quick start */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Quick Start Guide
              </h3>
              <div className="space-y-3">
                {[
                  { step: "1", title: "Create an Account" },
                  { step: "2", title: "Connect Cloud Provider" },
                  { step: "3", title: "Import Project" },
                  { step: "4", title: "Click Deploy" },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/5 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {item.step}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <span className="h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
              <span className="text-sm text-foreground font-medium">All systems operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FAQ ═══ */}
      <section className="bg-secondary/30 section-padding">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">FAQ</p>
            <h2 className="text-3xl font-bold text-foreground mb-3">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-secondary/50 transition-colors"
                >
                  <span className="text-sm font-semibold text-foreground pr-4">{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ${expandedFaq === i ? "rotate-180" : ""}`} />
                </button>
                {expandedFaq === i && (
                  <div className="px-5 pb-5 -mt-1 animate-fade-in">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}