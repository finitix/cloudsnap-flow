import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, User, Bell, Shield, Palette } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState({
    deploySuccess: true,
    deployFailure: true,
    weeklyReport: false,
  });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || "");
        setEmail(data.email || user.email || "");
      }
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        display_name: displayName,
      }).eq("user_id", user.id);
      if (error) throw error;
      toast.success("Profile updated!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-primary" /> Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your account and preferences</p>
        </div>

        {/* Profile Section */}
        <div className="glass-card rounded-xl p-6 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Profile
          </h3>
          <div className="flex items-start gap-6">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                {(displayName || email || "U")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} disabled className="opacity-60" />
                <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="glass-card rounded-xl p-6 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Notifications
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Deployment Success</p>
                <p className="text-xs text-muted-foreground">Get notified when deployments succeed</p>
              </div>
              <Switch
                checked={notifications.deploySuccess}
                onCheckedChange={(v) => setNotifications((p) => ({ ...p, deploySuccess: v }))}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Deployment Failure</p>
                <p className="text-xs text-muted-foreground">Get notified when deployments fail</p>
              </div>
              <Switch
                checked={notifications.deployFailure}
                onCheckedChange={(v) => setNotifications((p) => ({ ...p, deployFailure: v }))}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Weekly Report</p>
                <p className="text-xs text-muted-foreground">Receive a weekly deployment summary</p>
              </div>
              <Switch
                checked={notifications.weeklyReport}
                onCheckedChange={(v) => setNotifications((p) => ({ ...p, weeklyReport: v }))}
              />
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="glass-card rounded-xl p-6 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Security
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Two-Factor Authentication</p>
                <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
              </div>
              <Button variant="outline" size="sm" disabled>Coming Soon</Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Active Sessions</p>
                <p className="text-xs text-muted-foreground">Manage your active login sessions</p>
              </div>
              <Button variant="outline" size="sm" disabled>Coming Soon</Button>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Appearance
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Currently using dark theme</p>
            </div>
            <Button variant="outline" size="sm" disabled>Dark (Default)</Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
