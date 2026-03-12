import SEOLandingPage from "@/components/SEOLandingPage";

export default function GithubAutoDeploy() {
  return (
    <SEOLandingPage
      seo={{
        title: "GitHub Auto Deploy — Push to Deploy | Cloudsnap Studio",
        description: "Automatically deploy your GitHub projects on every push. Connect your repo, configure once, and every commit to main goes live.",
        canonical: "https://cloudsnap.studio/github-auto-deploy",
        keywords: "github auto deploy, push to deploy, github deployment, auto deploy github, github ci cd, github cloud deploy",
      }}
      hero={{
        badge: "GitHub Integration",
        headline: "Push to GitHub. Deploy Automatically.",
        subheadline: "Connect your GitHub repository once. Every push to your main branch triggers an automatic build and deployment. Zero maintenance CI/CD.",
        cta: "Connect GitHub",
      }}
      features={[
        { title: "Instant Deploys", description: "Push to main and your app deploys in under 2 minutes." },
        { title: "Branch Previews", description: "Every PR gets its own preview URL for testing before merge." },
        { title: "Commit History", description: "View deployment history linked to specific commits and PRs." },
        { title: "Selective Deploy", description: "Deploy specific branches, tags, or only on manual trigger." },
        { title: "Build Logs", description: "Real-time build logs accessible from the dashboard and GitHub status checks." },
        { title: "Monorepo Support", description: "Only redeploy services that changed in monorepo setups." },
      ]}
      howItWorks={[
        { step: "1", title: "Authorize GitHub", description: "Connect your GitHub account with one click OAuth." },
        { step: "2", title: "Select Repository", description: "Choose the repo and branch to watch for deployments." },
        { step: "3", title: "Auto Deploy", description: "Every push triggers build → test → deploy automatically." },
      ]}
      faqs={[
        { question: "Do I need to set up GitHub Actions?", answer: "No. Cloudsnap handles the entire CI/CD pipeline. No GitHub Actions, no workflow files needed." },
        { question: "Can I deploy from private repositories?", answer: "Yes. Once you authorize Cloudsnap via GitHub OAuth, private repos are accessible." },
        { question: "Can I deploy specific branches?", answer: "Yes. You can configure which branches trigger auto-deployment." },
      ]}
      relatedPages={[
        { label: "Automated Cloud Deployment", path: "/automated-cloud-deployment" },
        { label: "Deploy React App", path: "/deploy-react-app" },
        { label: "Deploy to AWS", path: "/deploy-to-aws" },
        { label: "Multi-Cloud Deployment", path: "/multi-cloud-deployment" },
      ]}
    />
  );
}
