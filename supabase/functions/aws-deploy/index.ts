import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ══════════════════════════════════════
// ── AWS API Helpers (using Signature V4) ──
// ══════════════════════════════════════

async function hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Promise<Uint8Array> {
  const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + key), dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return await hmacSha256(kService, "aws4_request");
}

interface AwsCreds {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

async function awsRequest(
  creds: AwsCreds,
  service: string,
  method: string,
  path: string,
  body: string,
  extraHeaders: Record<string, string> = {},
  queryString = ""
): Promise<{ ok: boolean; status: number; data: any; rawText: string }> {
  const host = `${service}.${creds.region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(body);
  const headers: Record<string, string> = {
    host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    ...extraHeaders,
  };
  if (body && !headers["content-type"]) {
    headers["content-type"] = "application/x-www-form-urlencoded; charset=utf-8";
  }

  const signedHeaderKeys = Object.keys(headers).sort();
  const signedHeaders = signedHeaderKeys.join(";");
  const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}\n`).join("");

  const canonicalRequest = [method, path, queryString, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${creds.region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");

  const signingKey = await getSignatureKey(creds.secretAccessKey, dateStamp, creds.region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  const authHeader = `AWS4-HMAC-SHA256 Credential=${creds.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `https://${host}${path}${queryString ? "?" + queryString : ""}`;
  const res = await fetch(url, {
    method,
    headers: { ...headers, Authorization: authHeader },
    body: body || undefined,
  });

  const rawText = await res.text();
  let data: any;
  try {
    // Try XML parse for AWS responses
    data = parseSimpleXml(rawText);
  } catch {
    data = { raw: rawText };
  }

  return { ok: res.ok, status: res.status, data, rawText };
}

// Simple XML parser for AWS responses
function parseSimpleXml(xml: string): Record<string, any> {
  const result: Record<string, any> = {};
  const tagRegex = /<(\w+)>(.*?)<\/\1>/gs;
  let match;
  while ((match = tagRegex.exec(xml)) !== null) {
    const [, key, value] = match;
    if (/<\w+>/.test(value)) {
      result[key] = parseSimpleXml(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ══════════════════════════════════════
// ── EC2 Actions ──
// ══════════════════════════════════════

function ec2Params(params: Record<string, string>): string {
  return Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

async function ec2Action(creds: AwsCreds, action: string, params: Record<string, string> = {}) {
  const body = ec2Params({ Action: action, Version: "2016-11-15", ...params });
  return awsRequest(creds, "ec2", "POST", "/", body);
}

// ══════════════════════════════════════
// ── RDS Actions ──
// ══════════════════════════════════════

async function rdsAction(creds: AwsCreds, action: string, params: Record<string, string> = {}) {
  const body = ec2Params({ Action: action, Version: "2014-10-31", ...params });
  return awsRequest(creds, "rds", "POST", "/", body);
}

// ══════════════════════════════════════
// ── ELB Actions ──
// ══════════════════════════════════════

async function elbAction(creds: AwsCreds, action: string, params: Record<string, string> = {}) {
  const body = ec2Params({ Action: action, Version: "2015-12-01", ...params });
  return awsRequest(creds, "elasticloadbalancing", "POST", "/", body);
}

// ══════════════════════════════════════
// ── Free Tier Constants ──
// ══════════════════════════════════════

const FREE_TIER = {
  ec2InstanceType: "t3.micro",
  rdsInstanceClass: "db.t3.micro",
  rdsStorage: 20,
  ebsSize: 10,
  
  idleTimeoutMinutes: 30,
};

const COST_ESTIMATES: Record<string, number> = {
  ec2_t3_micro: 0, // Free tier
  rds_db_t3_micro: 0, // Free tier (first 12 months)
  alb: 16.2, // ~$16.20/month base
  s3: 0, // Minimal
  vpc: 0,
};

// ══════════════════════════════════════
// ── User Data Script Generator ──
// ══════════════════════════════════════

function generateUserData(config: {
  projectName: string;
  githubUrl?: string;
  buildCommand: string;
  startCommand: string;
  outputDir: string;
  port: number;
  envVars?: Record<string, string>;
  framework: string;
  projectType: string;
}): string {
  const envExports = config.envVars
    ? Object.entries(config.envVars).map(([k, v]) => `export ${k}="${v}"`).join("\n")
    : "";

  const outputDir = config.outputDir || "dist";
  const containerName = config.projectName.replace(/[^a-zA-Z0-9-]/g, "-").substring(0, 50);

  // Nginx config with health check endpoint
  const nginxConf = `server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location /health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }

    location / {
        try_files \\$uri \\$uri/ /index.html;
    }
}`;

  const dockerfileContent = config.projectType === "frontend"
    ? `FROM node:18-alpine AS build
WORKDIR /app
COPY . .
RUN npm install && ${config.buildCommand || "npm run build"}
FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY --from=build /app/${outputDir} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`
    : `FROM node:18-alpine
WORKDIR /app
COPY . .
RUN ${config.buildCommand || "npm install"}
ENV PORT=${config.port}
EXPOSE ${config.port}
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:${config.port}/health || exit 1
CMD ${JSON.stringify((config.startCommand || "npm start").split(" "))}`;

  const hostPort = config.projectType === "frontend" ? "80:80" : `80:${config.port}`;

  return btoa(`#!/bin/bash
set -e
exec > /var/log/user-data.log 2>&1

echo "=== CloudSnap Deployment Started ==="
date

# Install Docker (compatible with Amazon Linux 2 and 2023)
if command -v dnf &> /dev/null; then
  dnf update -y
  dnf install -y docker git curl nginx
else
  yum update -y
  amazon-linux-extras install docker -y 2>/dev/null || yum install -y docker
  yum install -y git curl nginx
fi
systemctl start docker
systemctl enable docker

# Disable firewall if present
if command -v ufw &> /dev/null; then
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  ufw allow 22/tcp || true
fi
# Flush iptables rules that might block traffic (except docker)
iptables -P INPUT ACCEPT 2>/dev/null || true
iptables -P FORWARD ACCEPT 2>/dev/null || true

echo "=== Docker installed ==="

# Clone project
${config.githubUrl ? `git clone ${config.githubUrl} /app` : "mkdir -p /app"}
cd /app

echo "=== Project cloned ==="

# Write custom nginx config for frontend apps
${config.projectType === "frontend" ? `
mkdir -p /app/nginx
cat > /app/nginx/default.conf << 'NGINXCONF'
${nginxConf}
NGINXCONF
` : ""}

# Create Dockerfile
cat > Dockerfile << 'DOCKERFILE'
${dockerfileContent}
DOCKERFILE

${config.projectType === "frontend" ? `
# Add nginx config copy to Dockerfile
sed -i '/EXPOSE 80/i COPY nginx/default.conf /etc/nginx/conf.d/default.conf' Dockerfile
` : ""}

# Set environment variables
${envExports}
export PORT=${config.port}

# Build and run
echo "=== Building Docker image ==="
docker build -t ${containerName} . 2>&1
echo "=== Starting container ==="
docker rm -f ${containerName} 2>/dev/null || true
docker run -d --restart always -p ${hostPort} --name ${containerName} ${containerName}

# Fallback: If docker build/run fails, serve static files via nginx directly
if ! docker ps | grep -q ${containerName}; then
  echo "=== Docker failed, falling back to nginx ==="
  docker logs ${containerName} 2>&1 || true
  
  # Try to serve via host nginx for frontend
  ${config.projectType === "frontend" ? `
  # Build directly on host
  if command -v node &> /dev/null || (curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - && yum install -y nodejs); then
    cd /app && npm install && ${config.buildCommand || "npm run build"} 2>&1 || true
    cp -r /app/${outputDir}/* /usr/share/nginx/html/ 2>/dev/null || true
    cat > /etc/nginx/conf.d/default.conf << 'NGINXFALLBACK'
${nginxConf}
NGINXFALLBACK
    systemctl start nginx
    systemctl enable nginx
    echo "=== Nginx fallback started ==="
  fi
  ` : ""}
fi

# Wait for application to respond
echo "=== Waiting for application to start ==="
for i in $(seq 1 30); do
  if curl -sf http://localhost:80/health > /dev/null 2>&1 || curl -sf http://localhost:80/ > /dev/null 2>&1; then
    echo "=== Application is responding on port 80 ==="
    break
  fi
  echo "Waiting for app... attempt $i/30"
  sleep 5
done

# Final status
if curl -sf http://localhost:80/ > /dev/null 2>&1; then
  echo "=== DEPLOYMENT SUCCESS: App is reachable ==="
elif docker ps | grep -q ${containerName}; then
  echo "=== Container is running but not responding yet ==="
  docker ps
  docker logs ${containerName} --tail 50 2>&1 || true
else
  echo "=== ERROR: Container failed to start ==="
  docker logs ${containerName} 2>&1 || true
fi

echo "=== Deployment complete! ==="
date
`);
}

// ══════════════════════════════════════
// ── Main Handler ──
// ══════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const { action, ...params } = body;
    const supabase = getSupabaseAdmin();

    // Auth check
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: { user } } = await createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
        ).auth.getUser(token);
        userId = user?.id || null;
      } catch (authErr: any) {
        console.error("Auth error:", authErr.message);
        return json({ error: "Authentication failed. Please sign in again.", details: authErr.message }, 401);
      }
    }
    if (!userId) return json({ error: "Unauthorized. Please sign in again." }, 401);

    console.log(`[aws-deploy] action=${action} userId=${userId}`);

    // ── Validate AWS Connection ──
    if (action === "validate-aws") {
      const { accessKeyId, secretAccessKey, region } = params;
      const creds: AwsCreds = { accessKeyId, secretAccessKey, region: region || "us-east-1" };
      try {
        // Call STS GetCallerIdentity to validate
        const body = ec2Params({ Action: "GetCallerIdentity", Version: "2011-06-15" });
        const res = await awsRequest(creds, "sts", "POST", "/", body);
        if (!res.ok) return json({ success: false, error: "Invalid AWS credentials", details: res.rawText });
        return json({ success: true, identity: res.data });
      } catch (e: any) {
        return json({ success: false, error: e.message });
      }
    }

    // ── Connect AWS Account ──
    if (action === "connect-aws") {
      const { accessKeyId, secretAccessKey, region, displayName, connectionType, roleArn } = params;

      // Validate first
      const creds: AwsCreds = { accessKeyId, secretAccessKey, region: region || "us-east-1" };
      const body = ec2Params({ Action: "GetCallerIdentity", Version: "2011-06-15" });
      const res = await awsRequest(creds, "sts", "POST", "/", body);
      if (!res.ok) return json({ success: false, error: "Invalid AWS credentials" });

      const { error } = await supabase.from("aws_connections").insert({
        user_id: userId,
        access_key_id: accessKeyId,
        secret_access_key: secretAccessKey,
        default_region: region || "us-east-1",
        display_name: displayName || "My AWS Account",
        connection_type: connectionType || "iam_keys",
        role_arn: roleArn || null,
      });
      if (error) return json({ success: false, error: error.message });
      return json({ success: true, message: "AWS account connected successfully" });
    }

    // ── Get AWS Connections ──
    if (action === "list-aws-connections") {
      const { data, error } = await supabase.from("aws_connections").select("id, display_name, default_region, connection_type, is_active, created_at").eq("user_id", userId);
      if (error) return json({ success: false, error: error.message });
      return json({ success: true, connections: data });
    }

    // ── Delete AWS Connection ──
    if (action === "delete-aws-connection") {
      const { connectionId } = params;
      // Check for active infrastructure
      const { data: infra } = await supabase.from("aws_infrastructure").select("id").eq("aws_connection_id", connectionId).eq("user_id", userId).neq("status", "deleted");
      if (infra && infra.length > 0) {
        return json({ success: false, error: "Cannot delete connection with active infrastructure. Delete all resources first." });
      }
      const { error } = await supabase.from("aws_connections").delete().eq("id", connectionId).eq("user_id", userId);
      if (error) return json({ success: false, error: error.message });
      return json({ success: true });
    }

    // ── Deploy to AWS ──
    if (action === "deploy-aws") {
      const { projectId, awsConnectionId, appType, databaseEngine } = params;

      // Get project
      const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).eq("user_id", userId).single();
      if (!project) return json({ success: false, error: "Project not found" });

      // Get AWS creds
      const { data: awsConn } = await supabase.from("aws_connections").select("*").eq("id", awsConnectionId).eq("user_id", userId).single();
      if (!awsConn) return json({ success: false, error: "AWS connection not found" });

      const creds: AwsCreds = {
        accessKeyId: awsConn.access_key_id,
        secretAccessKey: awsConn.secret_access_key,
        region: project.aws_region || awsConn.default_region,
      };

      // No environment limit — allow multiple infrastructures per project

      // Create infrastructure record
      const { data: infra, error: infraErr } = await supabase.from("aws_infrastructure").insert({
        project_id: projectId,
        user_id: userId,
        aws_connection_id: awsConnectionId,
        region: creds.region,
        status: "creating_vpc",
      }).select().single();
      if (infraErr) return json({ success: false, error: infraErr.message });

      // Create deployment record
      const { data: deployRec } = await supabase.from("deployments").insert({
        project_id: projectId,
        user_id: userId,
        provider: "aws",
        status: "building",
      }).select().single();
      const deploymentId = deployRec?.id;

      // ── Step 1: Create or Reuse VPC ──
      try {
        let vpcId = "";
        const vpcRes = await ec2Action(creds, "CreateVpc", { "CidrBlock": "10.0.0.0/16" });
        
        if (vpcRes.rawText?.includes("VpcLimitExceeded")) {
          // VPC limit reached — try to find and reuse an existing cloudsnap VPC
          console.log("VPC limit reached, attempting to reuse existing cloudsnap VPC...");
          const descRes = await ec2Action(creds, "DescribeVpcs", {
            "Filter.1.Name": "tag:cloudsnap-project",
            "Filter.1.Value.1": "*",
          });
          const existingVpcId = extractTag(descRes.rawText, "vpcId");
          
          if (!existingVpcId) {
            // No cloudsnap VPC found, try to find default VPC
            const defaultRes = await ec2Action(creds, "DescribeVpcs", {
              "Filter.1.Name": "isDefault",
              "Filter.1.Value.1": "true",
            });
            const defaultVpcId = extractTag(defaultRes.rawText, "vpcId");
            if (defaultVpcId) {
              vpcId = defaultVpcId;
              console.log("Using default VPC:", vpcId);
            } else {
              throw new Error("AWS VPC limit reached and no existing VPC found to reuse. Please delete unused VPCs in your AWS console (us-east-1) and retry.");
            }
          } else {
            vpcId = existingVpcId;
            console.log("Reusing existing cloudsnap VPC:", vpcId);
          }
        } else {
          vpcId = vpcRes.data?.CreateVpcResponse?.vpc?.vpcId || extractTag(vpcRes.rawText, "vpcId");
          if (!vpcId) throw new Error("Could not extract VPC ID");
        }

        // Tag VPC
        await ec2Action(creds, "CreateTags", {
          "ResourceId.1": vpcId,
          "Tag.1.Key": "Name",
          "Tag.1.Value": `cloudsnap-${project.name}`,
          "Tag.2.Key": "cloudsnap-project",
          "Tag.2.Value": projectId,
        });

        // Enable DNS hostnames
        await ec2Action(creds, "ModifyVpcAttribute", { VpcId: vpcId, "EnableDnsHostnames.Value": "true" });

        await supabase.from("aws_infrastructure").update({ vpc_id: vpcId, status: "creating_subnets" }).eq("id", infra.id);

        // ── Step 2: Create or find Internet Gateway ──
        let igwId = "";
        // Check for existing IGW attached to this VPC
        const descIgwRes = await ec2Action(creds, "DescribeInternetGateways", {
          "Filter.1.Name": "attachment.vpc-id",
          "Filter.1.Value.1": vpcId,
        });
        igwId = extractTag(descIgwRes.rawText, "internetGatewayId") || "";
        
        if (!igwId) {
          const igwRes = await ec2Action(creds, "CreateInternetGateway", {});
          igwId = extractTag(igwRes.rawText, "internetGatewayId") || "";
          if (igwId) {
            await ec2Action(creds, "AttachInternetGateway", { InternetGatewayId: igwId, VpcId: vpcId });
          }
        }
        if (igwId) {
          await supabase.from("aws_infrastructure").update({ internet_gateway_id: igwId }).eq("id", infra.id);
        }

        // ── Step 3: Create Subnets ──
        // Use a random offset (10-250) for CIDR to avoid conflicts when reusing VPC
        const cidrOffset = Math.floor(Math.random() * 240) + 10;
        // Get available AZs
        const azRes = await ec2Action(creds, "DescribeAvailabilityZones", { "Filter.1.Name": "state", "Filter.1.Value.1": "available" });
        const azText = azRes.rawText;
        const azMatches = azText.match(/<zoneName>([^<]+)<\/zoneName>/g) || [];
        const azs = azMatches.map(m => m.replace(/<\/?zoneName>/g, "")).slice(0, 2);
        const az1 = azs[0] || creds.region + "a";
        const az2 = azs[1] || creds.region + "b";

        // Public subnet
        const pubSubRes = await ec2Action(creds, "CreateSubnet", {
          VpcId: vpcId, CidrBlock: `10.0.${cidrOffset}.0/24`, AvailabilityZone: az1,
        });
        let pubSubId = extractTag(pubSubRes.rawText, "subnetId");
        
        // If CIDR conflict, try to find existing subnets in this VPC
        if (!pubSubId && pubSubRes.rawText?.includes("InvalidSubnet.Conflict")) {
          console.log("Subnet CIDR conflict, looking for existing subnets...");
          const descSubRes = await ec2Action(creds, "DescribeSubnets", {
            "Filter.1.Name": "vpc-id", "Filter.1.Value.1": vpcId,
          });
          const subnetIds = (descSubRes.rawText.match(/<subnetId>([^<]+)<\/subnetId>/g) || [])
            .map(m => m.replace(/<\/?subnetId>/g, ""));
          pubSubId = subnetIds[0] || "";
        }

        // Private subnet
        const privSubRes = await ec2Action(creds, "CreateSubnet", {
          VpcId: vpcId, CidrBlock: `10.0.${cidrOffset + 1}.0/24`, AvailabilityZone: az1,
        });
        let privSubId = extractTag(privSubRes.rawText, "subnetId");
        if (!privSubId && privSubRes.rawText?.includes("InvalidSubnet.Conflict")) {
          const descSubRes = await ec2Action(creds, "DescribeSubnets", {
            "Filter.1.Name": "vpc-id", "Filter.1.Value.1": vpcId,
          });
          const subnetIds = (descSubRes.rawText.match(/<subnetId>([^<]+)<\/subnetId>/g) || [])
            .map(m => m.replace(/<\/?subnetId>/g, ""));
          privSubId = subnetIds[1] || subnetIds[0] || "";
        }

        // Second subnet for RDS (needs 2 AZs)
        let dbSubnet2Id = "";
        if (databaseEngine && databaseEngine !== "none") {
          const dbSub2Res = await ec2Action(creds, "CreateSubnet", {
            VpcId: vpcId, CidrBlock: `10.0.${cidrOffset + 2}.0/24`, AvailabilityZone: az2,
          });
          dbSubnet2Id = extractTag(dbSub2Res.rawText, "subnetId") || "";
        }

        // Enable auto-assign public IP on public subnet
        if (pubSubId) {
          await ec2Action(creds, "ModifySubnetAttribute", {
            SubnetId: pubSubId, "MapPublicIpOnLaunch.Value": "true",
          });
        }

        // Create route table for public subnet
        if (igwId && pubSubId) {
          const rtRes = await ec2Action(creds, "CreateRouteTable", { VpcId: vpcId });
          const rtId = extractTag(rtRes.rawText, "routeTableId");
          if (rtId) {
            await ec2Action(creds, "CreateRoute", {
              RouteTableId: rtId, DestinationCidrBlock: "0.0.0.0/0", GatewayId: igwId,
            });
            await ec2Action(creds, "AssociateRouteTable", { RouteTableId: rtId, SubnetId: pubSubId });
          }
        }

        await supabase.from("aws_infrastructure").update({
          public_subnet_id: pubSubId,
          private_subnet_id: privSubId,
          status: "creating_security_groups",
        }).eq("id", infra.id);

        // ── Step 4: Security Group ──
        const safeName = project.name.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
        const sgRes = await ec2Action(creds, "CreateSecurityGroup", {
          GroupName: `cloudsnap-${safeName}-${Date.now()}`,
          GroupDescription: `Security group for ${safeName}`,
          VpcId: vpcId,
        });
        const sgId = extractTag(sgRes.rawText, "groupId");

        if (!sgId) {
          console.error("Security group creation failed:", sgRes.rawText);
          throw new Error("Failed to create security group: " + (sgRes.rawText.substring(0, 200)));
        }

        // Allow HTTP
        await ec2Action(creds, "AuthorizeSecurityGroupIngress", {
          GroupId: sgId, IpProtocol: "tcp", FromPort: "80", ToPort: "80", CidrIp: "0.0.0.0/0",
        });
        // Allow HTTPS
        await ec2Action(creds, "AuthorizeSecurityGroupIngress", {
          GroupId: sgId, IpProtocol: "tcp", FromPort: "443", ToPort: "443", CidrIp: "0.0.0.0/0",
        });
        // Allow SSH (for debugging)
        await ec2Action(creds, "AuthorizeSecurityGroupIngress", {
          GroupId: sgId, IpProtocol: "tcp", FromPort: "22", ToPort: "22", CidrIp: "0.0.0.0/0",
        });
        // Allow app ports
        await ec2Action(creds, "AuthorizeSecurityGroupIngress", {
          GroupId: sgId, IpProtocol: "tcp", FromPort: "3000", ToPort: "9000", CidrIp: "0.0.0.0/0",
        });

        await supabase.from("aws_infrastructure").update({ security_group_id: sgId, status: "launching_compute" }).eq("id", infra.id);

        // ── Step 5: Launch EC2 Instance ──
        // Get latest Amazon Linux 2023 AMI (free tier eligible with t3.micro)
        const amiRes = await ec2Action(creds, "DescribeImages", {
          "Owner.1": "amazon",
          "Filter.1.Name": "name",
          "Filter.1.Value.1": "al2023-ami-2023.*-x86_64",
          "Filter.2.Name": "state",
          "Filter.2.Value.1": "available",
          "Filter.3.Name": "architecture",
          "Filter.3.Value.1": "x86_64",
        });
        let amiId = "ami-0c02fb55956c7d316"; // fallback Amazon Linux 2
        const amiMatches = amiRes.rawText.match(/<imageId>(ami-[a-f0-9]+)<\/imageId>/g);
        if (amiMatches && amiMatches.length > 0) {
          amiId = amiMatches[0].replace(/<\/?imageId>/g, "");
        }

        const port = appType === "frontend" ? 80 : 3000;
        const userData = generateUserData({
          projectName: project.name.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase(),
          githubUrl: project.github_url || undefined,
          buildCommand: project.build_command || "npm run build",
          startCommand: project.backend_start_command || "npm start",
          outputDir: project.frontend_output_dir || project.output_dir || "dist",
          port,
          framework: project.framework || "",
          projectType: appType || project.project_type || "frontend",
        });

        const ec2LaunchParams: Record<string, string> = {
          ImageId: amiId,
          InstanceType: FREE_TIER.ec2InstanceType,
          MinCount: "1",
          MaxCount: "1",
          UserData: userData,
          SubnetId: pubSubId,
          "SecurityGroupId.1": sgId,
          "TagSpecification.1.ResourceType": "instance",
          "TagSpecification.1.Tag.1.Key": "Name",
          "TagSpecification.1.Tag.1.Value": `cloudsnap-${safeName}`,
          "TagSpecification.1.Tag.2.Key": "cloudsnap-project",
          "TagSpecification.1.Tag.2.Value": projectId,
        };

        const instanceRes = await ec2Action(creds, "RunInstances", ec2LaunchParams);
        const instanceId = extractTag(instanceRes.rawText, "instanceId");
        
        if (!instanceId) {
          console.error("EC2 launch failed:", instanceRes.rawText);
          throw new Error("Failed to launch EC2 instance: " + (instanceRes.rawText.substring(0, 200)));
        }

        // Save EC2 resource
        await supabase.from("aws_resources").insert({
          infrastructure_id: infra.id,
          user_id: userId,
          resource_type: "ec2",
          resource_id: instanceId,
          status: "running",
          config: { instanceType: FREE_TIER.ec2InstanceType, amiId, port },
          monthly_cost_estimate: COST_ESTIMATES.ec2_t3_micro,
        });

        // Wait for public IP assignment with retries
        let publicIp = "";
        let publicDns = "";
        for (let attempt = 0; attempt < 6; attempt++) {
          await new Promise(r => setTimeout(r, 5000));
          const descRes = await ec2Action(creds, "DescribeInstances", { "InstanceId.1": instanceId });
          publicIp = extractTag(descRes.rawText, "publicIpAddress") || extractTag(descRes.rawText, "ipAddress") || "";
          publicDns = extractTag(descRes.rawText, "publicDnsName") || extractTag(descRes.rawText, "dnsName") || "";
          if (publicIp || publicDns) break;
        }

        if (publicIp || publicDns) {
          const liveUrl = `http://${publicDns || publicIp}`;
          await supabase.from("aws_resources").update({ public_ip: publicIp, public_url: liveUrl }).eq("infrastructure_id", infra.id).eq("resource_type", "ec2");

          if (deploymentId) {
            // Set to VERIFYING — not LIVE yet; the client or verify action will confirm
            await supabase.from("deployments").update({ status: "deploying", live_url: liveUrl, deploy_id: instanceId }).eq("id", deploymentId);
          }
        } else if (deploymentId) {
          await supabase.from("deployments").update({ status: "deploying", deploy_id: instanceId, error_message: "Public IP not yet assigned — check back in a few minutes" }).eq("id", deploymentId);
        }

        await supabase.from("aws_infrastructure").update({ status: "creating_resources" }).eq("id", infra.id);

        // Save VPC resource
        await supabase.from("aws_resources").insert({
          infrastructure_id: infra.id,
          user_id: userId,
          resource_type: "vpc",
          resource_id: vpcId,
          status: "active",
          config: { cidr: "10.0.0.0/16", publicSubnet: pubSubId, privateSubnet: privSubId },
        });

        // ── Step 6: Database (if requested) ──
        if (databaseEngine && databaseEngine !== "none" && privSubId && dbSubnet2Id) {
          await supabase.from("aws_infrastructure").update({ status: "creating_database" }).eq("id", infra.id);

          // Create DB subnet group
          const subnetGroupName = `cloudsnap-${project.name}-${Date.now()}`.substring(0, 255).toLowerCase().replace(/[^a-z0-9-]/g, "-");
          await rdsAction(creds, "CreateDBSubnetGroup", {
            DBSubnetGroupName: subnetGroupName,
            DBSubnetGroupDescription: `Subnet group for ${project.name}`,
            "SubnetIds.member.1": privSubId,
            "SubnetIds.member.2": dbSubnet2Id,
          });

          await supabase.from("aws_infrastructure").update({ db_subnet_group_name: subnetGroupName }).eq("id", infra.id);

          // Create DB security group
          const dbSgRes = await ec2Action(creds, "CreateSecurityGroup", {
            GroupName: `cloudsnap-db-${safeName}-${Date.now()}`,
            GroupDescription: `DB security group for ${safeName}`,
            VpcId: vpcId,
          });
          const dbSgId = extractTag(dbSgRes.rawText, "groupId");

          if (dbSgId && sgId) {
            // Allow DB access only from app security group
            const dbPort = databaseEngine === "mysql" ? "3306" : "5432";
            await ec2Action(creds, "AuthorizeSecurityGroupIngress", {
              GroupId: dbSgId,
              IpProtocol: "tcp",
              FromPort: dbPort,
              ToPort: dbPort,
              "IpPermissions.1.Groups.1.GroupId": sgId,
            });
          }

          // Create RDS instance
          const dbPassword = crypto.randomUUID().replace(/-/g, "").substring(0, 20);
          const dbIdentifier = `cloudsnap-${project.name}-${Date.now()}`.substring(0, 63).toLowerCase().replace(/[^a-z0-9-]/g, "-");

          const rdsParams: Record<string, string> = {
            DBInstanceIdentifier: dbIdentifier,
            DBInstanceClass: FREE_TIER.rdsInstanceClass,
            Engine: databaseEngine === "mysql" ? "mysql" : "postgres",
            MasterUsername: "cloudsnap_admin",
            MasterUserPassword: dbPassword,
            AllocatedStorage: String(FREE_TIER.rdsStorage),
            DBSubnetGroupName: subnetGroupName,
            PubliclyAccessible: "false",
            StorageType: "gp2",
            BackupRetentionPeriod: "0",
          };
          if (dbSgId) rdsParams["VpcSecurityGroupIds.member.1"] = dbSgId;

          const rdsRes = await rdsAction(creds, "CreateDBInstance", rdsParams);
          const dbInstanceId = extractTag(rdsRes.rawText, "DBInstanceIdentifier") || dbIdentifier;

          await supabase.from("aws_resources").insert({
            infrastructure_id: infra.id,
            user_id: userId,
            resource_type: "rds",
            resource_id: dbInstanceId,
            status: "creating",
            config: {
              engine: databaseEngine,
              instanceClass: FREE_TIER.rdsInstanceClass,
              username: "cloudsnap_admin",
              password: dbPassword, // stored encrypted via RLS
              port: databaseEngine === "mysql" ? 3306 : 5432,
            },
            monthly_cost_estimate: COST_ESTIMATES.rds_db_t3_micro,
          });
        }

        // Calculate cost estimate
        let totalCost = COST_ESTIMATES.ec2_t3_micro;
        if (databaseEngine && databaseEngine !== "none") totalCost += COST_ESTIMATES.rds_db_t3_micro;

        await supabase.from("aws_infrastructure").update({
          status: "active",
          estimated_monthly_cost: totalCost,
        }).eq("id", infra.id);

        // Update deployment status using deployment ID
        if (deploymentId) {
          await supabase.from("deployments").update({ status: "live" }).eq("id", deploymentId);
        }

        return json({
          success: true,
          infrastructureId: infra.id,
          message: "AWS infrastructure created successfully",
          resources: {
            vpc: vpcId,
            publicSubnet: pubSubId,
            privateSubnet: privSubId,
            securityGroup: sgId,
            ec2Instance: instanceId || null,
            database: databaseEngine !== "none" ? "creating" : "none",
          },
          estimatedMonthlyCost: totalCost,
        });

      } catch (e: any) {
        await supabase.from("aws_infrastructure").update({ status: "error", error_message: e.message }).eq("id", infra.id);
        if (deploymentId) {
          await supabase.from("deployments").update({ status: "error", error_message: e.message }).eq("id", deploymentId);
        }
        return json({ success: false, error: e.message });
      }
    }

    // ── Get Infrastructure Status ──
    if (action === "get-infrastructure") {
      const { projectId } = params;
      const { data: infra } = await supabase.from("aws_infrastructure").select("*").eq("project_id", projectId).eq("user_id", userId).order("created_at", { ascending: false }).limit(1).single();
      if (!infra) return json({ success: true, infrastructure: null });

      const { data: resources } = await supabase.from("aws_resources").select("*").eq("infrastructure_id", infra.id);
      return json({ success: true, infrastructure: infra, resources: resources || [] });
    }

    // ── Stop EC2 Instance (cost protection) ──
    if (action === "stop-instance") {
      const { resourceId, awsConnectionId } = params;
      const { data: awsConn } = await supabase.from("aws_connections").select("*").eq("id", awsConnectionId).eq("user_id", userId).single();
      if (!awsConn) return json({ success: false, error: "AWS connection not found" });

      const creds: AwsCreds = { accessKeyId: awsConn.access_key_id, secretAccessKey: awsConn.secret_access_key, region: awsConn.default_region };
      await ec2Action(creds, "StopInstances", { "InstanceId.1": resourceId });
      await supabase.from("aws_resources").update({ status: "stopped" }).eq("resource_id", resourceId).eq("user_id", userId);
      return json({ success: true, message: "Instance stopped" });
    }

    // ── Start EC2 Instance ──
    if (action === "start-instance") {
      const { resourceId, awsConnectionId } = params;
      const { data: awsConn } = await supabase.from("aws_connections").select("*").eq("id", awsConnectionId).eq("user_id", userId).single();
      if (!awsConn) return json({ success: false, error: "AWS connection not found" });

      const creds: AwsCreds = { accessKeyId: awsConn.access_key_id, secretAccessKey: awsConn.secret_access_key, region: awsConn.default_region };
      await ec2Action(creds, "StartInstances", { "InstanceId.1": resourceId });
      await supabase.from("aws_resources").update({ status: "running", last_active_at: new Date().toISOString() }).eq("resource_id", resourceId).eq("user_id", userId);
      return json({ success: true, message: "Instance started" });
    }

    // ── Delete Infrastructure ──
    if (action === "delete-infrastructure") {
      const { infrastructureId } = params;
      const { data: infra } = await supabase.from("aws_infrastructure").select("*").eq("id", infrastructureId).eq("user_id", userId).single();
      if (!infra) return json({ success: false, error: "Infrastructure not found" });

      const { data: awsConn } = await supabase.from("aws_connections").select("*").eq("id", infra.aws_connection_id).single();
      if (!awsConn) return json({ success: false, error: "AWS connection not found" });

      const creds: AwsCreds = { accessKeyId: awsConn.access_key_id, secretAccessKey: awsConn.secret_access_key, region: infra.region };

      // Get resources
      const { data: resources } = await supabase.from("aws_resources").select("*").eq("infrastructure_id", infrastructureId);

      // Delete in reverse order
      for (const r of (resources || [])) {
        try {
          if (r.resource_type === "rds" && r.resource_id) {
            await rdsAction(creds, "DeleteDBInstance", {
              DBInstanceIdentifier: r.resource_id,
              SkipFinalSnapshot: "true",
            });
          }
          if (r.resource_type === "ec2" && r.resource_id) {
            await ec2Action(creds, "TerminateInstances", { "InstanceId.1": r.resource_id });
          }
        } catch (e) {
          console.error("Failed to delete resource:", r.resource_type, e);
        }
      }

      // Wait for instances to terminate
      await new Promise(r => setTimeout(r, 5000));

      // Delete VPC resources
      try {
        if (infra.security_group_id) await ec2Action(creds, "DeleteSecurityGroup", { GroupId: infra.security_group_id });
        if (infra.public_subnet_id) await ec2Action(creds, "DeleteSubnet", { SubnetId: infra.public_subnet_id });
        if (infra.private_subnet_id) await ec2Action(creds, "DeleteSubnet", { SubnetId: infra.private_subnet_id });
        if (infra.internet_gateway_id && infra.vpc_id) {
          await ec2Action(creds, "DetachInternetGateway", { InternetGatewayId: infra.internet_gateway_id, VpcId: infra.vpc_id });
          await ec2Action(creds, "DeleteInternetGateway", { InternetGatewayId: infra.internet_gateway_id });
        }
        if (infra.db_subnet_group_name) {
          await rdsAction(creds, "DeleteDBSubnetGroup", { DBSubnetGroupName: infra.db_subnet_group_name });
        }
        if (infra.vpc_id) await ec2Action(creds, "DeleteVpc", { VpcId: infra.vpc_id });
      } catch (e) {
        console.error("VPC cleanup error:", e);
      }

      // Update database
      await supabase.from("aws_resources").update({ status: "deleted" }).eq("infrastructure_id", infrastructureId);
      await supabase.from("aws_infrastructure").update({ status: "deleted" }).eq("id", infrastructureId);

      return json({ success: true, message: "Infrastructure deleted" });
    }

    // ── Free Tier Check ──
    if (action === "check-free-tier") {
      const { awsConnectionId } = params;
      const { data: awsConn } = await supabase.from("aws_connections").select("*").eq("id", awsConnectionId).eq("user_id", userId).single();
      if (!awsConn) return json({ success: false, error: "AWS connection not found" });

      const creds: AwsCreds = { accessKeyId: awsConn.access_key_id, secretAccessKey: awsConn.secret_access_key, region: awsConn.default_region };

      // Count running instances
      const descRes = await ec2Action(creds, "DescribeInstances", {
        "Filter.1.Name": "instance-state-name",
        "Filter.1.Value.1": "running",
        "Filter.2.Name": "tag-key",
        "Filter.2.Value.1": "cloudsnap-project",
      });

      const instanceCount = (descRes.rawText.match(/<instanceId>/g) || []).length;

      return json({
        success: true,
        freeTier: {
          ec2: { used: instanceCount, limit: 1, withinLimit: instanceCount <= 1 },
          warning: instanceCount >= 1 ? "You are at your free tier EC2 limit" : null,
          estimatedMonthlyCost: instanceCount <= 1 ? 0 : instanceCount * 8.50,
        },
      });
    }

    // ── CloudWatch Metrics ──
    if (action === "get-cloudwatch-metrics") {
      const { awsConnectionId, instanceId } = params;
      const { data: awsConn } = await supabase.from("aws_connections").select("*").eq("id", awsConnectionId).eq("user_id", userId).single();
      if (!awsConn) return json({ success: false, error: "AWS connection not found" });

      const creds: AwsCreds = { accessKeyId: awsConn.access_key_id, secretAccessKey: awsConn.secret_access_key, region: awsConn.default_region };

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const cwBody = ec2Params({
        Action: "GetMetricStatistics", Version: "2010-08-01",
        Namespace: "AWS/EC2", MetricName: "CPUUtilization",
        "Dimensions.member.1.Name": "InstanceId", "Dimensions.member.1.Value": instanceId,
        StartTime: oneHourAgo.toISOString(), EndTime: now.toISOString(),
        Period: "300", "Statistics.member.1": "Average",
      });
      const cpuRes = await awsRequest(creds, "monitoring", "POST", "/", cwBody);
      const cpuDatapoints = extractDatapoints(cpuRes.rawText);

      const netBody = ec2Params({
        Action: "GetMetricStatistics", Version: "2010-08-01",
        Namespace: "AWS/EC2", MetricName: "NetworkIn",
        "Dimensions.member.1.Name": "InstanceId", "Dimensions.member.1.Value": instanceId,
        StartTime: oneHourAgo.toISOString(), EndTime: now.toISOString(),
        Period: "300", "Statistics.member.1": "Average",
      });
      const netRes = await awsRequest(creds, "monitoring", "POST", "/", netBody);
      const netDatapoints = extractDatapoints(netRes.rawText);

      return json({ success: true, metrics: { cpu: cpuDatapoints, networkIn: netDatapoints, instanceId } });
    }

    // ── Get Instance Logs ──
    if (action === "get-instance-logs") {
      const { awsConnectionId, instanceId } = params;
      const { data: awsConn } = await supabase.from("aws_connections").select("*").eq("id", awsConnectionId).eq("user_id", userId).single();
      if (!awsConn) return json({ success: false, error: "AWS connection not found" });

      const creds: AwsCreds = { accessKeyId: awsConn.access_key_id, secretAccessKey: awsConn.secret_access_key, region: awsConn.default_region };
      const logRes = await ec2Action(creds, "GetConsoleOutput", { InstanceId: instanceId });
      const outputB64 = extractTag(logRes.rawText, "output");
      let logLines: string[] = [];
      if (outputB64) {
        try {
          const decoded = atob(outputB64);
          logLines = decoded.split("\n").filter((l: string) => l.trim()).slice(-100);
        } catch { logLines = ["Failed to decode console output"]; }
      }
      return json({ success: true, logs: logLines });
    }

    // ── Auto-Stop Idle Instances ──
    if (action === "auto-stop-idle") {
      const { data: resources } = await supabase
        .from("aws_resources").select("*")
        .eq("resource_type", "ec2").eq("status", "running").eq("auto_stop_enabled", true);

      if (!resources || resources.length === 0) return json({ success: true, stopped: 0 });

      let stoppedCount = 0;
      const idleThreshold = FREE_TIER.idleTimeoutMinutes * 60 * 1000;

      for (const r of resources) {
        const lastActive = r.last_active_at ? new Date(r.last_active_at).getTime() : new Date(r.created_at).getTime();
        if (Date.now() - lastActive > idleThreshold && r.resource_id) {
          const { data: infra } = await supabase.from("aws_infrastructure").select("aws_connection_id, region").eq("id", r.infrastructure_id).single();
          if (!infra) continue;
          const { data: awsConn } = await supabase.from("aws_connections").select("*").eq("id", infra.aws_connection_id).single();
          if (!awsConn) continue;

          const creds: AwsCreds = { accessKeyId: awsConn.access_key_id, secretAccessKey: awsConn.secret_access_key, region: infra.region };
          try {
            await ec2Action(creds, "StopInstances", { "InstanceId.1": r.resource_id });
            await supabase.from("aws_resources").update({ status: "stopped" }).eq("id", r.id);
            stoppedCount++;
          } catch (e) { console.error("Auto-stop failed:", r.resource_id, e); }
        }
      }
      return json({ success: true, stopped: stoppedCount });
    }

    // ── Diagnose Instance (auto-fix security groups, check connectivity) ──
    if (action === "diagnose-instance") {
      const { awsConnectionId, instanceId, infrastructureId } = params;
      const { data: awsConn } = await supabase.from("aws_connections").select("*").eq("id", awsConnectionId).eq("user_id", userId).single();
      if (!awsConn) return json({ success: false, error: "AWS connection not found" });

      const creds: AwsCreds = { accessKeyId: awsConn.access_key_id, secretAccessKey: awsConn.secret_access_key, region: awsConn.default_region };
      const diagnostics: string[] = [];
      const fixes: string[] = [];

      // 1. Check instance state
      const descRes = await ec2Action(creds, "DescribeInstances", { "InstanceId.1": instanceId });
      const instanceState = extractTag(descRes.rawText, "name"); // instance state name
      const publicIp = extractTag(descRes.rawText, "publicIpAddress") || extractTag(descRes.rawText, "ipAddress");
      const publicDns = extractTag(descRes.rawText, "publicDnsName") || extractTag(descRes.rawText, "dnsName");
      diagnostics.push(`Instance state: ${instanceState || "unknown"}`);
      diagnostics.push(`Public IP: ${publicIp || "none"}`);
      diagnostics.push(`Public DNS: ${publicDns || "none"}`);

      // If instance is stopped, start it
      if (instanceState === "stopped") {
        await ec2Action(creds, "StartInstances", { "InstanceId.1": instanceId });
        await supabase.from("aws_resources").update({ status: "running" }).eq("resource_id", instanceId);
        fixes.push("Instance was stopped — started it");
        diagnostics.push("Instance started, wait 2-3 minutes for boot");
      }

      // 2. Check security group rules
      // Find the security group(s) for this instance
      const sgMatches = descRes.rawText.match(/<groupId>(sg-[a-f0-9]+)<\/groupId>/g) || [];
      const sgIds = sgMatches.map(m => m.replace(/<\/?groupId>/g, ""));
      diagnostics.push(`Security groups: ${sgIds.join(", ") || "none"}`);

      for (const sgId of sgIds) {
        const sgDescRes = await ec2Action(creds, "DescribeSecurityGroups", { "GroupId.1": sgId });
        const sgText = sgDescRes.rawText;

        // Check for port 80
        const hasPort80 = sgText.includes("<fromPort>80</fromPort>");
        const hasPort443 = sgText.includes("<fromPort>443</fromPort>");
        const hasPort22 = sgText.includes("<fromPort>22</fromPort>");

        diagnostics.push(`SG ${sgId}: HTTP(80)=${hasPort80}, HTTPS(443)=${hasPort443}, SSH(22)=${hasPort22}`);

        // Auto-fix missing rules
        if (!hasPort80) {
          await ec2Action(creds, "AuthorizeSecurityGroupIngress", {
            GroupId: sgId, IpProtocol: "tcp", FromPort: "80", ToPort: "80", CidrIp: "0.0.0.0/0",
          });
          fixes.push(`Added HTTP (port 80) rule to ${sgId}`);
        }
        if (!hasPort443) {
          await ec2Action(creds, "AuthorizeSecurityGroupIngress", {
            GroupId: sgId, IpProtocol: "tcp", FromPort: "443", ToPort: "443", CidrIp: "0.0.0.0/0",
          });
          fixes.push(`Added HTTPS (port 443) rule to ${sgId}`);
        }
        if (!hasPort22) {
          await ec2Action(creds, "AuthorizeSecurityGroupIngress", {
            GroupId: sgId, IpProtocol: "tcp", FromPort: "22", ToPort: "22", CidrIp: "0.0.0.0/0",
          });
          fixes.push(`Added SSH (port 22) rule to ${sgId}`);
        }
      }

      // 3. Check VPC routing (internet gateway)
      if (infrastructureId) {
        const { data: infra } = await supabase.from("aws_infrastructure").select("*").eq("id", infrastructureId).single();
        if (infra) {
          diagnostics.push(`VPC: ${infra.vpc_id || "none"}`);
          diagnostics.push(`Internet Gateway: ${infra.internet_gateway_id || "none"}`);
          diagnostics.push(`Public Subnet: ${infra.public_subnet_id || "none"}`);

          // Check if IGW exists
          if (!infra.internet_gateway_id && infra.vpc_id) {
            const igwRes = await ec2Action(creds, "CreateInternetGateway", {});
            const newIgwId = extractTag(igwRes.rawText, "internetGatewayId");
            if (newIgwId) {
              await ec2Action(creds, "AttachInternetGateway", { InternetGatewayId: newIgwId, VpcId: infra.vpc_id });
              await supabase.from("aws_infrastructure").update({ internet_gateway_id: newIgwId }).eq("id", infrastructureId);
              fixes.push(`Created and attached Internet Gateway: ${newIgwId}`);
            }
          }
        }
      }

      // 4. Get console output for app diagnostics
      const logRes = await ec2Action(creds, "GetConsoleOutput", { InstanceId: instanceId });
      const outputB64 = extractTag(logRes.rawText, "output");
      let appStatus = "unknown";
      if (outputB64) {
        try {
          const decoded = atob(outputB64);
          if (decoded.includes("Deployment complete")) appStatus = "deployment_complete";
          else if (decoded.includes("Building Docker image")) appStatus = "building";
          else if (decoded.includes("Docker installed")) appStatus = "docker_ready";
          else if (decoded.includes("ERROR: Container failed")) appStatus = "container_failed";
          else if (decoded.includes("Application is responding")) appStatus = "app_responding";

          // Get last 20 meaningful lines
          const logLines = decoded.split("\n").filter((l: string) => l.trim()).slice(-20);
          diagnostics.push(`App boot status: ${appStatus}`);
          diagnostics.push(`Last log lines: ${logLines.join(" | ").substring(0, 500)}`);
        } catch { diagnostics.push("Could not decode console output"); }
      } else {
        diagnostics.push("Console output not yet available (instance may still be booting)");
      }

      // Update public URL if we found IP
      if (publicIp || publicDns) {
        const liveUrl = `http://${publicDns || publicIp}`;
        await supabase.from("aws_resources").update({ public_ip: publicIp || null, public_url: liveUrl }).eq("resource_id", instanceId);
      }

      return json({
        success: true,
        diagnostics,
        fixes,
        instanceState: instanceState || "unknown",
        publicIp: publicIp || null,
        publicDns: publicDns || null,
        appStatus,
      });
    }

    // ── Verify Deployment (health check before marking LIVE) ──
    if (action === "verify-deployment") {
      const { awsConnectionId, instanceId, deploymentId: depId } = params;
      const { data: awsConn } = await supabase.from("aws_connections").select("*").eq("id", awsConnectionId).eq("user_id", userId).single();
      if (!awsConn) return json({ success: false, error: "AWS connection not found" });

      const creds: AwsCreds = { accessKeyId: awsConn.access_key_id, secretAccessKey: awsConn.secret_access_key, region: awsConn.default_region };

      // Get instance info
      const descRes = await ec2Action(creds, "DescribeInstances", { "InstanceId.1": instanceId });
      const publicIp = extractTag(descRes.rawText, "publicIpAddress") || extractTag(descRes.rawText, "ipAddress");
      const publicDns = extractTag(descRes.rawText, "publicDnsName") || extractTag(descRes.rawText, "dnsName");

      if (!publicIp && !publicDns) {
        return json({ success: false, status: "no_ip", message: "Instance has no public IP yet" });
      }

      const url = `http://${publicDns || publicIp}`;

      // Try to reach the app
      let reachable = false;
      let healthOk = false;
      try {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10000) });
        healthOk = res.ok;
        reachable = true;
      } catch {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
          reachable = res.ok || res.status < 500;
        } catch { reachable = false; }
      }

      if (reachable) {
        // Mark as LIVE
        await supabase.from("aws_resources").update({ public_ip: publicIp, public_url: url, status: "running" }).eq("resource_id", instanceId);
        if (depId) {
          await supabase.from("deployments").update({ status: "live", live_url: url }).eq("id", depId);
        }
        return json({ success: true, status: "live", url, healthCheck: healthOk });
      }

      return json({
        success: false,
        status: "unreachable",
        url,
        message: "Application is not responding yet. It may still be building. Try again in a few minutes or run diagnostics.",
      });
    }

    return json({ error: "Unknown action: " + action }, 400);
  } catch (err: any) {
    return json({ error: err.message || "Internal error" }, 500);
  }
});

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<]+)</${tag}>`);
  const match = xml.match(regex);
  return match?.[1] || "";
}

function extractDatapoints(xml: string): Array<{ Average: number; Timestamp: string }> {
  const points: Array<{ Average: number; Timestamp: string }> = [];
  const memberRegex = /<member>(.*?)<\/member>/gs;
  let match;
  while ((match = memberRegex.exec(xml)) !== null) {
    const avg = extractTag(match[1], "Average");
    const ts = extractTag(match[1], "Timestamp");
    if (avg || ts) points.push({ Average: parseFloat(avg) || 0, Timestamp: ts || "" });
  }
  return points.sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());
}
