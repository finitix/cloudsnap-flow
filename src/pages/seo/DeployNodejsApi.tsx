import SEOLandingPage from "@/components/SEOLandingPage";

export default function DeployNodejsApi() {
  return (
    <SEOLandingPage
      seo={{
        title: "Deploy Node.js API to Cloud Automatically | Cloudsnap Studio",
        description: "Deploy Node.js backends and APIs to AWS EC2, Render, or any cloud. Auto-detect Express, Fastify, NestJS. Zero DevOps configuration.",
        canonical: "https://cloudsnap.studio/deploy-nodejs-api",
        keywords: "deploy nodejs api, node js cloud hosting, deploy express api, nodejs deployment automation, deploy node backend",
      }}
      hero={{
        badge: "Node.js Deployment",
        headline: "Deploy Node.js APIs Without DevOps",
        subheadline: "Cloudsnap auto-detects Express, Fastify, and NestJS projects. Push your code and get a live API endpoint in minutes.",
        cta: "Deploy Your Node.js API",
      }}
      features={[
        { title: "Express & Fastify Support", description: "Auto-detect popular Node.js frameworks and configure start commands." },
        { title: "Database Connections", description: "Connect to PostgreSQL, MongoDB, or Redis directly from your dashboard." },
        { title: "Auto-Scaling", description: "Your API scales automatically based on traffic with zero configuration." },
        { title: "Health Monitoring", description: "Built-in health checks and uptime monitoring for your APIs." },
        { title: "Log Streaming", description: "Real-time log streaming to debug issues without SSH access." },
        { title: "Docker Support", description: "Bring your own Dockerfile or let Cloudsnap generate one automatically." },
      ]}
      howItWorks={[
        { step: "1", title: "Connect GitHub", description: "Link your repository containing the Node.js project." },
        { step: "2", title: "Configure", description: "Cloudsnap detects your framework and sets PORT, start command, and dependencies." },
        { step: "3", title: "Go Live", description: "Your API is deployed with a public HTTPS endpoint and health monitoring." },
      ]}
      codeExample={`# Cloudsnap detects your package.json
# Runs automatically:
$ npm install
$ npm start
# API live at: https://api.your-app.cloudsnap.studio
# Health check: GET /health → 200 OK`}
      faqs={[
        { question: "Which Node.js versions are supported?", answer: "Cloudsnap supports Node.js 16, 18, 20, and 22. It auto-detects the version from your .nvmrc or engines field." },
        { question: "Can I deploy a NestJS application?", answer: "Yes. NestJS projects are fully supported with automatic build and start configuration." },
        { question: "How are environment variables handled?", answer: "Add secrets through the Cloudsnap dashboard. They're securely injected at runtime, never exposed in logs." },
      ]}
      relatedPages={[
        { label: "Deploy React App", path: "/deploy-react-app" },
        { label: "Deploy Python API", path: "/deploy-python-api" },
        { label: "Deploy to AWS", path: "/deploy-to-aws" },
        { label: "Deploy Full Stack App", path: "/deploy-fullstack-app" },
      ]}
    />
  );
}
