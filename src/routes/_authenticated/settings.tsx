import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useHighestRole } from "@/hooks/use-auth";
import { useCompanyId } from "@/hooks/use-company-id";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload } from "@/components/ui/file-upload";
import { toast } from "sonner";
import { Palette, FileText, User, Shield, Crown, Check, X, Clock, AlertTriangle, ShieldCheck, Download, Lock, Link, RefreshCw, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Habico Portal" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, roles } = useAuth();
  const { data: companyId } = useCompanyId();
  const search = useSearch({ strict: false }) as { tab?: string };
  const [activeTab, setActiveTab] = useState(search.tab || "profile");
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const isSuperAdmin = isStaff && !companyId;
  const qc = useQueryClient();
  const [profile, setProfile] = useState({ full_name: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);

  const { data: profileData } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  if (profileData && !profile.full_name && profileData.full_name) {
    if (profile.full_name === "") {
      setProfile({
        full_name: profileData.full_name ?? "",
        phone: profileData.phone ?? "",
        email: profileData.email ?? user?.email ?? "",
      });
    }
  }

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: profile.full_name, phone: profile.phone }).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-accent">Account</div>
        <h1 className="display text-3xl font-bold">Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); window.history.replaceState(null, "", v === "profile" ? "/settings" : `/settings?tab=${v}`); }}>
        <TabsList>
          <TabsTrigger value="profile"><User className="mr-2 h-4 w-4" /> Profile</TabsTrigger>
          {companyId && <TabsTrigger value="branding"><Palette className="mr-2 h-4 w-4" /> Branding</TabsTrigger>}
          {companyId && <TabsTrigger value="templates"><FileText className="mr-2 h-4 w-4" /> Templates</TabsTrigger>}
          {companyId && <TabsTrigger value="plan"><Crown className="mr-2 h-4 w-4" /> Plan</TabsTrigger>}
          {companyId && <TabsTrigger value="backup"><ShieldCheck className="mr-2 h-4 w-4" /> Backup &amp; Security</TabsTrigger>}
          {companyId && <TabsTrigger value="integrations"><Link className="mr-2 h-4 w-4" /> Integrations</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="roles"><Shield className="mr-2 h-4 w-4" /> Roles</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle className="display">Profile</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div><Label>Full name</Label><Input value={profile.full_name} onChange={(e)=>setProfile({...profile, full_name:e.target.value})} maxLength={100}/></div>
              <div><Label>Email</Label><Input value={profile.email} disabled/></div>
              <div><Label>Phone</Label><Input value={profile.phone} onChange={(e)=>setProfile({...profile, phone:e.target.value})} maxLength={30}/></div>
              <div><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        {companyId && <BrandingTab companyId={companyId} />}
        {companyId && <TemplatesTab companyId={companyId} />}
        {companyId && <PlanTab companyId={companyId} />}
        {companyId && <BackupSecurityTab companyId={companyId} />}
        {companyId && <IntegrationTab companyId={companyId} />}

        {isSuperAdmin && (
          <TabsContent value="roles" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle className="display">Roles</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {roles.length === 0 ? <span className="text-sm text-muted-foreground">No roles assigned.</span> :
                    roles.map((r) => <span key={r} className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">{r}</span>)}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">New accounts start as tenant. A Habico manager will upgrade your role to owner or staff as needed.</p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function BrandingTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();

  const { data: branding } = useQuery({
    queryKey: ["company-branding", companyId],
    queryFn: async () => {
      let { data } = await supabase.from("company_branding").select("*").eq("company_id", companyId).single();
      if (!data) {
        const { data: inserted } = await supabase.from("company_branding").insert({
          company_id: companyId,
          primary_color: "#1a365d",
          secondary_color: "#2d3748",
          accent_color: "#3182ce",
        }).select("id").single();
        if (inserted) {
          const { data: refetch } = await supabase.from("company_branding").select("*").eq("company_id", companyId).single();
          data = refetch;
        }
      }
      return data as any;
    },
  });

  const saveBranding = useMutation({
    mutationFn: async (vals: any) => {
      const existing = await supabase.from("company_branding").select("id").eq("company_id", companyId).single();
      if (existing.data) {
        const { error } = await supabase.from("company_branding").update(vals).eq("company_id", companyId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_branding").insert({ ...vals, company_id: companyId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-branding", companyId] });
      toast.success("Branding saved");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save branding"),
  });

  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1a365d");
  const [secondaryColor, setSecondaryColor] = useState("#2d3748");
  const [accentColor, setAccentColor] = useState("#3182ce");
  const [docFooter, setDocFooter] = useState("");
  const [recFooter, setRecFooter] = useState("");
  const [nameOverride, setNameOverride] = useState("");

  if (branding && !logoUrl && branding.logo_url) {
    setLogoUrl(branding.logo_url ?? "");
    setPrimaryColor(branding.primary_color);
    setSecondaryColor(branding.secondary_color);
    setAccentColor(branding.accent_color);
    setDocFooter(branding.document_footer ?? "");
    setRecFooter(branding.receipt_footer ?? "");
    setNameOverride(branding.company_name_override ?? "");
  }

  return (
    <TabsContent value="branding" className="space-y-4 pt-4">
      <Card>
        <CardHeader><CardTitle className="display">Company Branding</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Logo</Label>
              <FileUpload value={logoUrl} onChange={setLogoUrl} accept="image/*" maxSizeMB={2} label="Upload Logo" />
            </div>
            <div className="space-y-2">
              <Label>Company Name Override</Label>
              <Input value={nameOverride} onChange={(e) => setNameOverride(e.target.value)} placeholder="Leave blank to use company name" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex gap-2">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border" />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secondary Color</Label>
              <div className="flex gap-2">
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border" />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex gap-2">
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border" />
                <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Document Footer</Label>
            <Textarea value={docFooter} onChange={(e) => setDocFooter(e.target.value)} rows={3} placeholder="Footer text for PDF documents (tenancy agreements, etc.)" />
          </div>
          <div className="space-y-2">
            <Label>Receipt Footer</Label>
            <Textarea value={recFooter} onChange={(e) => setRecFooter(e.target.value)} rows={3} placeholder="Footer text for receipts" />
          </div>
          <Button onClick={() => saveBranding.mutate({
            logo_url: logoUrl || null,
            primary_color: primaryColor,
            secondary_color: secondaryColor,
            accent_color: accentColor,
            document_footer: docFooter || null,
            receipt_footer: recFooter || null,
            company_name_override: nameOverride || null,
          })} disabled={saveBranding.isPending}>
            {saveBranding.isPending ? "Saving..." : "Save Branding"}
          </Button>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function PlanTab({ companyId }: { companyId: string }) {
  const { data: planStatus, isLoading } = useQuery({
    queryKey: ["company-plan-status", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_company_plan_status");
      if (error) throw error;
      return (data as any[])?.[0] ?? null;
    },
    enabled: !!companyId,
  });

  const { data: features = [] } = useQuery({
    queryKey: ["plan-features"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plan_features").select("*");
      if (error) throw error;
      return (data ?? []) as { id: string; plan_id: string; feature_key: string; is_enabled: boolean }[];
    },
  });

  const FEATURE_LABELS: Record<string, string> = {
    rental: "Rental Management",
    construction: "Construction",
    construction_financial: "Construction Financial",
    sop: "SOP & Quality",
    reports: "Reports",
    companies: "Companies Management",
    branding: "Company Branding",
    system: "Admin Pages (System)",
    settings: "Settings",
    move_service: "Move In/Out Service",
  };

  const planFeatures = features.filter((f) => f.plan_id === planStatus?.plan_id);

  const expiryDate = planStatus?.plan_expires_at ? new Date(planStatus.plan_expires_at) : null;
  const startDate = planStatus?.plan_started_at ? new Date(planStatus.plan_started_at) : null;

  const expiryStatus = !expiryDate ? "no_expiry" :
    planStatus.is_expired ? "expired" :
    planStatus.days_remaining <= 7 ? "critical" :
    planStatus.days_remaining <= 30 ? "warning" : "active";

  const statusConfig = {
    active: { label: "Active", color: "bg-green-100 text-green-800", icon: Check },
    warning: { label: `Expires in ${planStatus.days_remaining}d`, color: "bg-amber-100 text-amber-800", icon: Clock },
    critical: { label: `Expires in ${planStatus.days_remaining}d`, color: "bg-red-100 text-red-800", icon: AlertTriangle },
    expired: { label: "Expired", color: "bg-red-100 text-red-800", icon: X },
    no_expiry: { label: "No expiry set", color: "bg-gray-100 text-gray-800", icon: Clock },
  };

  const status = statusConfig[expiryStatus];
  const StatusIcon = status.icon;

  return (
    <TabsContent value="plan" className="space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle className="display flex items-center gap-2">
            <Crown className="h-5 w-5 text-accent" />
            {planStatus?.plan_name || "Plan"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading plan info\u2026</p>
          ) : !planStatus?.plan_id ? (
            <p className="text-sm text-muted-foreground">No plan assigned to this company yet.</p>
          ) : (
            <>
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.color}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {status.label}
                  </span>
                </div>
                {startDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Started</span>
                    <span className="text-sm font-medium">{startDate.toLocaleDateString()}</span>
                  </div>
                )}
                {expiryDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Expires</span>
                    <span className="text-sm font-medium">{expiryDate.toLocaleDateString()}</span>
                  </div>
                )}
                {planStatus.plan_slug && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Plan Slug</span>
                    <span className="text-sm font-mono text-muted-foreground">{planStatus.plan_slug}</span>
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium mb-3">Included Features</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                    const pf = planFeatures.find((f) => f.feature_key === key);
                    const enabled = pf?.is_enabled ?? false;
                    return (
                      <div key={key} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                        <div className={`h-4 w-4 rounded-full shrink-0 ${enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-sm">{label}</span>
                        {!enabled && <span className="ml-auto text-[10px] text-muted-foreground">Not included</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function IntegrationTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();

  const { data: qboStatus, isLoading: qboLoading } = useQuery({
    queryKey: ["qbo-status", companyId],
    queryFn: async () => {
      const mod = await import("@/lib/qbo/qbo-oauth.functions");
      return mod.getQboStatus({ data: { companyId } });
    },
    enabled: !!companyId,
  });

  const connectQbo = useMutation({
    mutationFn: async () => {
      const mod = await import("@/lib/qbo/qbo-oauth.functions");
      const result = await mod.getQboAuthUrl();
      const state = result.state;

      const popup = window.open(result.url, "qbo-connect", "width=600,height=700");
      if (!popup) { toast.error("Popup blocked. Allow popups for this site."); return; }

      return new Promise<void>((resolve, reject) => {
        const handler = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if (event.data?.type !== "qbo-callback") return;
          window.removeEventListener("message", handler);
          const { code, realmId } = event.data.payload;
          try {
            await mod.exchangeQboCode({ data: { code, realmId, companyId } });
            qc.invalidateQueries({ queryKey: ["qbo-status", companyId] });
            toast.success("QuickBooks connected successfully");
            resolve();
          } catch (e: any) {
            reject(e);
          }
        };
        window.addEventListener("message", handler);
      });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to connect QuickBooks"),
  });

  const disconnectQbo = useMutation({
    mutationFn: async () => {
      const mod = await import("@/lib/qbo/qbo-oauth.functions");
      await mod.disconnectQbo({ data: { companyId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qbo-status", companyId] });
      toast.success("QuickBooks disconnected");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to disconnect QuickBooks"),
  });

  const runSync = useMutation({
    mutationFn: async () => {
      const mod = await import("@/lib/qbo/qbo-sync.functions");
      return mod.syncQboFull({ data: { companyId } });
    },
    onSuccess: (results: any) => {
      qc.invalidateQueries({ queryKey: ["qbo-status", companyId] });
      const total = Object.values(results).reduce((sum: number, r: any) => sum + (r.records_created || 0) + (r.records_updated || 0), 0);
      toast.success(`Sync complete: ${total} records synced`);
    },
    onError: (e: any) => toast.error(e?.message || "Sync failed"),
  });

  const isConnected = qboStatus?.connected;
  const lastSync = qboStatus?.tokens?.last_sync_at;
  const expiresAt = qboStatus?.tokens?.expires_at;

  return (
    <TabsContent value="integrations" className="space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle className="display flex items-center gap-2">
            <Link className="h-5 w-5 text-accent" />
            QuickBooks Online
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {qboLoading ? (
            <p className="text-sm text-muted-foreground">Loading integration status\u2026</p>
          ) : !isConnected ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your QuickBooks Online account to sync customers, vendors, invoices, and bills.
              </p>
              <Button onClick={() => connectQbo.mutate()} disabled={connectQbo.isPending}>
                {connectQbo.isPending ? "Connecting..." : <><ExternalLink className="mr-2 h-4 w-4" /> Connect QuickBooks</>}
              </Button>
              <p className="text-xs text-muted-foreground">
                You will be redirected to Intuit to authorize access. Make sure popups are allowed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <Check className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">Connected to QuickBooks</p>
                  {lastSync && (
                    <p className="text-xs text-green-600">
                      Last synced: {new Date(lastSync).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => runSync.mutate()} disabled={runSync.isPending}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${runSync.isPending ? "animate-spin" : ""}`} />
                  {runSync.isPending ? "Syncing..." : "Sync now"}
                </Button>
                <Button variant="outline" onClick={() => disconnectQbo.mutate()} disabled={disconnectQbo.isPending}>
                  Disconnect
                </Button>
              </div>
              {expiresAt && (
                <p className="text-xs text-muted-foreground">
                  Token expires: {new Date(expiresAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function TemplatesTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();

  const { data: branding } = useQuery({
    queryKey: ["company-branding", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("company_branding").select("*").eq("company_id", companyId).single();
      return data as any;
    },
  });

  const saveTemplate = useMutation({
    mutationFn: async (vals: { tenancy_agreement_template: string }) => {
      const existing = await supabase.from("company_branding").select("id").eq("company_id", companyId).single();
      if (existing.data) {
        const { error } = await supabase.from("company_branding").update(vals).eq("company_id", companyId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-branding", companyId] });
      toast.success("Template saved");
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save template"),
  });

  const [template, setTemplate] = useState("");

  if (branding && !template && branding.tenancy_agreement_template) {
    setTemplate(branding.tenancy_agreement_template);
  }

  return (
    <TabsContent value="templates" className="space-y-4 pt-4">
      <Card>
        <CardHeader><CardTitle className="display">Tenancy Agreement Template</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Customize the tenancy agreement template. Use HTML with the following placeholders:
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">{"{{tenant_name}}"}</code>,
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">{"{{property_name}}"}</code>,
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">{"{{unit_number}}"}</code>,
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">{"{{monthly_rent}}"}</code>,
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">{"{{deposit}}"}</code>,
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">{"{{start_date}}"}</code>,
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">{"{{company_name}}"}</code>.
          </p>
          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={20}
            placeholder={`<h1>Tenancy Agreement</h1>\n<p>Between {{company_name}} and {{tenant_name}}</p>\n...`}
            className="font-mono text-sm"
          />
          <Button onClick={() => saveTemplate.mutate({ tenancy_agreement_template: template })} disabled={saveTemplate.isPending}>
            {saveTemplate.isPending ? "Saving..." : "Save Template"}
          </Button>
        </CardContent>
      </Card>
    </TabsContent>
  );
}

function BackupSecurityTab({ companyId }: { companyId: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: hasPassword, refetch: refetchHasPassword } = useQuery({
    queryKey: ["has-protect-delete-password", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_protect_delete_password");
      if (error) return false;
      return data === true;
    },
  });

  const handleSetPassword = async () => {
    if (password.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSettingPassword(true);
    try {
      const { error } = await supabase.rpc("set_protect_delete_password", { p_password: password });
      if (error) throw error;
      toast.success("Delete protection password saved");
      setPassword("");
      setConfirmPassword("");
      refetchHasPassword();
    } catch (e: any) {
      toast.error(e?.message || "Failed to set password");
    } finally {
      setSettingPassword(false);
    }
  };

  const handleRemovePassword = async () => {
    if (!confirm("Are you sure you want to remove the delete protection password?")) return;
    setSettingPassword(true);
    try {
      const { error } = await supabase.rpc("set_protect_delete_password", { p_password: "" });
      if (error) throw error;
      toast.success("Delete protection password removed");
      refetchHasPassword();
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove password");
    } finally {
      setSettingPassword(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const mod = await import("@/lib/exportCompanyBackup.functions");
      const result = await mod.exportCompanyBackup();
      if (!result.success) throw new Error("Backup failed");

      const { jsonBase64, jsonSize, mediaUrls, filename } = result.data;

      const jsonStr = atob(jsonBase64);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.json`;
      a.click();
      URL.revokeObjectURL(url);

      if (mediaUrls.length > 0) {
        toast.success(`Exported ${(jsonSize / 1024).toFixed(0)}KB JSON with ${mediaUrls.length} media files referenced. Downloading media separately\u2026`);
        for (const mediaUrl of mediaUrls) {
          try {
            const resp = await fetch(mediaUrl);
            const blob2 = await resp.blob();
            const url2 = URL.createObjectURL(blob2);
            const a2 = document.createElement("a");
            a2.href = url2;
            a2.download = mediaUrl.split("/").pop() || "media";
            a2.click();
            URL.revokeObjectURL(url2);
          } catch {}
        }
      } else {
        toast.success(`Backup exported: ${(jsonSize / 1024).toFixed(0)}KB JSON`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Backup failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <TabsContent value="backup" className="space-y-4 pt-4">
      {/* Protect Delete Password */}
      <Card>
        <CardHeader>
          <CardTitle className="display flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Delete Protection Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set a password that must be entered before any record can be deleted. This prevents accidental data loss.
            {hasPassword && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                <Check className="h-3 w-3" /> Active
              </span>
            )}
          </p>
          <div className="grid gap-4 max-w-sm">
            <div>
              <Label htmlFor="protect-password">
                {hasPassword ? "New password (leave blank to keep current)" : "Password"}
              </Label>
              <Input
                id="protect-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={hasPassword ? "Enter new password" : "Enter delete protection password"}
                minLength={4}
              />
            </div>
            <div>
              <Label htmlFor="protect-confirm">Confirm password</Label>
              <Input
                id="protect-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSetPassword} disabled={settingPassword || !password}>
                {settingPassword ? "Saving..." : hasPassword ? "Update password" : "Set password"}
              </Button>
              {hasPassword && (
                <Button variant="outline" onClick={handleRemovePassword} disabled={settingPassword}>
                  Remove password
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="display flex items-center gap-2">
            <Download className="h-5 w-5 text-muted-foreground" />
            Export Company Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Download all your company data as a JSON file. Media files (photos, images) are downloaded separately.
          </p>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? "Exporting..." : <><Download className="mr-2 h-4 w-4" /> Export backup</>}
          </Button>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
