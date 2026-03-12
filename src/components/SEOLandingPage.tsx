import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle, Zap, Rocket, Code, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import PublicLayout from "@/components/PublicLayout";
import SEOHead from "@/components/SEOHead";

interface Feature {
  title: string;
  description: string;
}

interface FAQ {
  question: string;
  answer: string;
}

interface SEOLandingPageProps {
  seo: {
    title: string;
    description: string;
    canonical: string;
    keywords: string;
    jsonLd?: Record<string, unknown>;
  };
  hero: {
    badge?: string;
    headline: string;
    subheadline: string;
    cta: string;
    ctaLink?: string;
  };
  features: Feature[];
  howItWorks?: { step: string; title: string; description: string }[];
  faqs?: FAQ[];
  relatedPages?: { label: string; path: string }[];
  codeExample?: string;
}

export default function SEOLandingPage({ seo, hero, features, howItWorks, faqs, relatedPages, codeExample }: SEOLandingPageProps) {
  const faqJsonLd = faqs ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(f => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  } : undefined;

  const mergedJsonLd = seo.jsonLd && faqJsonLd
    ? [seo.jsonLd, faqJsonLd]
    : seo.jsonLd || faqJsonLd;

  return (
    <PublicLayout>
      <SEOHead {...seo} jsonLd={mergedJsonLd as any} />

      {/* Hero */}
      <section className="section-padding-lg">
        <div className="max-w-4xl mx-auto px-6 text-center">
          {hero.badge && (
            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary mb-6">
              {hero.badge}
            </span>
          )}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground mb-6 tracking-tight leading-tight">
            {hero.headline}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            {hero.subheadline}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={hero.ctaLink || "/auth"}>
              <Button size="lg" className="gap-2">
                <Rocket className="h-4 w-4" />
                {hero.cta}
              </Button>
            </Link>
            <Link to="/features">
              <Button size="lg" variant="outline" className="gap-2">
                See All Features <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section-padding bg-secondary/30">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">Key Benefits</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="glass-card p-6 transition-shadow">
                <CheckCircle className="h-5 w-5 text-primary mb-3" />
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      {howItWorks && (
        <section className="section-padding">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-foreground mb-12">How It Works</h2>
            <div className="space-y-8">
              {howItWorks.map((s, i) => (
                <div key={i} className="flex gap-5 items-start">
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{s.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Code Example */}
      {codeExample && (
        <section className="section-padding bg-secondary/30">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-center text-foreground mb-8">
              <Code className="inline h-5 w-5 mr-2" />
              Quick Start
            </h2>
            <pre className="bg-card border border-border rounded-xl p-6 overflow-x-auto text-sm font-mono text-foreground">
              {codeExample}
            </pre>
          </div>
        </section>
      )}

      {/* FAQs */}
      {faqs && faqs.length > 0 && (
        <section className="section-padding">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-foreground mb-12">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((f, i) => (
                <details key={i} className="glass-card p-5 group">
                  <summary className="font-semibold text-foreground cursor-pointer flex items-center justify-between">
                    {f.question}
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Related Pages */}
      {relatedPages && relatedPages.length > 0 && (
        <section className="section-padding bg-secondary/30">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-center text-foreground mb-8">Explore More</h2>
            <div className="flex flex-wrap gap-3 justify-center">
              {relatedPages.map((p, i) => (
                <Link key={i} to={p.path}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    {p.label} <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="section-padding-lg">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Deploy?</h2>
          <p className="text-muted-foreground mb-8">Start deploying your applications in minutes, not hours.</p>
          <Link to="/auth">
            <Button size="lg" className="gap-2">
              <Zap className="h-4 w-4" />
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
