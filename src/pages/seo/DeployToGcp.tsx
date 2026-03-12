import SEOLandingPage from "@/components/SEOLandingPage";

export default function DeployToGcp() {
  return (
    <SEOLandingPage
      seo={{
        title: "Deploy to Google Cloud Automatically | Cloudsnap Studio",
        description: "Deploy web applications to Google Cloud Platform with one click. Cloud Run, App Engine, and GKE deployment automation. Coming soon.",
        canonical: "https://cloudsnap.studio/deploy-to-gcp",
        keywords: "deploy to gcp, google cloud deployment, gcp automation, cloud run deployment, google cloud hosting, gke deployment",
      }}
      hero={{
        badge: "Coming Soon",
        headline: "Deploy to Google Cloud — Coming Soon",
        subheadline: "Cloud Run, App Engine, and GKE — automated deployments to Google Cloud Platform through Cloudsnap. Join the waitlist.",
        cta: "Join the Waitlist",
      }}
      features={[
        { title: "Cloud Run", description: "Deploy containers to Cloud Run with automatic scaling to zero." },
        { title: "App Engine", description: "Deploy web applications with managed infrastructure and auto-scaling." },
        { title: "Cloud SQL", description: "Provision managed PostgreSQL or MySQL databases automatically." },
        { title: "Cloud CDN", description: "Global content delivery for static assets and API caching." },
        { title: "Firebase Integration", description: "Connect Firebase for authentication, real-time database, and hosting." },
        { title: "GKE Clusters", description: "Deploy to Google Kubernetes Engine for complex microservices architectures." },
      ]}
      faqs={[
        { question: "When will GCP support be available?", answer: "GCP deployment is in development. Join the waitlist to get early access." },
        { question: "Will Cloud Run be supported?", answer: "Yes. Cloud Run is our primary GCP deployment target for its simplicity and scale-to-zero capability." },
      ]}
      relatedPages={[
        { label: "Deploy to AWS", path: "/deploy-to-aws" },
        { label: "Deploy to Azure", path: "/deploy-to-azure" },
        { label: "Multi-Cloud Deployment", path: "/multi-cloud-deployment" },
      ]}
    />
  );
}
