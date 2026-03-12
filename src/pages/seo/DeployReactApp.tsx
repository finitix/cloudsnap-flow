import SEOLandingPage from "@/components/SEOLandingPage";

export default function DeployReactApp() {
  return (
    <SEOLandingPage
      seo={{
        title: "Deploy React App to Cloud Automatically | Cloudsnap Studio",
        description: "Deploy your React application to AWS, Vercel, or any cloud provider with one click. Auto-detect build settings, zero configuration needed.",
        canonical: "https://cloudsnap.studio/deploy-react-app",
        keywords: "deploy react app, react deployment, react app hosting, deploy react to aws, react cloud deployment, auto deploy react",
      }}
      hero={{
        badge: "React Deployment",
        headline: "Deploy React Apps to the Cloud in One Click",
        subheadline: "Cloudsnap Studio auto-detects your React framework (CRA, Vite, Next.js), configures builds, and deploys to AWS, Vercel, or Render — no DevOps required.",
        cta: "Deploy Your React App",
      }}
      features={[
        { title: "Auto-Detect Framework", description: "Cloudsnap identifies Create React App, Vite, and Next.js projects and configures build commands automatically." },
        { title: "Instant Preview URLs", description: "Every deploy generates a unique preview URL so you can test before going live." },
        { title: "CDN & SSL Included", description: "Your React app is served from a global CDN with automatic HTTPS certificates." },
        { title: "Environment Variables", description: "Securely manage API keys and environment variables from the dashboard." },
        { title: "Rollback in Seconds", description: "Instantly rollback to any previous deployment if something goes wrong." },
        { title: "GitHub Auto-Deploy", description: "Push to your main branch and Cloudsnap deploys automatically." },
      ]}
      howItWorks={[
        { step: "1", title: "Connect Your Repository", description: "Link your GitHub account and select your React project repository." },
        { step: "2", title: "Auto-Configure", description: "Cloudsnap detects your React framework and sets up the optimal build pipeline." },
        { step: "3", title: "Deploy", description: "Click deploy and your React app goes live with a public URL in under 2 minutes." },
      ]}
      codeExample={`# Cloudsnap auto-detects and runs:
$ npm install
$ npm run build
# Output: build/ or dist/
# Deployed to: https://your-app.cloudsnap.studio`}
      faqs={[
        { question: "Does Cloudsnap support Create React App?", answer: "Yes. Cloudsnap auto-detects CRA projects and configures the build output directory (build/) automatically." },
        { question: "Can I deploy a Vite + React project?", answer: "Absolutely. Vite projects are fully supported with automatic detection of the dist/ output folder." },
        { question: "Is there a free tier for React deployments?", answer: "Yes. The free plan includes 1 project with unlimited deployments — perfect for personal projects and learning." },
        { question: "How do I add environment variables?", answer: "Navigate to your project settings in the Cloudsnap dashboard and add env vars securely. They're injected at build time." },
      ]}
      relatedPages={[
        { label: "Deploy to AWS", path: "/deploy-to-aws" },
        { label: "Deploy Node.js API", path: "/deploy-nodejs-api" },
        { label: "Deploy Full Stack App", path: "/deploy-fullstack-app" },
        { label: "GitHub Auto Deploy", path: "/github-auto-deploy" },
      ]}
    />
  );
}
