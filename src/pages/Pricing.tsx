import { Link } from "react-router-dom";
import {
  ArrowRight, Zap, CheckCircle, HelpCircle, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import PublicLayout from "@/components/PublicLayout";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Perfect for students and hobby projects",
    features: ["1 project", "1 cloud connection", "AI stack auto-detection", "Community support", "Basic monitoring", "Free-tier optimized deployments"],
    cta: "Start for Free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    desc: "For developers shipping to production",
    features: ["Unlimited projects", "5 cloud connections", "AI auto-healing", "Priority email support", "Advanced monitoring & alerts", "Custom domains & SSL", "Deployment history (90 days)", "Team collaboration (2 seats)"],
    cta: "Start Pro Trial",
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Team",
    price: "$99",
    period: "/month",
    desc: "For teams building together",
    features: ["Everything in Pro", "Unlimited connections", "10 team seats", "Role-based access control", "Audit logs", "Shared dashboards", "Priority Slack support", "Advanced analytics"],
    cta: "Start Team Trial",
    highlight: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For organizations at scale",
    features: ["Everything in Team", "SSO / SAML", "Unlimited seats", "Dedicated account manager", "99.9% uptime SLA", "On-premise deployment option", "Custom integrations", "Security review & compliance"],
    cta: "Contact Sales",
    highlight: false,
  },
];

const faqs = [
  { q: "Can I switch plans later?", a: "Yes! You can upgrade or downgrade at any time. Changes take effect at the start of your next billing cycle." },
  { q: "Is there a free trial for paid plans?", a: "Yes, both Pro and Team plans come with a 14-day free trial. No credit card required to start." },
  { q: "What happens if I exceed my project limit?", a: "You'll be prompted to upgrade your plan. We'll never delete your projects — you just won't be able to create new ones until you upgrade." },
  { q: "Do you offer student discounts?", a: "Yes! Students with a valid .edu email get 50% off Pro and Team plans. Contact us to get your discount." },
  { q: "Can I cancel anytime?", a: "Absolutely. No contracts, no cancellation fees. Cancel from your dashboard and you'll retain access until the end of your billing period." },
  { q: "What payment methods do you accept?", a: "We accept all major credit cards, debit cards, and PayPal. Enterprise customers can pay by invoice." },
];

const comparisonRows = [
  { feature: "Projects", free: "1", pro: "Unlimited", team: "Unlimited", enterprise: "Unlimited" },
  { feature: "Cloud connections", free: "1", pro: "5", team: "Unlimited", enterprise: "Unlimited" },
  { feature: "AI stack detection", free: "✓", pro: "✓", team: "✓", enterprise: "✓" },
  { feature: "AI auto-healing", free: "—", pro: "✓", team: "✓", enterprise: "✓" },
  { feature: "Custom domains", free: "—", pro: "✓", team: "✓", enterprise: "✓" },
  { feature: "Team seats", free: "1", pro: "2", team: "10", enterprise: "Unlimited" },
  { feature: "Monitoring", free: "Basic", pro: "Advanced", team: "Advanced", enterprise: "Custom" },
  { feature: "Support", free: "Community", pro: "Email", team: "Slack", enterprise: "Dedicated" },
  { feature: "SSO / SAML", free: "—", pro: "—", team: "—", enterprise: "✓" },
  { feature: "SLA", free: "—", pro: "—", team: "99.5%", enterprise: "99.9%" },
];

export default function Pricing() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
        </div>
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24 text-center relative z-10">
          <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium bg-primary/5 text-primary border-primary/20">
            <Zap className="h-3 w-3 mr-1.5" />
            Simple & Transparent
          </Badge>
          <h1 className="text-4xl md:text-[56px] font-extrabold tracking-tight leading-[1.1] text-foreground mb-6">
            Simple pricing.{" "}
            <span className="gradient-text">No surprises.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Start free, scale as you grow. No hidden fees, no contracts.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan) => (
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
                <Link to={plan.name === "Enterprise" ? "/contact" : "/auth"}>
                  <Button variant={plan.highlight ? "default" : "outline"} className="w-full" size="sm">
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="section-padding bg-secondary/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Compare Plans</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Feature comparison</h2>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left p-4 text-muted-foreground font-medium">Feature</th>
                  <th className="text-center p-4 text-foreground font-medium">Free</th>
                  <th className="text-center p-4 text-primary font-bold">Pro</th>
                  <th className="text-center p-4 text-foreground font-medium">Team</th>
                  <th className="text-center p-4 text-foreground font-medium">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-4 text-foreground font-medium">{row.feature}</td>
                    {[row.free, row.pro, row.team, row.enterprise].map((val, j) => (
                      <td key={j} className={`p-4 text-center ${j === 1 ? "bg-primary/[0.02]" : ""}`}>
                        {val === "✓" ? (
                          <CheckCircle className="h-4 w-4 text-success mx-auto" />
                        ) : val === "—" ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">{val}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section-padding bg-background">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Pricing questions</h2>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="bg-card border border-border rounded-xl px-6 data-[state=open]:shadow-card">
                <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-5">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="section-padding-lg relative overflow-hidden" style={{ background: "linear-gradient(180deg, hsl(210 40% 98%), hsl(200 50% 97%))" }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-[100px]" />
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <Rocket className="h-12 w-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Start deploying today.
          </h2>
          <p className="text-muted-foreground mb-10 text-lg max-w-lg mx-auto">No credit card required. Free forever plan available.</p>
          <Link to="/auth">
            <Button size="lg" className="h-14 px-12 text-base font-semibold shadow-md hover:shadow-lg transition-shadow rounded-xl">
              Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground mt-5">Join 2,000+ developers deploying smarter</p>
        </div>
      </section>
    </PublicLayout>
  );
}
