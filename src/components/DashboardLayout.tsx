import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Cloud, LayoutDashboard, FolderGit2, Plug, LogOut, Rocket, Activity, Settings, PanelLeftClose, PanelLeft, ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Projects", icon: FolderGit2, path: "/projects" },
  { label: "Connections", icon: Plug, path: "/connections" },
  { label: "Deployments", icon: Rocket, path: "/deployments" },
  { label: "Monitoring", icon: Activity, path: "/monitoring" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

// Pages where back button should appear (not dashboard)
const backButtonRoutes = ["/projects", "/connections", "/deployments", "/monitoring", "/settings"];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const allNavItems = isAdmin ? [...navItems, { label: "Admin", icon: Shield, path: "/admin" }] : navItems;

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const showBackButton = backButtonRoutes.some(r => location.pathname.startsWith(r));
  const isSubpage = location.pathname.split("/").filter(Boolean).length > 1;

  const handleBack = () => {
    if (isSubpage) {
      // Go up one level (e.g. /projects/123 → /projects)
      const parts = location.pathname.split("/").filter(Boolean);
      navigate("/" + parts.slice(0, -1).join("/"));
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "border-r border-border bg-card flex flex-col shrink-0 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}>
        <div className={cn("border-b border-border flex items-center", collapsed ? "p-3 justify-center" : "p-6 justify-between")}>
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <Cloud className="h-6 w-6 text-primary shrink-0" />
            {!collapsed && <span className="font-bold text-lg tracking-tight">Cloudsnap</span>}
          </Link>
          {!collapsed && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setCollapsed(true)}>
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        {collapsed && (
          <div className="p-2 flex justify-center">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setCollapsed(false)}>
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        <nav className={cn("flex-1 space-y-1", collapsed ? "p-2" : "p-4")}>
          {allNavItems.map((item) => {
            const active = location.pathname === item.path || (item.path !== "/dashboard" && location.pathname.startsWith(item.path));
            const linkContent = (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path} delayDuration={0}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return <div key={item.path}>{linkContent}</div>;
          })}
        </nav>

        <div className={cn("border-t border-border", collapsed ? "p-2" : "p-4")}>
          {!collapsed ? (
            <>
              <div className="flex items-center gap-3 mb-3 px-3">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                  {user?.email?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </>
          ) : (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-full text-muted-foreground" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Back button header */}
        {showBackButton && (
          <div className="px-8 pt-6 pb-0">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back{isSubpage ? "" : " to Dashboard"}
            </Button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
