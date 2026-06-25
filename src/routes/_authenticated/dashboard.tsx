import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useHighestRole } from "@/hooks/use-auth";
import { Building2, Users, Receipt, Wrench, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Habico Portal" }] }),
  component: Dashboard,
});

function StatCard({ icon: Icon, label, value, hint, tone = "primary" }: { icon: typeof Building2; label: string; value: string; hint?: string; tone?: "primary" | "accent" | "success" | "warning" }) {
  const toneCls = { primary: "bg-primary text-primary-foreground", accent: "bg-accent text-accent-foreground", success: "bg-success text-success-foreground", warning: "bg-warning text-warning-foreground" }[tone];
  return (
    <Card className="shadow-card">
      <CardContent className="flex items-center gap-4 p-6">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${toneCls}`}><Icon className="h-6 w-6"/></div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="display text-2xl font-bold">{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const role = useHighestRole();

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id, role],
    queryFn: async () => {
      const [props, units, leases, payments, mr] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }),
        supabase.from("units").select("id,status", { count: "exact" }),
        supabase.from("leases").select("id,status", { count: "exact" }),
        supabase.from("payments").select("amount,payment_date"),
        supabase.from("maintenance_requests").select("id,status", { count: "exact" }),
      ]);
      const occupied = units.data?.filter(u => u.status === "occupied").length ?? 0;
      const total = units.count ?? 0;
      const openMR = mr.data?.filter(m => m.status === "open" || m.status === "in_progress").length ?? 0;
      const now = new Date();
      const monthRev = (payments.data ?? []).filter(p => {
        const d = new Date(p.payment_date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).reduce((s, p) => s + Number(p.amount), 0);
      return { properties: props.count ?? 0, totalUnits: total, occupied, leases: leases.count ?? 0, openMR, monthRev };
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">{role ?? "User"} dashboard</div>
          <h1 className="display text-3xl font-bold md:text-4xl">Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}.</h1>
        </div>
        {(role === "admin" || role === "manager") && (
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to="/properties">Manage properties</Link></Button>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/payments">Record payment</Link></Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} label="Properties" value={String(stats?.properties ?? 0)} />
        <StatCard icon={Users} label="Occupied units" value={`${stats?.occupied ?? 0}/${stats?.totalUnits ?? 0}`} tone="accent"/>
        <StatCard icon={Receipt} label="Revenue this month" value={`UGX ${(stats?.monthRev ?? 0).toLocaleString()}`} tone="success"/>
        <StatCard icon={Wrench} label="Open maintenance" value={String(stats?.openMR ?? 0)} tone="warning"/>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="display">Quick actions</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            {role === "tenant" ? (
              <>
                <Button asChild variant="outline" className="justify-start"><Link to="/maintenance"><Wrench className="mr-2 h-4 w-4"/>Submit maintenance request</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link to="/payments"><Receipt className="mr-2 h-4 w-4"/>View payment history</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link to="/leases"><Building2 className="mr-2 h-4 w-4"/>View my lease</Link></Button>
              </>
            ) : (
              <>
                <Button asChild variant="outline" className="justify-start"><Link to="/properties"><Building2 className="mr-2 h-4 w-4"/>Properties & units</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link to="/leases"><Users className="mr-2 h-4 w-4"/>Leases</Link></Button>
                <Button asChild variant="outline" className="justify-start"><Link to="/reports"><TrendingUp className="mr-2 h-4 w-4"/>Financial reports</Link></Button>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle className="display">Need attention</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-warning-foreground"/>
              <div>
                <div className="font-medium">{stats?.openMR ?? 0} open maintenance request{(stats?.openMR ?? 0) === 1 ? "" : "s"}</div>
                <Link to="/maintenance" className="text-xs text-primary underline-offset-4 hover:underline">Review now →</Link>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-3 text-muted-foreground">Tip: Habico delivers monthly landlord reports automatically. Visit Reports to download.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
