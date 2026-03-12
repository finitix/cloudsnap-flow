import SEOLandingPage from "@/components/SEOLandingPage";

export default function DeployToAws() {
  return (
    <SEOLandingPage
      seo={{
        title: "Deploy to AWS Automatically | Cloudsnap Studio",
        description: "Deploy web applications to Amazon Web Services with one click. Automatic EC2, VPC, security groups, and Nginx configuration. No AWS expertise needed.",
        canonical: "https://cloudsnap.studio/deploy-to-aws",
        keywords: "deploy to aws, aws deployment automation, aws ec2 deployment, deploy app to aws, aws cloud hosting, amazon web services deployment",
      }}
      hero={{
        badge: "AWS Deployment",
        headline: "Deploy to AWS Without the Complexity",
        subheadline: "Cloudsnap provisions EC2 instances, configures VPCs, security groups, and Nginx — all automatically. Deploy any app to AWS in minutes.",
        cta: "Deploy to AWS Now",
      }}
      features={[
        { title: "One-Click EC2", description: "Launch EC2 instances with the right size, security groups, and networking pre-configured." },
        { title: "VPC & Networking", description: "Automatic VPC creation with public/private subnets, internet gateway, and route tables." },
        { title: "Security Groups", description: "Pre-configured firewall rules for HTTP (80), HTTPS (443), and SSH (22)." },
        { title: "Nginx Configuration", description: "Automatic Nginx reverse proxy setup for serving your application." },
        { title: "Free Tier Alerts", description: "Get alerts before you exceed AWS Free Tier limits to avoid unexpected charges." },
        { title: "IAM Best Practices", description: "Deploy with least-privilege IAM policies following AWS security best practices." },
      ]}
      howItWorks={[
        { step: "1", title: "Connect AWS Account", description: "Add your AWS access key or IAM role from the Cloudsnap dashboard." },
        { step: "2", title: "Select Project", description: "Choose which project to deploy and select your preferred AWS region." },
        { step: "3", title: "Auto-Deploy", description: "Cloudsnap creates infrastructure, deploys your app, and verifies it's reachable." },
      ]}
      codeExample={`# What Cloudsnap creates on AWS:
✓ VPC with public subnet
✓ Internet Gateway + Route Table
✓ Security Group (ports 80, 443, 22)
✓ EC2 t2.micro instance (Free Tier eligible)
✓ Docker + Nginx installed
✓ Application deployed and verified
✓ Public URL: http://ec2-xx-xx-xx-xx.compute.amazonaws.com`}
      faqs={[
        { question: "Will I stay within AWS Free Tier?", answer: "Yes. Cloudsnap defaults to t2.micro instances which are Free Tier eligible. You'll get alerts before exceeding limits." },
        { question: "Which AWS regions are supported?", answer: "All standard AWS regions are supported. Choose the region closest to your users for best performance." },
        { question: "Do I need AWS experience?", answer: "No. Cloudsnap handles all AWS infrastructure setup. You just need an AWS account with access keys." },
        { question: "Can I deploy multiple apps to AWS?", answer: "Yes. Each project gets its own EC2 instance with isolated networking and security." },
      ]}
      relatedPages={[
        { label: "Deploy to Azure", path: "/deploy-to-azure" },
        { label: "Deploy to GCP", path: "/deploy-to-gcp" },
        { label: "Multi-Cloud Deployment", path: "/multi-cloud-deployment" },
        { label: "Deploy React App", path: "/deploy-react-app" },
      ]}
    />
  );
}
