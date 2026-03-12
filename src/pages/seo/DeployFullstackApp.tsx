import SEOLandingPage from "@/components/SEOLandingPage";

export default function DeployFullstackApp() {
  return (
    <SEOLandingPage
      seo={{
        title: "Deploy Full Stack Apps Automatically | Cloudsnap Studio",
        description: "Deploy frontend and backend together. React + Node.js, Vue + Python, any stack — Cloudsnap handles routing, databases, and deployment.",
        canonical: "https://cloudsnap.studio/deploy-fullstack-app",
        keywords: "deploy full stack app, fullstack deployment, deploy frontend backend, full stack cloud hosting, deploy mern stack",
      }}
      hero={{
        badge: "Full Stack Deployment",
        headline: "Deploy Full Stack Apps With One Click",
        subheadline: "Frontend + Backend + Database — Cloudsnap deploys your entire stack. React + Express, Vue + Django, any combination works.",
        cta: "Deploy Full Stack",
      }}
      features={[
        { title: "Multi-Service Deploy", description: "Deploy frontend and backend as separate services with automatic routing." },
        { title: "Database Provisioning", description: "Automatically provision PostgreSQL, MySQL, or MongoDB alongside your app." },
        { title: "API Routing", description: "Configure /api routes to your backend and serve frontend from the root." },
        { title: "Shared Environment", description: "Environment variables are shared securely between frontend and backend." },
        { title: "Monorepo Support", description: "Deploy from monorepos with multiple apps in a single repository." },
        { title: "Preview Environments", description: "Every PR gets a full-stack preview with its own database." },
      ]}
      howItWorks={[
        { step: "1", title: "Connect Repository", description: "Link your monorepo or multi-repo full stack project." },
        { step: "2", title: "Configure Stack", description: "Cloudsnap detects frontend framework, backend framework, and database needs." },
        { step: "3", title: "Deploy Everything", description: "All services deploy together with proper networking and routing." },
      ]}
      faqs={[
        { question: "Can I deploy a MERN stack app?", answer: "Yes. MongoDB + Express + React + Node.js projects are fully supported with automatic configuration." },
        { question: "How does database provisioning work?", answer: "Cloudsnap provisions a managed database instance and injects the connection string into your backend environment." },
        { question: "Do I need Docker for full stack deployment?", answer: "No. Cloudsnap can deploy without Docker by auto-detecting your frameworks. Docker is optional." },
      ]}
      relatedPages={[
        { label: "Deploy React App", path: "/deploy-react-app" },
        { label: "Deploy Node.js API", path: "/deploy-nodejs-api" },
        { label: "Deploy to AWS", path: "/deploy-to-aws" },
        { label: "Multi-Cloud Deployment", path: "/multi-cloud-deployment" },
      ]}
    />
  );
}
