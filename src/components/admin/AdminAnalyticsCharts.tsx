import { useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Users, Rocket, Activity } from "lucide-react";

interface Props {
  users: any[];
  deployments: any[];
  feedback: any[];
  contacts: any[];
}

function groupByDate(items: any[], dateField = "created_at", days = 30) {
  const now = new Date();
  const map: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    map[d.toISOString().slice(0, 10)] = 0;
  }
  items.forEach((item) => {
    const key = new Date(item[dateField]).toISOString().slice(0, 10);
    if (map[key] !== undefined) map[key]++;
  });
  return Object.entries(map).map(([date, count]) => ({
    date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    count,
  }));
}

function groupByMonth(items: any[], dateField = "created_at") {
  const map: Record<string, number> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    map[key] = 0;
  }
  items.forEach((item) => {
    const key = new Date(item[dateField]).toISOString().slice(0, 7);
    if (map[key] !== undefined) map[key]++;
  });
  return Object.entries(map).map(([month, count]) => ({
    month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    count,
  }));
}

const COLORS = ["hsl(var(--primary))", "hsl(142 71% 45%)", "hsl(0 84% 60%)", "hsl(45 93% 47%)", "hsl(262 83% 58%)"];

export default function AdminAnalyticsCharts({ users, deployments, feedback, contacts }: Props) {
  const signupsByDay = useMemo(() => groupByDate(users), [users]);
  const deploymentsByDay = useMemo(() => groupByDate(deployments), [deployments]);
  const signupsByMonth = useMemo(() => groupByMonth(users), [users]);

  const deploymentStatusData = useMemo(() => {
    const statusMap: Record<string, number> = {};
    deployments.forEach((d) => {
      statusMap[d.status] = (statusMap[d.status] || 0) + 1;
    });
    return Object.entries(statusMap).map(([name, value]) => ({ name, value }));
  }, [deployments]);

  const activityByDay = useMemo(() => {
    const now = new Date();
    const map: Record<string, { signups: number; deploys: number; feedback: number; messages: number }> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      map[d.toISOString().slice(0, 10)] = { signups: 0, deploys: 0, feedback: 0, messages: 0 };
    }
    users.forEach((u) => { const k = new Date(u.created_at).toISOString().slice(0, 10); if (map[k]) map[k].signups++; });
    deployments.forEach((d) => { const k = new Date(d.created_at).toISOString().slice(0, 10); if (map[k]) map[k].deploys++; });
    feedback.forEach((f) => { const k = new Date(f.created_at).toISOString().slice(0, 10); if (map[k]) map[k].feedback++; });
    contacts.forEach((c) => { const k = new Date(c.created_at).toISOString().slice(0, 10); if (map[k]) map[k].messages++; });
    return Object.entries(map).map(([date, data]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ...data,
    }));
  }, [users, deployments, feedback, contacts]);

  const statusColors: Record<string, string> = {
    live: "hsl(142 71% 45%)",
    error: "hsl(0 84% 60%)",
    building: "hsl(45 93% 47%)",
    queued: "hsl(var(--muted-foreground))",
    deploying: "hsl(262 83% 58%)",
  };

  return (
    <div className="space-y-6">
      {/* Row 1: Signups + Deployments over time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> User Signups (Last 30 Days)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={signupsByDay}>
              <defs>
                <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" fill="url(#signupGrad)" strokeWidth={2} name="Signups" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Rocket className="h-4 w-4 text-emerald-400" /> Deployments (Last 30 Days)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={deploymentsByDay}>
              <defs>
                <linearGradient id="deployGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Area type="monotone" dataKey="count" stroke="hsl(142 71% 45%)" fill="url(#deployGrad)" strokeWidth={2} name="Deployments" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Monthly signups bar + Deployment status pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Monthly Signups (6 Months)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={signupsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Signups" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-400" /> Deployment Status Breakdown
          </h3>
          {deploymentStatusData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No deployment data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={deploymentStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" nameKey="name">
                  {deploymentStatusData.map((entry, i) => (
                    <Cell key={entry.name} fill={statusColors[entry.name] || COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: Combined activity */}
      <div className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Platform Activity (Last 14 Days)
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={activityByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="signups" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} name="Signups" />
            <Bar dataKey="deploys" fill="hsl(142 71% 45%)" radius={[2, 2, 0, 0]} name="Deploys" />
            <Bar dataKey="feedback" fill="hsl(45 93% 47%)" radius={[2, 2, 0, 0]} name="Reviews" />
            <Bar dataKey="messages" fill="hsl(262 83% 58%)" radius={[2, 2, 0, 0]} name="Messages" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
