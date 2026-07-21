import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useHighestRole } from "@/hooks/use-auth";
import { useAllFeatureAccess } from "@/hooks/use-feature-access";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CommandMenu } from "@/components/command-menu";
import { getWorkspace } from "@/lib/workspace-config";
import { Crown, X, Clock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

const routeFeatureMap: Record<string, string[]> = {
  rental: [
    "/properties", "/landlords", "/leases", "/tenants", "/payments",
    "/recurring-billing", "/payment-proofs", "/rental-messages",
    "/e-leasing", "/rental-id-cards", "/listing-banners",
    "/maintenance", "/preventative-maintenance", "/rental-tax-dashboard",
  ],
  move_service: ["/move-service", "/move-bookings"],
  construction: [
    "/projects", "/project-dashboard", "/project-schedules",
    "/project-tasks", "/daily-logs", "/rfis", "/submittals",
    "/meeting-minutes", "/punch-list", "/safety-incidents",
    "/project-documents", "/project-photos", "/leads", "/estimates",
    "/proposals", "/bid-packages", "/employees", "/timesheets",
    "/expenses", "/receipts", "/suppliers", "/purchase-orders",
    "/inventory", "/assets", "/equipment-rentals",
  ],
  construction_financial: [
    "/construction-invoices", "/subcontracts", "/change-orders",
    "/allowances", "/project-budget", "/bills", "/lien-waivers",
    "/commitment-log", "/progress-payments",
  ],
  sop: ["/sop", "/sop-checklists", "/sop-forms", "/cost-codes"],
  reports: ["/reports", "/financial-reports"],
  companies: ["/companies", "/subscription-plans"],
  system: ["/pending-registrations", "/payment-settings", "/dev-tools"],
  settings: ["/settings"],
};

function getRequiredFeature(pathname: string): string | null {
  for (const [feature, prefixes] of Object.entries(routeFeatureMap)) {
    if (prefixes.some((p) => pathname.startsWith(p))) return feature;
  }
  return null;
}

function FeatureGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const features = useAllFeatureAccess();
  const location = useLocation();
  const nav = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["current-profile-company", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
      return data ?? null;
    },
    enabled: !!user?.id,
  });

  const hasCompany = !!((profile as { company_id: string | null } | null)?.company_id);
  const requiredFeature = getRequiredFeature(location.pathname);

  if (requiredFeature && hasCompany && features[requiredFeature] === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-amber-100 p-4">
          <ShieldAlert className="h-10 w-10 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold">Feature Not Available</h1>
        <p className="max-w-md text-muted-foreground">
          Your current subscription plan does not include this feature.
        </p>
        <Button asChild variant="outline">
          <Link to="/settings?tab=plan">View Plan Details</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function PlanExpiryGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";

  const { data: profile } = useQuery({
    queryKey: ["current-profile-expiry", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
      return data ?? null;
    },
    enabled: isStaff && !!user?.id,
  });

  const companyId = (profile as { company_id: string | null } | null)?.company_id;

  const { data: planStatus } = useQuery({
    queryKey: ["company-plan-status-guard", companyId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_company_plan_status");
      return (data as any[])?.[0] ?? null;
    },
    enabled: isStaff && !!companyId,
    refetchInterval: 60_000,
  });

  const isExpired = planStatus?.is_expired === true;

  if (isExpired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-full bg-red-100 p-4">
          <X className="h-10 w-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold">Plan Expired</h1>
        <p className="max-w-md text-muted-foreground">
          Your {planStatus.plan_name || "subscription"} plan has expired. Some features are now restricted.
        </p>
        {planStatus.plan_expires_at && (
          <p className="text-sm text-muted-foreground">
            Expired on {new Date(planStatus.plan_expires_at).toLocaleDateString()}
          </p>
        )}
        <div className="flex gap-3 mt-2">
          <Button asChild variant="outline">
            <Link to="/settings?tab=plan">View Plan Details</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AuthLayout() {
  const { user, loading } = useAuth();
  const role = useHighestRole();
  const ws = getWorkspace(role);
  const nav = useNavigate();
  const WsIcon = ws.icon;

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading your portal…</div>;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full" data-workspace={role ?? "admin"}>
        <style>{`
          [data-workspace="${role ?? "admin"}"] {
            --ws-accent: ${ws.accent};
            --ws-accent-foreground: ${ws.accentForeground};
            --ws-accent-light: ${ws.accentLight};
          }
        `}</style>
        <PlanExpiryGuard>
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <header
              className="flex h-14 items-center gap-3 border-b px-4 backdrop-blur"
              style={{ borderColor: "var(--color-border)", background: "var(--color-background)" }}
            >
              <SidebarTrigger />
              <CommandMenu />
              <div className="ml-auto flex items-center gap-3 text-sm">
                <div
                  className="hidden items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider sm:inline-flex"
                  style={{ background: ws.accentLight, color: ws.accent }}
                >
                  <WsIcon className="h-3 w-3" />
                  {ws.name}
                </div>
                <span className="text-muted-foreground">{ws.badge}</span>
              </div>
            </header>
            <main className="flex-1 bg-secondary/30 p-6">
              <FeatureGate>
                <Outlet />
              </FeatureGate>
            </main>
          </div>
        </PlanExpiryGuard>
      </div>
    </SidebarProvider>
  );
}
