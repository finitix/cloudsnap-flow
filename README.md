# ☁️ Cloudsnap Studio

**Automated Cloud Deployment Platform for Developers, Startups & Students**

Cloudsnap Studio is a full-stack cloud deployment automation platform that enables developers to deploy web applications to AWS, Azure, and Google Cloud with a single click — no DevOps expertise required.

---

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Deployment Workflow](#deployment-workflow)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Pages & Routes](#pages--routes)
- [Authentication & Authorization](#authentication--authorization)
- [AWS Integration](#aws-integration)
- [Edge Functions](#edge-functions)
- [SEO System](#seo-system)
- [Admin Panel](#admin-panel)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)

---

## 🎯 Project Overview

Cloudsnap Studio solves the complexity of cloud deployment by automating infrastructure provisioning, build pipelines, and deployment verification. Users can:

- Import projects from **GitHub** or upload a **ZIP file**
- Auto-detect project type (Frontend, Backend, Full Stack) and framework
- Deploy to **AWS EC2** with automated VPC, Security Groups, and RDS provisioning
- Deploy to **Cloud PaaS** providers (Vercel, Render)
- Monitor deployments in real-time with status tracking
- Get automatic diagnostics and self-healing for failed deployments

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **One-Click Deploy** | Import a GitHub repo and deploy with a single click |
| **Auto-Detection** | Automatically detects project type, framework, build commands |
| **AWS Free Tier Optimized** | EC2 t3.micro, RDS db.t3.micro — stays within free tier limits |
| **Multi-Cloud Support** | AWS, Azure, GCP deployment targets |
| **Real-Time Monitoring** | Live deployment status, CPU/memory metrics via Supabase Realtime |
| **Self-Healing Deployments** | Auto-diagnose and fix common deployment failures |
| **Security Group Automation** | Opens ports 80, 443, 22, 3000-9000 automatically |
| **Deployment Verification** | Polls public URL for up to 10 minutes before marking LIVE |
| **Admin Dashboard** | Full admin panel for managing users, projects, deployments |
| **Role-Based Access Control** | Admin, Moderator, User roles with RLS policies |
| **SEO Optimized** | 12+ dedicated landing pages with structured data |
| **Contact & Feedback System** | Public feedback and support contact forms |

---

## 🛠️ Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| **React 18** | UI library with hooks and functional components |
| **TypeScript 5** | Type-safe development |
| **Vite 5** | Build tool and dev server |
| **Tailwind CSS v3** | Utility-first CSS framework |
| **shadcn/ui** | Pre-built accessible UI components |
| **React Router v6** | Client-side routing with protected routes |
| **TanStack React Query** | Server state management and caching |
| **Lucide React** | Icon library |
| **Recharts** | Data visualization and charts |
| **Sonner** | Toast notifications |
| **Framer Motion** | Animations (landing pages) |

### Backend

| Technology | Purpose |
|---|---|
| **Supabase (PostgreSQL)** | Database, authentication, real-time subscriptions |
| **Supabase Edge Functions** | Serverless TypeScript functions (Deno runtime) |
| **Supabase Storage** | File uploads (project ZIP files) |
| **Supabase Realtime** | Live deployment status updates |
| **Row Level Security (RLS)** | Database-level access control |

### Cloud & Infrastructure

| Technology | Purpose |
|---|---|
| **AWS EC2** | Compute instances for deployments |
| **AWS VPC** | Network isolation and security |
| **AWS RDS** | Managed PostgreSQL/MySQL databases |
| **AWS Security Groups** | Firewall rules automation |
| **Docker** | Containerized application deployments |
| **Nginx** | Reverse proxy and fallback web server |

### DevOps & Tooling

| Technology | Purpose |
|---|---|
| **Vercel** | Frontend hosting with SPA rewrites |
| **GitHub Integration** | Repository import and auto-deploy |
| **ESLint** | Code linting |
| **Vitest** | Unit testing framework |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  Public   │  │Dashboard │  │  Admin   │  │  SEO   │  │
│  │  Pages    │  │  Pages   │  │  Panel   │  │ Pages  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ Supabase Client SDK
┌────────────────────────▼────────────────────────────────┐
│                  Supabase Backend                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │PostgreSQL│  │   Auth   │  │ Realtime │  │Storage │  │
│  │  + RLS   │  │  (JWT)   │  │ Channels │  │ (Zips) │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│  ┌─────────────────────────────────────────────────────┐ │
│  │            Edge Functions (Deno)                     │ │
│  │  ┌─────────────────┐  ┌──────────────────────────┐  │ │
│  │  │ deploy-project  │  │      aws-deploy          │  │ │
│  │  │ analyze, build  │  │ provision, diagnose, heal│  │ │
│  │  └─────────────────┘  └──────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │ AWS SDK
┌────────────────────────▼────────────────────────────────┐
│                    AWS Infrastructure                    │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌───────┐  ┌─────────┐  │
│  │ VPC  │  │  EC2 │  │  RDS │  │  IGW  │  │ Sec Grp │  │
│  └──────┘  └──────┘  └──────┘  └───────┘  └─────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Deployment Workflow

```
User Action                    System Process
───────────                    ──────────────
1. Import GitHub repo    →     Clone & analyze repository
2. Auto-detect type      →     Identify framework, build commands
3. Choose deploy target  →     AWS EC2 or Cloud PaaS
4. Click Deploy          →     Trigger Edge Function

                    AWS Deployment Pipeline:
                    ┌─────────────────────┐
                    │     QUEUED          │
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │    BUILDING         │  ← npm install, npm run build
                    └──────────┬──────────┘
                               ▼
                    ┌─────────────────────┐
                    │   DEPLOYING         │  ← Provision VPC, EC2, SG
                    └──────────┬──────────┘     Docker build & run
                               ▼
                    ┌─────────────────────┐
                    │   VERIFYING         │  ← Poll http://PUBLIC_IP
                    └──────────┬──────────┘     (up to 10 min)
                          ┌────┴────┐
                          ▼         ▼
                    ┌──────────┐ ┌──────────┐
                    │   LIVE   │ │  FAILED  │
                    └──────────┘ └──────────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │ Auto-Diagnose │
                               │ & Self-Heal   │
                               └──────────────┘
```

### Deployment Steps (AWS)

1. **Analyze** — Detect project type (React, Node.js, Python, Docker, Full Stack)
2. **Provision Infrastructure** — Create or reuse VPC, subnets, internet gateway, security groups
3. **Launch EC2** — Start t3.micro instance with Amazon Linux 2023
4. **User Data Script** — Install Docker, clone repo, build & run container
5. **Configure Networking** — Open ports 80, 443, 22, 3000-9000 via security group rules
6. **Verify** — Poll public IP every 30 seconds for HTTP 200 response
7. **Go Live** — Mark deployment as LIVE only after successful verification

### Auto-Healing

If deployment fails, the system automatically:
- Checks security group rules and adds missing ingress rules
- Verifies internet gateway attachment
- Restarts Docker containers
- Flushes iptables and reconfigures firewall
- Logs all healing attempts in `deployment_heal_logs`

---

## 🗄️ Database Schema

### Core Tables

| Table | Description |
|---|---|
| `profiles` | User profiles (display name, avatar, email) |
| `user_roles` | Role-based access (admin, moderator, user) |
| `projects` | Deployed projects with config and status |
| `deployments` | Deployment records with logs and metrics |
| `cloud_connections` | Cloud provider OAuth tokens (Vercel, Render) |
| `aws_connections` | AWS credentials (access key, secret key, region) |

### AWS Infrastructure Tables

| Table | Description |
|---|---|
| `aws_infrastructure` | VPC, subnet, security group IDs per project |
| `aws_resources` | Individual AWS resources (EC2, RDS) with status |

### Monitoring & Healing Tables

| Table | Description |
|---|---|
| `deployment_alerts` | Alerts triggered by deployment events |
| `deployment_heal_logs` | Auto-healing attempt records |

### GitHub Integration Tables

| Table | Description |
|---|---|
| `github_accounts` | Connected GitHub accounts with OAuth tokens |
| `github_repositories` | Synced repository metadata |

### Communication Tables

| Table | Description |
|---|---|
| `feedback` | User reviews and ratings (public/private) |
| `contact_messages` | Support contact form submissions |

---

## 📁 Project Structure

```
cloudsnap-studio/
├── public/
│   ├── robots.txt              # Search engine crawler rules
│   ├── sitemap.xml             # XML sitemap for SEO
│   └── placeholder.svg
├── src/
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components (40+ components)
│   │   ├── admin/              # Admin-specific components
│   │   ├── AdminLayout.tsx     # Admin panel layout wrapper
│   │   ├── DashboardLayout.tsx # User dashboard layout with sidebar
│   │   ├── PublicLayout.tsx    # Public pages layout with nav/footer
│   │   ├── SEOHead.tsx         # Dynamic meta tags & JSON-LD injection
│   │   ├── SEOLandingPage.tsx  # Reusable SEO page template
│   │   ├── StatusBadge.tsx     # Deployment status indicator
│   │   ├── NavLink.tsx         # Active navigation link
│   │   ├── AWSInfrastructureDashboard.tsx
│   │   └── AWSMonitoringDashboard.tsx
│   ├── pages/
│   │   ├── Index.tsx           # Landing page (public)
│   │   ├── Auth.tsx            # Login / Signup
│   │   ├── Dashboard.tsx       # User dashboard overview
│   │   ├── Projects.tsx        # Project management (CRUD)
│   │   ├── ProjectDetail.tsx   # Single project view with deploy
│   │   ├── Deployments.tsx     # Deployment history (real-time)
│   │   ├── Connections.tsx     # Cloud & AWS account connections
│   │   ├── Monitoring.tsx      # Infrastructure monitoring
│   │   ├── Settings.tsx        # User profile settings
│   │   ├── About.tsx           # About page
│   │   ├── Features.tsx        # Features showcase
│   │   ├── Pricing.tsx         # Pricing plans
│   │   ├── Reviews.tsx         # Public reviews
│   │   ├── ContactSupport.tsx  # Contact form
│   │   ├── Terms.tsx           # Terms of service
│   │   ├── Privacy.tsx         # Privacy policy
│   │   ├── Admin*.tsx          # Admin panel pages (7 pages)
│   │   └── seo/                # 12 SEO landing pages
│   │       ├── DeployReactApp.tsx
│   │       ├── DeployNodejsApi.tsx
│   │       ├── DeployPythonApi.tsx
│   │       ├── DeployFullstackApp.tsx
│   │       ├── DeployDockerApp.tsx
│   │       ├── DeployToAws.tsx
│   │       ├── DeployToAzure.tsx
│   │       ├── DeployToGcp.tsx
│   │       ├── AutomatedCloudDeployment.tsx
│   │       ├── GithubAutoDeploy.tsx
│   │       ├── MultiCloudDeployment.tsx
│   │       └── AiDeploymentPlatform.tsx
│   ├── hooks/
│   │   ├── useAuth.tsx         # Authentication context & hook
│   │   ├── useAdmin.tsx        # Admin role detection hook
│   │   └── use-mobile.tsx      # Responsive breakpoint hook
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts       # Supabase client (auto-generated)
│   │       └── types.ts        # Database types (auto-generated)
│   ├── lib/
│   │   └── utils.ts            # Utility functions (cn, etc.)
│   ├── App.tsx                 # Root component with routing
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles & design tokens
├── supabase/
│   ├── config.toml             # Supabase project config
│   └── functions/
│       ├── deploy-project/     # Project analysis & cloud deploy
│       │   └── index.ts
│       └── aws-deploy/         # AWS infrastructure provisioning
│           └── index.ts
├── vercel.json                 # SPA rewrite rules for Vercel
├── tailwind.config.ts          # Tailwind configuration
├── vite.config.ts              # Vite build configuration
├── tsconfig.json               # TypeScript configuration
└── vitest.config.ts            # Test configuration
```

---

## 🌐 Pages & Routes

### Public Routes

| Route | Page | Description |
|---|---|---|
| `/` | Index | Landing page with hero, features, CTA |
| `/auth` | Auth | Login & signup (redirects if authenticated) |
| `/about` | About | Company information |
| `/features` | Features | Platform features showcase |
| `/pricing` | Pricing | Pricing plans |
| `/reviews` | Reviews | Public user reviews |
| `/contact` | Contact | Support contact form |
| `/terms` | Terms | Terms of service |
| `/privacy` | Privacy | Privacy policy |

### Protected User Routes

| Route | Page | Description |
|---|---|---|
| `/dashboard` | Dashboard | Overview with stats and recent activity |
| `/projects` | Projects | List, create, manage projects |
| `/projects/:id` | ProjectDetail | Project config, deploy, logs |
| `/connections` | Connections | Manage AWS & cloud provider accounts |
| `/deployments` | Deployments | Real-time deployment history |
| `/monitoring` | Monitoring | Infrastructure health monitoring |
| `/settings` | Settings | Profile and account settings |

### Admin Routes

| Route | Page | Description |
|---|---|---|
| `/admin` | AdminDashboard | Admin analytics overview |
| `/admin/users` | AdminUsers | User management |
| `/admin/projects` | AdminProjects | All projects oversight |
| `/admin/deployments` | AdminDeployments | All deployments management |
| `/admin/connections` | AdminConnections | All cloud connections |
| `/admin/reviews` | AdminReviews | Review moderation |
| `/admin/messages` | AdminMessages | Support messages |

### SEO Landing Pages

| Route | Target Keyword |
|---|---|
| `/deploy-react-app` | Deploy React app to cloud |
| `/deploy-nodejs-api` | Deploy Node.js API automatically |
| `/deploy-python-api` | Deploy Python API to cloud |
| `/deploy-fullstack-app` | Deploy full stack application |
| `/deploy-docker-app` | Deploy Docker container to cloud |
| `/deploy-to-aws` | AWS deployment automation |
| `/deploy-to-azure` | Azure deployment platform |
| `/deploy-to-gcp` | Google Cloud deployment |
| `/automated-cloud-deployment` | Automated cloud deployment |
| `/github-auto-deploy` | GitHub auto deploy CI/CD |
| `/multi-cloud-deployment` | Multi-cloud deployment platform |
| `/ai-deployment-platform` | AI-powered deployment |

---

## 🔐 Authentication & Authorization

### Authentication Flow

1. User signs up with email/password via Supabase Auth
2. Email verification required (auto-confirm disabled)
3. Google OAuth available as alternative
4. JWT tokens managed automatically by Supabase client
5. `useAuth()` hook provides user state across the app

### Role-Based Access Control

```
┌──────────────┐
│  user_roles  │
│──────────────│
│ user_id (FK) │ → references auth.users
│ role (enum)  │ → 'admin' | 'moderator' | 'user'
└──────────────┘
```

- **User** — Access to dashboard, projects, deployments, settings
- **Moderator** — User permissions + review moderation
- **Admin** — Full access including admin panel, user management

### Route Protection

- `PublicRoute` — Redirects authenticated users to dashboard/admin
- `UserRoute` — Requires auth, redirects admins to admin panel
- `ProtectedRoute` — Requires authentication

### Row Level Security (RLS)

All database tables use RLS policies enforced at the PostgreSQL level. The `has_role()` security definer function checks admin access without recursive RLS issues.

---

## ☁️ AWS Integration

### Supported Infrastructure

| Resource | Configuration | Free Tier |
|---|---|---|
| **EC2** | t3.micro, Amazon Linux 2023 | 750 hrs/month |
| **VPC** | Custom VPC with public/private subnets | Free |
| **Security Groups** | Auto-configured ingress rules | Free |
| **Internet Gateway** | Attached to VPC | Free |
| **RDS** (optional) | db.t3.micro, 20GB storage | 750 hrs/month |

### Security Group Rules (Auto-configured)

| Type | Port | Source | Purpose |
|---|---|---|---|
| HTTP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | 443 | 0.0.0.0/0 | Secure web traffic |
| SSH | 22 | 0.0.0.0/0 | Instance access |
| Custom | 3000-9000 | 0.0.0.0/0 | Application ports |

### User Data Boot Script

The EC2 instance runs a boot script that:
1. Updates OS packages
2. Installs Docker and Git
3. Clones the GitHub repository
4. Builds a Docker image
5. Runs the container on port 80
6. Falls back to Nginx if Docker fails
7. Configures iptables and ufw firewall

---

## ⚡ Edge Functions

### `deploy-project`

Handles project analysis and cloud PaaS deployments.

**Actions:**
- `quick-analyze` — Detect project type from GitHub URL
- `analyze` — Full project analysis (framework, build commands, output dir)
- `deploy` — Deploy to Vercel/Render via cloud connection tokens

### `aws-deploy`

Handles AWS infrastructure provisioning and management.

**Actions:**
- `provision` — Create VPC, subnets, security groups, launch EC2
- `diagnose-instance` — Check and fix networking issues
- `heal` — Auto-repair failed deployments
- `stop` / `start` — Instance lifecycle management
- `destroy` — Tear down all infrastructure

---

## 🔍 SEO System

### Implementation

- **SEOHead component** — Dynamically injects `<title>`, `<meta>`, Open Graph, Twitter Card, and JSON-LD structured data
- **SEOLandingPage template** — Reusable page with hero, features grid, code snippets, FAQ schema
- **Lazy loading** — All SEO pages are code-split for performance

### Structured Data Types

- `SoftwareApplication` — Main app schema on homepage
- `Organization` — Company information
- `FAQPage` — FAQ sections on each landing page
- `TechArticle` — Technical content pages

### Technical SEO

- `robots.txt` — Configured for crawler access
- `sitemap.xml` — All pages with priority scoring
- Canonical tags on every page
- Open Graph & Twitter Card meta tags
- Semantic HTML with single H1 per page

---

## 👨‍💼 Admin Panel

The admin panel (`/admin/*`) provides full platform management:

- **Dashboard** — Analytics charts, user/project/deployment counts
- **Users** — View all users, manage roles
- **Projects** — Overview of all user projects
- **Deployments** — Monitor all deployments across users
- **Connections** — View AWS and cloud provider connections
- **Reviews** — Moderate public feedback
- **Messages** — Read and respond to support messages

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase project (or Lovable Cloud)

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd cloudsnap-studio

# Install dependencies
npm install

# Start development server
npm run dev
```

### Running Tests

```bash
npm test
```

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |

These are auto-configured when using Lovable Cloud.

---

## 📦 Deployment

### Vercel (Recommended)

The project includes `vercel.json` with SPA rewrite rules:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/" }
  ]
}
```

### Lovable

Click **Share → Publish** in the Lovable editor.

---

## 📄 License

This project is proprietary software for Cloudsnap Studio.

---

Built with ❤️ using React, Supabase, and AWS
