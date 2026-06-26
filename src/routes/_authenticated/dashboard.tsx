import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Building2, Users, Receipt, Wrench, TrendingUp, AlertTriangle,
  ArrowRight, Home, FileText, Calendar, DollarSign,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Habico Portal" }] }),
  component: Dashboard,
});

function GradientMetricCard({
  icon: Icon, label, value, gradient, progress,
}: {
  icon: any; label: string; value: string; gradient: string; progress?: number;
}) {
  return (
    <Card className="overflow-hidden border-0 shadow-card">
      <div className={`relative p-6 ${gradient}`}>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-white/80">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
          <div className="rounded-full bg-white/20 p-3">
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
        {progress !== undefined && (
          <div className="mt-3 space-y-1">
            <Progress value={progress} className="h-2 bg-white/20 [&>*]:bg-white" />
            <p className="text-xs text-white/70">{progress}%</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function useStaffDashboardData() {
  return useQuery({
    queryKey: ["staff-dashboard"],
    queryFn: async () => {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const [propsRes, unitsRes, leasesRes, mrRes] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }),
        supabase.from("units").select("id,status"),
        supabase.from("leases")
          .select("*, units(unit_number, properties(name))")
          .order("created_at", { ascending: false }),
        supabase.from("maintenance_requests").select("id,status"),
      ]);

      const propertiesCount = propsRes.count ?? 0;
      const allUnits = (unitsRes.data as any) ?? [];
      const totalUnits = allUnits.length;
      const occupiedUnits = allUnits.filter((u: any) => u.status === "occupied").length;
      const vacantUnits = totalUnits - occupiedUnits;
      const openMR = ((mrRes.data as any) ?? []).filter(
        (m: any) => m.status === "open" || m.status === "in_progress",
      ).length;

      const allLeases = (leasesRes.data as any) ?? [];
      const activeLeases = allLeases.filter((l: any) => l.status === "active");
      const activeLeasesCount = activeLeases.length;
      const expectedRent = activeLeases.reduce((s: number, l: any) => s + Number(l.monthly_rent), 0);

      const tenantIds = [...new Set(activeLeases.map((l: any) => l.tenant_id).filter(Boolean))] as string[];
      let profileMap = new Map<string, any>();
      if (tenantIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", tenantIds);
        profileMap = new Map((profiles as any[])?.map((p: any) => [p.id, p]) ?? []);
      }

      const activeLeaseIds = activeLeases.map((l: any) => l.id);
      let collectedThisMonth = 0;
      let recentPayments: any[] = [];
      let outstandingBalances: any[] = [];

      if (activeLeaseIds.length > 0) {
        const { data: paymentsRaw } = await supabase
          .from("payments")
          .select("*, leases!inner(monthly_rent, tenant_id, units(unit_number, properties(name)))")
          .in("lease_id", activeLeaseIds)
          .order("payment_date", { ascending: false })
          .limit(10);

        const allPayments = (paymentsRaw as any) ?? [];

        const curMonthPayments = allPayments.filter((p: any) => {
          const d = new Date(p.payment_date);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });
        collectedThisMonth = curMonthPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);

        recentPayments = allPayments.slice(0, 5).map((p: any) => {
          const tenantProfile = profileMap.get(p.leases?.tenant_id);
          return {
            date: p.payment_date,
            tenantName: tenantProfile?.full_name || tenantProfile?.email?.split("@")[0] || "Unknown",
            amount: Number(p.amount),
            method: p.method,
            unit: p.leases?.units
              ? `${p.leases.units.properties?.name} \u00b7 ${p.leases.units.unit_number}`
              : "",
          };
        });

        const paymentsByLease: Record<string, number> = {};
        for (const p of curMonthPayments) {
          paymentsByLease[p.lease_id] = (paymentsByLease[p.lease_id] || 0) + Number(p.amount);
        }

        outstandingBalances = activeLeases
          .map((l: any) => {
            const paid = paymentsByLease[l.id] || 0;
            const profile = profileMap.get(l.tenant_id);
            return {
              tenantName: profile?.full_name || profile?.email?.split("@")[0] || "Unknown",
              unit: `${l.units?.properties?.name} \u00b7 ${l.units?.unit_number}`,
              monthlyRent: Number(l.monthly_rent),
              balanceDue: Math.max(0, Number(l.monthly_rent) - paid),
            };
          })
          .filter((l: any) => l.balanceDue > 0);
      }

      const activeTenantsCount = new Set(activeLeases.map((l: any) => l.tenant_id)).size;

      const expiringLeases = activeLeases
        .filter((l: any) => {
          if (!l.end_date) return false;
          const end = new Date(l.end_date);
          return end >= now && end <= thirtyDaysFromNow;
        })
        .map((l: any) => {
          const profile = profileMap.get(l.tenant_id);
          return {
            tenantName: profile?.full_name || profile?.email?.split("@")[0] || "Unknown",
            unit: `${l.units?.properties?.name} \u00b7 ${l.units?.unit_number}`,
            expiryDate: l.end_date,
            daysRemaining: Math.ceil((new Date(l.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          };
        });

      const collectionRate = expectedRent > 0 ? Math.round((collectedThisMonth / expectedRent) * 100) : 0;
      const uncollected = expectedRent - collectedThisMonth;

      return {
        propertiesCount,
        totalUnits,
        occupiedUnits,
        vacantUnits,
        activeLeasesCount,
        activeTenantsCount,
        expectedRent,
        collectedThisMonth,
        collectionRate,
        uncollected,
        recentPayments,
        expiringLeases,
        openMR,
        outstandingBalances,
      } as any;
    },
  });
}

function useTenantDashboardData(tenantId: string) {
  return useQuery({
    queryKey: ["tenant-dashboard", tenantId],
    queryFn: async () => {
      const [leasesRes, mrRes] = await Promise.all([
        supabase.from("leases")
          .select("*, units(unit_number, properties(name))")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),
        supabase.from("maintenance_requests")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),
      ]);

      const leases = (leasesRes.data as any) ?? [];
      const activeLeaseIds = leases.filter((l: any) => l.status === "active").map((l: any) => l.id);

      let payments: any[] = [];
      if (activeLeaseIds.length > 0) {
        const { data: pData } = await supabase
          .from("payments")
          .select("*, leases!inner(monthly_rent, units(unit_number, properties(name)))")
          .in("lease_id", activeLeaseIds)
          .order("payment_date", { ascending: false })
          .limit(10);
        payments = (pData as any) ?? [];
      }

      return { leases, payments, maintenanceRequests: (mrRes.data as any) ?? [] } as any;
    },
    enabled: !!tenantId,
  });
}

function StaffDashboard() {
  const { data: d, isLoading } = useStaffDashboardData();
  const { user } = useAuth();

  if (isLoading || !d) {
    return <div className="text-sm text-muted-foreground">Loading dashboard data\u2026</div>;
  }

  const occupancyRate = d.totalUnits > 0 ? Math.round((d.occupiedUnits / d.totalUnits) * 100) : 0;

  const daysColor = (days: number) => {
    if (days <= 7) return "text-red-600 font-semibold";
    if (days <= 14) return "text-amber-600 font-semibold";
    return "text-green-600 font-semibold";
  };

  const rateColor = d.collectionRate >= 80
    ? "text-green-600"
    : d.collectionRate >= 50
      ? "text-amber-600"
      : "text-red-600";

  const rateBarColor = d.collectionRate >= 80
    ? "[&>*]:bg-green-500"
    : d.collectionRate >= 50
      ? "[&>*]:bg-amber-500"
      : "[&>*]:bg-red-500";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Staff Dashboard</p>
          <h1 className="display text-3xl font-bold md:text-4xl">
            Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}.
          </h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/properties">Manage properties</Link></Button>
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/payments">Record payment</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GradientMetricCard icon={Building2} label="Properties" value={String(d.propertiesCount)} gradient="bg-gradient-to-br from-blue-600 to-blue-800" />
        <GradientMetricCard icon={Users} label="Occupancy Rate" value={`${d.occupiedUnits}/${d.totalUnits}`} gradient="bg-gradient-to-br from-green-500 to-green-700" progress={occupancyRate} />
        <GradientMetricCard icon={Receipt} label="This Month Collections" value={`UGX ${d.collectedThisMonth.toLocaleString()}`} gradient="bg-gradient-to-br from-teal-500 to-teal-700" progress={d.collectionRate} />
        <GradientMetricCard icon={Wrench} label="Open Maintenance" value={String(d.openMR)} gradient="bg-gradient-to-br from-orange-500 to-orange-700" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="display flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              Collections &amp; Dues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Expected rent this month</span>
              <span className="font-semibold">UGX {d.expectedRent.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Collected this month</span>
              <span className="font-semibold text-green-600">UGX {d.collectedThisMonth.toLocaleString()}</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Collection rate</span>
                <span className={`font-semibold ${rateColor}`}>{d.collectionRate}%</span>
              </div>
              <Progress value={d.collectionRate} className={`h-2 ${rateBarColor}`} />
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Uncollected amount</span>
              <span className="font-semibold text-red-600">UGX {Math.max(0, d.uncollected).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="display flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Units</span>
              <span className="font-semibold">{d.totalUnits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Occupied</span>
              <span className="font-semibold text-green-600">{d.occupiedUnits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Vacant</span>
              <span className="font-semibold text-amber-600">{d.vacantUnits}</span>
            </div>
            <div className="border-t border-border pt-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Active Leases</span>
                <span className="font-semibold">{d.activeLeasesCount}</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-sm text-muted-foreground">Active Tenants</span>
                <span className="font-semibold">{d.activeTenantsCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {d.expiringLeases.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="display flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              Expiring Leases (Next 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pr-4">Tenant</th>
                  <th className="pb-2 pr-4">Unit</th>
                  <th className="pb-2 pr-4">Expiry Date</th>
                  <th className="pb-2 text-right">Days Remaining</th>
                </tr>
              </thead>
              <tbody>
                {(d.expiringLeases as any[]).map((lease: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4 font-medium">{lease.tenantName}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{lease.unit}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{new Date(lease.expiryDate).toLocaleDateString()}</td>
                    <td className={`py-2 text-right ${daysColor(lease.daysRemaining)}`}>
                      {lease.daysRemaining}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="display flex items-center gap-2">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {(d.recentPayments as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Tenant</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2 text-right">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.recentPayments as any[]).map((p: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{new Date(p.date).toLocaleDateString()}</td>
                      <td className="py-2 pr-4 font-medium">{p.tenantName}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">UGX {p.amount.toLocaleString()}</td>
                      <td className="py-2 text-right capitalize text-muted-foreground">{p.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Link to="/payments" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
              View all payments <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="display flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              Outstanding Balances
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {(d.outstandingBalances as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">All tenants are up to date.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-4">Tenant</th>
                    <th className="pb-2 pr-4">Unit</th>
                    <th className="pb-2 pr-4">Monthly Rent</th>
                    <th className="pb-2 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.outstandingBalances as any[]).slice(0, 10).map((b: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 font-medium">{b.tenantName}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{b.unit}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">UGX {b.monthlyRent.toLocaleString()}</td>
                      <td className="py-2 text-right font-semibold text-red-600 whitespace-nowrap">UGX {b.balanceDue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="display">Quick actions</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            <Button asChild variant="outline" className="justify-start"><Link to="/properties"><Building2 className="mr-2 h-4 w-4"/>Properties &amp; units</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link to="/leases"><Users className="mr-2 h-4 w-4"/>Leases</Link></Button>
            <Button asChild variant="outline" className="justify-start"><Link to="/reports"><TrendingUp className="mr-2 h-4 w-4"/>Financial reports</Link></Button>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle className="display">Need attention</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-warning-foreground"/>
              <div>
                <div className="font-medium">{d.openMR} open maintenance request{(d.openMR === 1 ? "" : "s")}</div>
                <Link to="/maintenance" className="text-xs text-primary underline-offset-4 hover:underline">Review now &rarr;</Link>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background p-3 text-muted-foreground">
              Tip: Habico delivers monthly landlord reports automatically. Visit Reports to download.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TenantDashboard() {
  const { user } = useAuth();
  const { data: d, isLoading } = useTenantDashboardData(user?.id ?? "");

  if (isLoading || !d) {
    return <div className="text-sm text-muted-foreground">Loading your dashboard\u2026</div>;
  }

  const activeLease = (d.leases as any[]).find((l: any) => l.status === "active");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Tenant Dashboard</p>
        <h1 className="display text-3xl font-bold md:text-4xl">
          Welcome back{user?.email ? `, ${user.email.split("@")[0]}` : ""}.
        </h1>
      </div>

      {activeLease ? (
        <Card className="shadow-card border-l-4 border-l-accent">
          <CardHeader>
            <CardTitle className="display flex items-center gap-2">
              <Home className="h-5 w-5 text-muted-foreground" />
              Your Lease
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Unit</p>
              <p className="font-semibold">{activeLease.units?.unit_number} &mdash; {activeLease.units?.properties?.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monthly Rent</p>
              <p className="font-semibold">UGX {Number(activeLease.monthly_rent).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="font-semibold">{new Date(activeLease.start_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">End Date</p>
              <p className="font-semibold">{activeLease.end_date ? new Date(activeLease.end_date).toLocaleDateString() : "Open-ended"}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            You don&apos;t have an active lease at this time.
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="display flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            Payment History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(d.payments as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Amount</th>
                    <th className="pb-2 pr-4">Method</th>
                    <th className="pb-2 text-right">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.payments as any[]).map((p: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">{new Date(p.payment_date).toLocaleDateString()}</td>
                      <td className="py-2 pr-4 font-medium whitespace-nowrap">UGX {Number(p.amount).toLocaleString()}</td>
                      <td className="py-2 pr-4 capitalize text-muted-foreground">{p.method}</td>
                      <td className="py-2 text-right text-muted-foreground">{p.reference || "\u2014"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="display flex items-center gap-2">
            <Wrench className="h-5 w-5 text-muted-foreground" />
            My Maintenance Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(d.maintenanceRequests as any[]).length === 0 ? (
            <p className="text-sm text-muted-foreground">No maintenance requests submitted.</p>
          ) : (
            <div className="space-y-2">
              {(d.maintenanceRequests as any[]).slice(0, 5).map((req: any) => (
                <div key={req.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium text-sm">{req.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{req.status.replace("_", " ")} &middot; {req.priority} priority</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                    req.status === "resolved" ? "bg-green-100 text-green-800" :
                    req.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                    "bg-amber-100 text-amber-800"
                  }`}>{req.status.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          )}
          <Link to="/maintenance" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            View all requests <ArrowRight className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader><CardTitle className="display">Quick actions</CardTitle></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          <Button asChild variant="outline" className="justify-start"><Link to="/maintenance"><Wrench className="mr-2 h-4 w-4"/>Submit maintenance request</Link></Button>
          <Button asChild variant="outline" className="justify-start"><Link to="/payments"><Receipt className="mr-2 h-4 w-4"/>View payment history</Link></Button>
          <Button asChild variant="outline" className="justify-start"><Link to="/leases"><Building2 className="mr-2 h-4 w-4"/>View my lease</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Dashboard() {
  const role = useHighestRole();

  if (role === "tenant") return <TenantDashboard />;
  return <StaffDashboard />;
}
