import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Cloud, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const navLinks = [
  { label: "About", path: "/about" },
  { label: "Reviews", path: "/reviews" },
  { label: "Contact", path: "/contact" },
  { label: "Support", path: "/support" },
];

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Nav */}
      <nav className="border-b border-border/50 sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <Cloud className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg tracking-tight">Cloudsnap Studio</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <Link to={user ? "/dashboard" : "/auth"}>
            <Button variant={user ? "default" : "outline"} size="sm">
              {user ? "Dashboard" : "Sign In"}
              {!user && <ArrowRight className="ml-1.5 h-3.5 w-3.5" />}
            </Button>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <Cloud className="h-5 w-5 text-primary" />
                <span className="font-bold tracking-tight">Cloudsnap Studio</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Deploy anything, anywhere. Zero-config cloud deployments with auto-healing and monitoring.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Product</h4>
              <div className="space-y-2">
                <Link to="/about" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">About</Link>
                <Link to="/reviews" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Reviews</Link>
                <Link to="/contact" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
                <Link to="/support" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Support</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Platform</h4>
              <div className="space-y-2">
                <Link to="/auth" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Get Started</Link>
                <Link to="/dashboard" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Dashboard</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-3">Legal</h4>
              <div className="space-y-2">
                <Link to="/terms" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Terms & Conditions</Link>
                <Link to="/privacy" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-border/50 pt-6 flex items-center justify-between text-xs text-muted-foreground">
            <p>© 2026 Cloudsnap Studio. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
