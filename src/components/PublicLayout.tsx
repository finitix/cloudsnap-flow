import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Cloud, ArrowRight, Zap, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const navLinks = [
  { label: "Features", path: "/features" },
  { label: "Integrations", path: "/integrations" },
  { label: "Pricing", path: "/pricing" },
  { label: "About", path: "/about" },
  { label: "Contact", path: "/contact" },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground tracking-tight">Cloudsnap Studio</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.path
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link to="/dashboard">
                <Button size="sm">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm">
                    Get Started Free
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu */}
          <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-card p-4 space-y-2 animate-fade-in">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-border">
              <Link to="/auth" onClick={() => setMobileOpen(false)}>
                <Button className="w-full" size="sm">Get Started Free</Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-card border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
                <span className="font-bold text-sm">Cloudsnap Studio</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Deploy anywhere, monitor everything. One dashboard for all your clouds.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">Product</h4>
              <div className="space-y-2.5">
                <Link to="/#features" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
                <Link to="/#integrations" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Integrations</Link>
                <Link to="/#pricing" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
                <Link to="/reviews" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Reviews</Link>
              </div>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">Company</h4>
              <div className="space-y-2.5">
                <Link to="/about" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link>
                <Link to="/contact" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
              </div>
            </div>

            {/* Developers */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">Developers</h4>
              <div className="space-y-2.5">
                <Link to="/auth" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Get Started</Link>
                <Link to="/dashboard" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
              </div>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-4">Legal</h4>
              <div className="space-y-2.5">
                <Link to="/privacy" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
                <Link to="/terms" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">© 2026 Cloudsnap Studio by Finitix. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Twitter</a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">GitHub</a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}