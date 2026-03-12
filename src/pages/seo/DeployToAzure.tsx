import SEOLandingPage from "@/components/SEOLandingPage";

export default function DeployToAzure() {
  return (
    <SEOLandingPage
      seo={{
        title: "Deploy to Azure Automatically | Cloudsnap Studio",
        description: "Deploy web apps to Microsoft Azure with one click. Automatic App Service, container instances, and networking setup. Coming soon.",
        canonical: "https://cloudsnap.studio/deploy-to-azure",
        keywords: "deploy to azure, azure deployment automation, microsoft azure hosting, azure app service deployment, azure cloud deployment",
      }}
      hero={{
        badge: "Coming Soon",
        headline: "Deploy to Microsoft Azure — Coming Soon",
        subheadline: "Azure App Service, Container Instances, and AKS deployment — all automated through Cloudsnap Studio. Join the waitlist.",
        cta: "Join the Waitlist",
      }}
      features={[
        { title: "Azure App Service", description: "Deploy web apps to Azure App Service with automatic scaling and SSL." },
        { title: "Container Instances", description: "Run Docker containers on Azure Container Instances without managing VMs." },
        { title: "Azure DevOps Integration", description: "Connect Azure DevOps pipelines for enterprise CI/CD workflows." },
        { title: "Managed Databases", description: "Provision Azure SQL or CosmosDB alongside your application." },
        { title: "Global CDN", description: "Serve static assets through Azure CDN for worldwide performance." },
        { title: "Active Directory", description: "Integrate with Azure AD for enterprise authentication." },
      ]}
      faqs={[
        { question: "When will Azure support be available?", answer: "Azure deployment is currently in development. Join the waitlist to be notified when it launches." },
        { question: "Which Azure services will be supported?", answer: "App Service, Container Instances, AKS, Azure SQL, and Blob Storage are planned for launch." },
      ]}
      relatedPages={[
        { label: "Deploy to AWS", path: "/deploy-to-aws" },
        { label: "Deploy to GCP", path: "/deploy-to-gcp" },
        { label: "Multi-Cloud Deployment", path: "/multi-cloud-deployment" },
      ]}
    />
  );
}
