import { createFileRoute } from "@tanstack/react-router";
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
import { Palette, FileText, User, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Habico Portal" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, roles } = useAuth();
  const { data: companyId } = useCompanyId();
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

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><User className="mr-2 h-4 w-4" /> Profile</TabsTrigger>
          {companyId && <TabsTrigger value="branding"><Palette className="mr-2 h-4 w-4" /> Branding</TabsTrigger>}
          {companyId && <TabsTrigger value="templates"><FileText className="mr-2 h-4 w-4" /> Templates</TabsTrigger>}
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
