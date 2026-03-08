import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Connections from "./pages/Connections";
import Deployments from "./pages/Deployments";
import Monitoring from "./pages/Monitoring";
import Settings from "./pages/Settings";
import About from "./pages/About";
import Reviews from "./pages/Reviews";
import ContactSupport from "./pages/ContactSupport";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminProjects from "./pages/AdminProjects";
import AdminDeployments from "./pages/AdminDeployments";
import AdminConnections from "./pages/AdminConnections";
import AdminReviews from "./pages/AdminReviews";
import AdminMessages from "./pages/AdminMessages";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

/** Routes only for regular (non-admin) users. Admins get redirected to /admin. */
function UserRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  if (loading || adminLoading) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  if (loading || adminLoading) return null;
  if (user && isAdmin) return <Navigate to="/admin" replace />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
    <Route path="/about" element={<About />} />
    <Route path="/reviews" element={<Reviews />} />
    <Route path="/contact" element={<ContactSupport />} />
    <Route path="/support" element={<ContactSupport />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />
    <Route path="/dashboard" element={<UserRoute><Dashboard /></UserRoute>} />
    <Route path="/projects" element={<UserRoute><Projects /></UserRoute>} />
    <Route path="/projects/:id" element={<UserRoute><ProjectDetail /></UserRoute>} />
    <Route path="/connections" element={<UserRoute><Connections /></UserRoute>} />
    <Route path="/deployments" element={<UserRoute><Deployments /></UserRoute>} />
    <Route path="/monitoring" element={<UserRoute><Monitoring /></UserRoute>} />
    <Route path="/settings" element={<UserRoute><Settings /></UserRoute>} />
    <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
    <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
    <Route path="/admin/projects" element={<ProtectedRoute><AdminProjects /></ProtectedRoute>} />
    <Route path="/admin/deployments" element={<ProtectedRoute><AdminDeployments /></ProtectedRoute>} />
    <Route path="/admin/connections" element={<ProtectedRoute><AdminConnections /></ProtectedRoute>} />
    <Route path="/admin/reviews" element={<ProtectedRoute><AdminReviews /></ProtectedRoute>} />
    <Route path="/admin/messages" element={<ProtectedRoute><AdminMessages /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
