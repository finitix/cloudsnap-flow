import { ReactNode, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Cloud, LayoutDashboard, Users, Star, Mail, FolderGit2, Rocket, Plug, LogOut, PanelLeftClose, PanelLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { label: "Overview", icon: LayoutDashboard, path: "/admin" },
  { label: "Users", icon: Users, path: "/admin/users" },
  { label: "Projects", icon: FolderGit2, path: "/admin/projects" },
  { label: "Deployments", icon: Rocket, path: "/admin/deployments" },
  { label: "Connections", icon: Plug, path: "/admin/connections" },
  { label: "Reviews", icon: Star, path: "/admin/reviews" },
  { label: "Messages", icon: Mail, path: "/admin/messages" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="flex h-screen bg-background">
      <aside className={cn(
        "border-r border-border bg-card flex flex-col shrink-0 transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}>
        <div className={cn("border-b border-border flex items-center", collapsed ? "p-3 justify-center" : "p-6 justify-between")}>
          <Link to="/admin" className="flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-destructive shrink-0" />
            {!collapsed && <span className="font-bold text-lg tracking-tight">Admin Panel</span>}
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
          {adminNavItems.map((item) => {
            const active = location.pathname === item.path;
            const linkContent = (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
                  active
                    ? "bg-destructive/10 text-destructive"
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

          {/* Separator + back to user dashboard */}
          <div className={cn("pt-4 mt-4 border-t border-border", collapsed ? "px-0" : "")}>
            {collapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link to="/dashboard" className="flex justify-center px-2 py-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                    <Cloud className="h-4 w-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">User Dashboard</TooltipContent>
              </Tooltip>
            ) : (
              <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted">
                <Cloud className="h-4 w-4 shrink-0" />
                User Dashboard
              </Link>
            )}
          </div>
        </nav>

        <div className={cn("border-t border-border", collapsed ? "p-2" : "p-4")}>
          {!collapsed ? (
            <>
              <div className="flex items-center gap-3 mb-3 px-3">
                <div className="h-8 w-8 rounded-full bg-destructive/20 flex items-center justify-center text-destructive text-xs font-bold shrink-0">
                  {user?.email?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                  <p className="text-[10px] text-destructive font-medium">Admin</p>
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

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
