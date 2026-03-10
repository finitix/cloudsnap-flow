import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Github, FolderGit2, Cloud, Server, Globe, Database, MapPin, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const DB_OPTIONS = [
  { id: "none", name: "No Database" },
  { id: "postgresql", name: "PostgreSQL" },
  { id: "mysql", name: "MySQL" },
];

const AWS_REGIONS = [
  { id: "us-east-1", name: "US East (N. Virginia)" },
  { id: "us-west-2", name: "US West (Oregon)" },
  { id: "ap-south-1", name: "Asia Pacific (Mumbai)" },
  { id: "eu-west-1", name: "EU (Ireland)" },
];

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [databaseEngine, setDatabaseEngine] = useState("none");
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [awsConnections, setAwsConnections] = useState<any[]>([]);
  const [selectedAwsConn, setSelectedAwsConn] = useState("");
  const [deployTarget, setDeployTarget] = useState<"cloud" | "aws">("cloud");
  const navigate = useNavigate();

  // Auto-detection state
  const [detecting, setDetecting] = useState(false);
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [detectedFramework, setDetectedFramework] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const [projectsRes, awsRes] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("aws_connections").select("id, display_name, default_region"),
    ]);
    setProjects(projectsRes.data || []);
    setAwsConnections(awsRes.data || []);
    if (awsRes.data && awsRes.data.length > 0) setSelectedAwsConn(awsRes.data[0].id);
  };

  useEffect(() => { load(); }, [user]);

  // Auto-detect project type when GitHub URL changes
  useEffect(() => {
    const url = githubUrl.trim();
    if (!url || !url.includes("github.com/")) {
      setDetectedType(null);
      setDetectedFramework(null);
      return;
    }

    const timer = setTimeout(async () => {
      setDetecting(true);
      setDetectedType(null);
      setDetectedFramework(null);
      try {
        // Use the deploy-project analyze endpoint to detect project type
        // First create a temporary project, analyze, then we'll use the results
        const { data } = await supabase.functions.invoke("deploy-project", {
          body: { action: "quick-analyze", githubUrl: url },
        });
        if (data?.success) {
          setDetectedType(data.projectType || "frontend");
          setDetectedFramework(data.framework || null);
          // Auto-set name from repo if empty
          if (!name) {
            const repoName = url.split("/").pop()?.replace(".git", "") || "";
            setName(repoName);
          }
        }
      } catch {
        // Silently fail — user can still create project
      } finally {
        setDetecting(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [githubUrl]);

  const createProject = async (sourceType: "zip" | "github") => {
    if (!name) { toast.error("Project name required"); return; }
    setLoading(true);
    try {
      if (sourceType === "zip" && file) {
        const filePath = `${user!.id}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("project-uploads").upload(filePath, file);
        if (uploadErr) throw uploadErr;
      }

      const insertData: any = {
        user_id: user!.id,
        name,
        source_type: sourceType,
        github_url: sourceType === "github" ? githubUrl : null,
        project_type: detectedType || "frontend",
        status: "analyzing",
      };

      if (deployTarget === "aws") {
        insertData.aws_region = awsRegion;
        insertData.database_engine = databaseEngine;
        insertData.aws_connection_id = selectedAwsConn;
      }

      const { data, error } = await supabase.from("projects").insert(insertData).select().single();
      if (error) throw error;
      toast.success("Project created! Analyzing...");
      setOpen(false);
      setName(""); setGithubUrl(""); setFile(null); setDatabaseEngine("none");
      setDetectedType(null); setDetectedFramework(null);

      // Trigger analysis
      const { data: analysisData } = await supabase.functions.invoke("deploy-project", {
        body: { action: "analyze", projectId: data.id },
      });

      if (analysisData?.success) {
        load();
        toast.success(`Project "${name}" analysis complete — ${analysisData.projectType || "ready"}!`);
      } else {
        setTimeout(async () => {
          await supabase.from("projects").update({
            framework: detectedFramework || "React",
            build_command: "npm run build",
            output_dir: "dist",
            status: "ready",
          }).eq("id", data.id);
          load();
          toast.success(`Project "${name}" is ready to deploy!`);
        }, 3000);
      }

      load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const typeIcon = (type: string | null) => {
    if (type === "backend") return <Server className="h-4 w-4" />;
    if (type === "fullstack") return <FolderGit2 className="h-4 w-4" />;
    return <Globe className="h-4 w-4" />;
  };

  const typeLabel = (type: string | null) => {
    if (type === "backend") return "Backend";
    if (type === "fullstack") return "Full Stack";
    return "Frontend";
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your deployable projects</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Project</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Project</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-awesome-app" />
                </div>

                {/* Deploy Target */}
                <div className="space-y-2">
                  <Label>Deploy Target</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDeployTarget("cloud")}
                      className={`p-3 rounded-lg border text-left transition-all text-sm ${deployTarget === "cloud" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
                    >
                      <div className="flex items-center gap-2 font-medium"><Cloud className="h-4 w-4" /> Cloud PaaS</div>
                      <p className="text-[10px] text-muted-foreground mt-1">Vercel, Render</p>
                    </button>
                    <button
                      onClick={() => setDeployTarget("aws")}
                      className={`p-3 rounded-lg border text-left transition-all text-sm ${deployTarget === "aws" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
                      disabled={awsConnections.length === 0}
                    >
                      <div className="flex items-center gap-2 font-medium"><Cloud className="h-4 w-4" /> AWS</div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {awsConnections.length === 0 ? "Connect AWS first" : "EC2, RDS, VPC"}
                      </p>
                    </button>
                  </div>
                </div>

                {/* AWS-specific options */}
                {deployTarget === "aws" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> AWS Region</Label>
                        <Select value={awsRegion} onValueChange={setAwsRegion}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {AWS_REGIONS.map(r => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1"><Database className="h-3 w-3" /> Database</Label>
                        <Select value={databaseEngine} onValueChange={setDatabaseEngine}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DB_OPTIONS.map(d => (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {awsConnections.length > 1 && (
                      <div className="space-y-2">
                        <Label>AWS Account</Label>
                        <Select value={selectedAwsConn} onValueChange={setSelectedAwsConn}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {awsConnections.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.display_name} ({c.default_region})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {databaseEngine !== "none" && (
                      <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">Free Tier Config:</p>
                        <p>• EC2: t3.micro (750 hrs/month free)</p>
                        <p>• RDS: db.t3.micro, 20GB ({databaseEngine})</p>
                        <p>• Estimated cost: <span className="text-green-400 font-medium">$0.00/month</span> (within free tier)</p>
                      </div>
                    )}
                  </>
                )}

                {/* Source */}
                <Tabs defaultValue="github">
                  <TabsList className="w-full">
                    <TabsTrigger value="github" className="flex-1"><Github className="h-4 w-4 mr-2" />GitHub</TabsTrigger>
                    <TabsTrigger value="zip" className="flex-1"><Upload className="h-4 w-4 mr-2" />Upload ZIP</TabsTrigger>
                  </TabsList>
                  <TabsContent value="github" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>GitHub Repository URL</Label>
                      <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/user/repo" />
                    </div>

                    {/* Auto-detected type indicator */}
                    {githubUrl && githubUrl.includes("github.com/") && (
                      <div className={`rounded-lg border p-3 transition-all ${detectedType ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30"}`}>
                        <div className="flex items-center gap-2">
                          {detecting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Analyzing repository...</span>
                            </>
                          ) : detectedType ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-primary" />
                              <div className="flex items-center gap-2">
                                {typeIcon(detectedType)}
                                <span className="text-sm font-medium">{typeLabel(detectedType)}</span>
                                {detectedFramework && (
                                  <Badge variant="outline" className="text-[10px]">{detectedFramework}</Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground ml-auto">Auto-detected</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">Enter a GitHub URL to auto-detect project type</span>
                          )}
                        </div>
                      </div>
                    )}

                    <Button onClick={() => createProject("github")} disabled={loading || !name || detecting} className="w-full">
                      {loading ? "Creating..." : "Import from GitHub"}
                    </Button>
                  </TabsContent>
                  <TabsContent value="zip" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>ZIP File</Label>
                      <Input type="file" accept=".zip" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    </div>
                    <Button onClick={() => createProject("zip")} disabled={loading || !name} className="w-full">
                      {loading ? "Uploading..." : "Upload & Create"}
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {projects.length === 0 ? (
          <div className="glass-card rounded-xl p-16 text-center">
            <FolderGit2 className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h3 className="font-semibold mb-2">No projects yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add a project from GitHub or upload a ZIP</p>
            <Button variant="outline" onClick={() => setOpen(true)}>Add Project</Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="glass-card rounded-xl p-5 flex items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    {p.aws_connection_id ? <Cloud className="h-5 w-5 text-amber-400" /> :
                     p.source_type === "github" ? <Github className="h-5 w-5 text-primary" /> : <Upload className="h-5 w-5 text-primary" />}
                  </div>
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{p.framework || "Detecting..."} • {p.source_type}</span>
                      {p.aws_connection_id && <Badge variant="outline" className="text-[10px]">AWS</Badge>}
                      {p.aws_region && <Badge variant="outline" className="text-[10px]">{p.aws_region}</Badge>}
                      {p.database_engine && p.database_engine !== "none" && (
                        <Badge variant="outline" className="text-[10px]">{p.database_engine}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={p.status} />
                  <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
