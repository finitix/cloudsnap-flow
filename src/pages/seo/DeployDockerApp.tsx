import SEOLandingPage from "@/components/SEOLandingPage";

export default function DeployDockerApp() {
  return (
    <SEOLandingPage
      seo={{
        title: "Deploy Docker Containers to Cloud | Cloudsnap Studio",
        description: "Deploy Docker containers to AWS EC2 or any cloud provider. Automatic port mapping, health checks, and container management.",
        canonical: "https://cloudsnap.studio/deploy-docker-app",
        keywords: "deploy docker container, docker cloud deployment, docker hosting, deploy docker to aws, container deployment platform",
      }}
      hero={{
        badge: "Docker Deployment",
        headline: "Deploy Docker Containers Effortlessly",
        subheadline: "Push your Dockerfile, and Cloudsnap builds, deploys, and monitors your container on AWS EC2 with automatic port mapping and health checks.",
        cta: "Deploy Docker Container",
      }}
      features={[
        { title: "Auto Port Mapping", description: "Cloudsnap maps container ports (3000, 5000, 8000) to port 80 automatically." },
        { title: "Health Checks", description: "Built-in health check endpoints verify your container is responding." },
        { title: "Container Logs", description: "Stream container logs in real-time from the dashboard." },
        { title: "Auto-Restart", description: "Containers automatically restart on crashes with configurable retry policies." },
        { title: "Multi-Container", description: "Deploy docker-compose stacks with multiple interconnected services." },
        { title: "Registry Support", description: "Pull images from Docker Hub, ECR, or any private registry." },
      ]}
      howItWorks={[
        { step: "1", title: "Add Dockerfile", description: "Include a Dockerfile in your repository root." },
        { step: "2", title: "Build & Push", description: "Cloudsnap builds your image and pushes it to the deployment target." },
        { step: "3", title: "Run & Monitor", description: "Your container runs with automatic port mapping, health checks, and log streaming." },
      ]}
      codeExample={`# Example Dockerfile (auto-detected)
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "start"]

# Cloudsnap runs: docker run -d -p 80:3000 your-app`}
      faqs={[
        { question: "Do I need a Dockerfile?", answer: "Not always. If your project uses a standard framework, Cloudsnap can generate a Dockerfile. But bringing your own gives you full control." },
        { question: "Can I deploy docker-compose projects?", answer: "Yes. Cloudsnap supports multi-container deployments with docker-compose files." },
        { question: "Which cloud providers support Docker deployment?", answer: "AWS EC2, Render, and all providers that support container workloads." },
      ]}
      relatedPages={[
        { label: "Deploy to AWS", path: "/deploy-to-aws" },
        { label: "Deploy Node.js API", path: "/deploy-nodejs-api" },
        { label: "Automated Cloud Deployment", path: "/automated-cloud-deployment" },
        { label: "Deploy Full Stack App", path: "/deploy-fullstack-app" },
      ]}
    />
  );
}
