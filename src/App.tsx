import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { lazy, Suspense } from "react";
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
import Features from "./pages/Features";
import Pricing from "./pages/Pricing";
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

// SEO Landing Pages (lazy loaded)
const DeployReactApp = lazy(() => import("./pages/seo/DeployReactApp"));
const DeployNodejsApi = lazy(() => import("./pages/seo/DeployNodejsApi"));
const DeployPythonApi = lazy(() => import("./pages/seo/DeployPythonApi"));
const DeployFullstackApp = lazy(() => import("./pages/seo/DeployFullstackApp"));
const DeployDockerApp = lazy(() => import("./pages/seo/DeployDockerApp"));
const DeployToAws = lazy(() => import("./pages/seo/DeployToAws"));
const DeployToAzure = lazy(() => import("./pages/seo/DeployToAzure"));
const DeployToGcp = lazy(() => import("./pages/seo/DeployToGcp"));
const AutomatedCloudDeployment = lazy(() => import("./pages/seo/AutomatedCloudDeployment"));
const GithubAutoDeploy = lazy(() => import("./pages/seo/GithubAutoDeploy"));
const MultiCloudDeployment = lazy(() => import("./pages/seo/MultiCloudDeployment"));
const AiDeploymentPlatform = lazy(() => import("./pages/seo/AiDeploymentPlatform"));

const queryClient = new QueryClient();

const LazyPage = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading...</div>}>
    {children}
  </Suspense>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

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
    <Route path="/features" element={<Features />} />
    <Route path="/integrations" element={<Navigate to="/features" replace />} />
    <Route path="/pricing" element={<Pricing />} />
    <Route path="/reviews" element={<Reviews />} />
    <Route path="/contact" element={<ContactSupport />} />
    <Route path="/support" element={<ContactSupport />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />

    {/* SEO Landing Pages */}
    <Route path="/deploy-react-app" element={<LazyPage><DeployReactApp /></LazyPage>} />
    <Route path="/deploy-nodejs-api" element={<LazyPage><DeployNodejsApi /></LazyPage>} />
    <Route path="/deploy-python-api" element={<LazyPage><DeployPythonApi /></LazyPage>} />
    <Route path="/deploy-fullstack-app" element={<LazyPage><DeployFullstackApp /></LazyPage>} />
    <Route path="/deploy-docker-app" element={<LazyPage><DeployDockerApp /></LazyPage>} />
    <Route path="/deploy-to-aws" element={<LazyPage><DeployToAws /></LazyPage>} />
    <Route path="/deploy-to-azure" element={<LazyPage><DeployToAzure /></LazyPage>} />
    <Route path="/deploy-to-gcp" element={<LazyPage><DeployToGcp /></LazyPage>} />
    <Route path="/automated-cloud-deployment" element={<LazyPage><AutomatedCloudDeployment /></LazyPage>} />
    <Route path="/github-auto-deploy" element={<LazyPage><GithubAutoDeploy /></LazyPage>} />
    <Route path="/multi-cloud-deployment" element={<LazyPage><MultiCloudDeployment /></LazyPage>} />
    <Route path="/ai-deployment-platform" element={<LazyPage><AiDeploymentPlatform /></LazyPage>} />

    {/* Protected Routes */}
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
