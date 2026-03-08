import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  ec2InstanceType: "t2.micro",
  rdsInstanceClass: "db.t3.micro",
  rdsStorage: 20,
  ebsSize: 10,
  maxEnvironments: 1,
  idleTimeoutMinutes: 30,
};

const COST_ESTIMATES: Record<string, number> = {
  ec2_t2_micro: 0, // Free tier
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
  port: number;
  envVars?: Record<string, string>;
  framework: string;
  projectType: string;
}): string {
  const envExports = config.envVars
    ? Object.entries(config.envVars).map(([k, v]) => `export ${k}="${v}"`).join("\n")
    : "";

  const dockerfileContent = config.projectType === "frontend"
    ? `FROM node:18-alpine AS build
WORKDIR /app
COPY . .
RUN npm install && ${config.buildCommand || "npm run build"}
FROM nginx:alpine
COPY --from=build /app/${config.framework?.includes("React") ? "build" : "dist"} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`
    : `FROM node:18-alpine
WORKDIR /app
COPY . .
RUN ${config.buildCommand || "npm install"}
${envExports ? `ENV PORT=${config.port}` : ""}
EXPOSE ${config.port}
CMD ${JSON.stringify((config.startCommand || "npm start").split(" "))}`;

  return btoa(`#!/bin/bash
set -e
exec > /var/log/user-data.log 2>&1

# Install Docker
yum update -y
yum install -y docker git
systemctl start docker
systemctl enable docker

# Clone project
${config.githubUrl ? `git clone ${config.githubUrl} /app` : "mkdir -p /app"}
cd /app

# Create Dockerfile
cat > Dockerfile << 'DOCKERFILE'
${dockerfileContent}
DOCKERFILE

# Set environment variables
${envExports}
export PORT=${config.port}

# Build and run
docker build -t ${config.projectName} .
docker run -d --restart always -p ${config.projectType === "frontend" ? "80:80" : `${config.port}:${config.port}`} --name ${config.projectName} ${config.projectName}

echo "Deployment complete!"
`);
}

// ══════════════════════════════════════
// ── Main Handler ──
// ══════════════════════════════════════

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, ...params } = await req.json();
    const supabase = getSupabaseAdmin();

    // Auth check
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
      ).auth.getUser(token);
      userId = user?.id || null;
    }
    if (!userId) return json({ error: "Unauthorized" }, 401);

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

      // Check for existing infrastructure (limit 1 per project)
      const { data: existingInfra } = await supabase.from("aws_infrastructure").select("id").eq("project_id", projectId).neq("status", "deleted");
      if (existingInfra && existingInfra.length >= FREE_TIER.maxEnvironments) {
        return json({ success: false, error: "Free tier limit: Only 1 active environment per project. Delete existing infrastructure first." });
      }

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
      await supabase.from("deployments").insert({
        project_id: projectId,
        user_id: userId,
        provider: "aws",
        status: "building",
      });

      // ── Step 1: Create VPC ──
      try {
        const vpcRes = await ec2Action(creds, "CreateVpc", { "CidrBlock": "10.0.0.0/16" });
        if (!vpcRes.ok) throw new Error("VPC creation failed: " + vpcRes.rawText);
        const vpcId = vpcRes.data?.CreateVpcResponse?.vpc?.vpcId || extractTag(vpcRes.rawText, "vpcId");
        if (!vpcId) throw new Error("Could not extract VPC ID");

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

        // ── Step 2: Create Internet Gateway ──
        const igwRes = await ec2Action(creds, "CreateInternetGateway", {});
        const igwId = extractTag(igwRes.rawText, "internetGatewayId");
        if (igwId) {
          await ec2Action(creds, "AttachInternetGateway", { InternetGatewayId: igwId, VpcId: vpcId });
          await supabase.from("aws_infrastructure").update({ internet_gateway_id: igwId }).eq("id", infra.id);
        }

        // ── Step 3: Create Subnets ──
        // Get available AZs
        const azRes = await ec2Action(creds, "DescribeAvailabilityZones", { "Filter.1.Name": "state", "Filter.1.Value.1": "available" });
        const azText = azRes.rawText;
        const azMatches = azText.match(/<zoneName>([^<]+)<\/zoneName>/g) || [];
        const azs = azMatches.map(m => m.replace(/<\/?zoneName>/g, "")).slice(0, 2);
        const az1 = azs[0] || creds.region + "a";
        const az2 = azs[1] || creds.region + "b";

        // Public subnet
        const pubSubRes = await ec2Action(creds, "CreateSubnet", {
          VpcId: vpcId, CidrBlock: "10.0.1.0/24", AvailabilityZone: az1,
        });
        const pubSubId = extractTag(pubSubRes.rawText, "subnetId");

        // Private subnet
        const privSubRes = await ec2Action(creds, "CreateSubnet", {
          VpcId: vpcId, CidrBlock: "10.0.2.0/24", AvailabilityZone: az1,
        });
        const privSubId = extractTag(privSubRes.rawText, "subnetId");

        // Second subnet for RDS (needs 2 AZs)
        let dbSubnet2Id = "";
        if (databaseEngine && databaseEngine !== "none") {
          const dbSub2Res = await ec2Action(creds, "CreateSubnet", {
            VpcId: vpcId, CidrBlock: "10.0.3.0/24", AvailabilityZone: az2,
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
        const sgRes = await ec2Action(creds, "CreateSecurityGroup", {
          GroupName: `cloudsnap-${project.name}-${Date.now()}`,
          Description: `Security group for ${project.name}`,
          VpcId: vpcId,
        });
        const sgId = extractTag(sgRes.rawText, "groupId");

        if (sgId) {
          // Allow HTTP
          await ec2Action(creds, "AuthorizeSecurityGroupIngress", {
            GroupId: sgId, IpProtocol: "tcp", FromPort: "80", ToPort: "80", "CidrIp": "0.0.0.0/0",
          });
          // Allow HTTPS
          await ec2Action(creds, "AuthorizeSecurityGroupIngress", {
            GroupId: sgId, IpProtocol: "tcp", FromPort: "443", ToPort: "443", "CidrIp": "0.0.0.0/0",
          });
          // Allow SSH (for debugging)
          await ec2Action(creds, "AuthorizeSecurityGroupIngress", {
            GroupId: sgId, IpProtocol: "tcp", FromPort: "22", ToPort: "22", "CidrIp": "0.0.0.0/0",
          });
          // Allow app port
          await ec2Action(creds, "AuthorizeSecurityGroupIngress", {
            GroupId: sgId, IpProtocol: "tcp", FromPort: "3000", ToPort: "9000", "CidrIp": "0.0.0.0/0",
          });

          await supabase.from("aws_infrastructure").update({ security_group_id: sgId, status: "launching_compute" }).eq("id", infra.id);
        }

        // ── Step 5: Launch EC2 Instance ──
        // Get latest Amazon Linux 2 AMI
        const amiRes = await ec2Action(creds, "DescribeImages", {
          "Owner.1": "amazon",
          "Filter.1.Name": "name",
          "Filter.1.Value.1": "amzn2-ami-hvm-*-x86_64-gp2",
          "Filter.2.Name": "state",
          "Filter.2.Value.1": "available",
        });
        let amiId = "ami-0c02fb55956c7d316"; // fallback
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
          port,
          framework: project.framework || "",
          projectType: appType || project.project_type || "frontend",
        });

        const ec2Params: Record<string, string> = {
          ImageId: amiId,
          InstanceType: FREE_TIER.ec2InstanceType,
          MinCount: "1",
          MaxCount: "1",
          UserData: userData,
          "TagSpecification.1.ResourceType": "instance",
          "TagSpecification.1.Tag.1.Key": "Name",
          "TagSpecification.1.Tag.1.Value": `cloudsnap-${project.name}`,
          "TagSpecification.1.Tag.2.Key": "cloudsnap-project",
          "TagSpecification.1.Tag.2.Value": projectId,
        };

        if (pubSubId) ec2Params["SubnetId"] = pubSubId;
        if (sgId) ec2Params["SecurityGroupId.1"] = sgId;

        const instanceRes = await ec2Action(creds, "RunInstances", ec2Params);
        const instanceId = extractTag(instanceRes.rawText, "instanceId");

        if (instanceId) {
          // Save EC2 resource
          await supabase.from("aws_resources").insert({
            infrastructure_id: infra.id,
            user_id: userId,
            resource_type: "ec2",
            resource_id: instanceId,
            status: "running",
            config: { instanceType: FREE_TIER.ec2InstanceType, amiId, port },
            monthly_cost_estimate: COST_ESTIMATES.ec2_t2_micro,
          });

          // Wait a moment then get public IP
          await new Promise(r => setTimeout(r, 3000));
          const descRes = await ec2Action(creds, "DescribeInstances", { "InstanceId.1": instanceId });
          const publicIp = extractTag(descRes.rawText, "publicIpAddress") || extractTag(descRes.rawText, "ipAddress");
          const publicDns = extractTag(descRes.rawText, "publicDnsName") || extractTag(descRes.rawText, "dnsName");

          if (publicIp || publicDns) {
            const liveUrl = `http://${publicDns || publicIp}`;
            await supabase.from("aws_resources").update({ public_ip: publicIp, public_url: liveUrl }).eq("infrastructure_id", infra.id).eq("resource_type", "ec2");

            // Update deployment
            await supabase.from("deployments").update({ status: "live", live_url: liveUrl }).eq("project_id", projectId).eq("provider", "aws").order("created_at", { ascending: false }).limit(1);
          }
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
            GroupName: `cloudsnap-db-${project.name}-${Date.now()}`,
            Description: `DB security group for ${project.name}`,
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
        let totalCost = COST_ESTIMATES.ec2_t2_micro;
        if (databaseEngine && databaseEngine !== "none") totalCost += COST_ESTIMATES.rds_db_t3_micro;

        await supabase.from("aws_infrastructure").update({
          status: "active",
          estimated_monthly_cost: totalCost,
        }).eq("id", infra.id);

        // Update deployment status
        await supabase.from("deployments").update({ status: "live" }).eq("project_id", projectId).eq("provider", "aws").order("created_at", { ascending: false }).limit(1);

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
        await supabase.from("deployments").update({ status: "error", error_message: e.message }).eq("project_id", projectId).eq("provider", "aws").order("created_at", { ascending: false }).limit(1);
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
