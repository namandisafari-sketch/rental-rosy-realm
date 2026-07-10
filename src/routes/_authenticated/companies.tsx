import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Plus, Pencil, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";

export const Route = createFileRoute("/_authenticated/companies")({
  head: () => ({ meta: [{ title: "Companies — Habico Portal" }] }),
  component: CompaniesPage,
});

type Company = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  license_key: string | null;
  is_active: boolean;
  created_at: string;
};

type CompanyBranding = {
  id: string;
  company_id: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  document_footer: string | null;
  receipt_footer: string | null;
  company_name_override: string | null;
};

function CompaniesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const role = useHighestRole();
  const isAdmin = role === "admin" || role === "manager";
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [editBranding, setEditBranding] = useState<CompanyBranding | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [brandingDialogOpen, setBrandingDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Company[];
    },
    enabled: !!isAdmin,
  });

  const { data: branding } = useQuery({
    queryKey: ["company-branding", selectedCompanyId],
    queryFn: async () => {
      if (!selectedCompanyId) return null;
      const { data, error } = await supabase
        .from("company_branding")
        .select("*")
        .eq("company_id", selectedCompanyId)
        .single();
      if (error) throw error;
      return data as CompanyBranding;
    },
    enabled: !!selectedCompanyId && !!isAdmin,
  });

  const saveCompanyMutation = useMutation({
    mutationFn: async (vals: Partial<Company> & { id?: string }) => {
      if (vals.id) {
        const { error } = await supabase.from("companies").update(vals).eq("id", vals.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert(vals);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company saved");
      setDialogOpen(false);
      setEditCompany(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save"),
  });

  const saveBrandingMutation = useMutation({
    mutationFn: async (vals: Partial<CompanyBranding> & { company_id: string }) => {
      const existing = await supabase.from("company_branding").select("id").eq("company_id", vals.company_id).single();
      if (existing.data) {
        const { error } = await supabase.from("company_branding").update(vals).eq("company_id", vals.company_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_branding").insert(vals);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-branding", selectedCompanyId] });
      toast.success("Branding saved");
      setBrandingDialogOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save branding"),
  });

  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", license_key: "" });

  function openNew() {
    setForm({ name: "", email: "", phone: "", address: "", license_key: "" });
    setEditCompany(null);
    setDialogOpen(true);
  }

  function openEdit(c: Company) {
    setForm({ name: c.name, email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", license_key: c.license_key ?? "" });
    setEditCompany(c);
    setDialogOpen(true);
  }

  function openBranding(companyId: string) {
    setSelectedCompanyId(companyId);
    setBrandingDialogOpen(true);
  }

  if (!isAdmin) {
    return <div className="flex h-96 items-center justify-center"><p className="text-muted-foreground">Access denied.</p></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Licensed Companies</h1>
          <p className="text-sm text-muted-foreground">Property management companies licensed to use Habico Portal</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Add Company</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : companies.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No companies yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <div className="text-sm">{c.email}</div>
                      <div className="text-xs text-muted-foreground">{c.phone}</div>
                    </TableCell>
                    <TableCell><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{c.license_key ?? "—"}</code></TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${c.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openBranding(c.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                          <Building2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Company Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editCompany ? "Edit Company" : "Add Company"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Company Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>License Key</Label>
              <Input value={form.license_key} onChange={(e) => setForm({ ...form, license_key: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => saveCompanyMutation.mutate({ id: editCompany?.id, ...form, is_active: editCompany?.is_active ?? true })} disabled={!form.name || saveCompanyMutation.isPending}>
                {saveCompanyMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Branding Dialog */}
      <Dialog open={brandingDialogOpen} onOpenChange={setBrandingDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Branding Settings</DialogTitle></DialogHeader>
          {branding && (
            <BrandingForm
              branding={branding}
              onSave={(vals) => saveBrandingMutation.mutate({ ...vals, company_id: selectedCompanyId! })}
              isPending={saveBrandingMutation.isPending}
              previewRef={previewRef}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BrandingForm({
  branding,
  onSave,
  isPending,
  previewRef,
}: {
  branding: CompanyBranding;
  onSave: (vals: Partial<CompanyBranding>) => void;
  isPending: boolean;
  previewRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [logoUrl, setLogoUrl] = useState(branding.logo_url ?? "");
  const [primaryColor, setPrimaryColor] = useState(branding.primary_color);
  const [secondaryColor, setSecondaryColor] = useState(branding.secondary_color);
  const [accentColor, setAccentColor] = useState(branding.accent_color);
  const [docFooter, setDocFooter] = useState(branding.document_footer ?? "");
  const [recFooter, setRecFooter] = useState(branding.receipt_footer ?? "");
  const [nameOverride, setNameOverride] = useState(branding.company_name_override ?? "");

  async function downloadPreview() {
    if (!previewRef.current) return;
    try {
      const imgData = await toPng(previewRef.current, { backgroundColor: "#fff" });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (previewRef.current.scrollHeight * imgW) / previewRef.current.scrollWidth;
      pdf.addImage(imgData, "PNG", margin, margin, imgW, imgH);
      pdf.save("branding-preview.pdf");
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="colors">
        <TabsList>
          <TabsTrigger value="colors">Colors & Logo</TabsTrigger>
          <TabsTrigger value="footer">Document Footers</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="colors" className="space-y-4 pt-4">
          <div>
            <Label>Logo URL</Label>
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Primary Color</Label>
              <div className="mt-1 flex gap-2">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border" />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div>
              <Label>Secondary Color</Label>
              <div className="mt-1 flex gap-2">
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border" />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
            <div>
              <Label>Accent Color</Label>
              <div className="mt-1 flex gap-2">
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded border" />
                <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
          </div>
          <div>
            <Label>Company Name Override (optional)</Label>
            <Input value={nameOverride} onChange={(e) => setNameOverride(e.target.value)} placeholder="Leave blank to use the company name" />
          </div>
        </TabsContent>

        <TabsContent value="footer" className="space-y-4 pt-4">
          <div>
            <Label>Document Footer</Label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
              rows={3}
              value={docFooter}
              onChange={(e) => setDocFooter(e.target.value)}
              placeholder="Footer text for PDF documents (tenancy agreements, etc.)"
            />
          </div>
          <div>
            <Label>Receipt Footer</Label>
            <textarea
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
              rows={3}
              value={recFooter}
              onChange={(e) => setRecFooter(e.target.value)}
              placeholder="Footer text for receipts"
            />
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={downloadPreview}>
              Download Preview PDF
            </Button>
          </div>
          <div ref={previewRef} className="rounded-lg border bg-white p-6 text-xs leading-relaxed text-black shadow-sm" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
            <div className="text-center border-b-2 border-black pb-3 mb-3">
              {logoUrl && <img src={logoUrl} alt="Logo" className="mx-auto mb-2 h-12 w-auto object-contain" />}
              <h1 className="text-lg font-bold tracking-wider" style={{ color: primaryColor }}>{nameOverride || branding.company_name_override || "COMPANY NAME"}</h1>
              <p className="text-xs" style={{ color: primaryColor }}>PROPERTY MANAGERS</p>
            </div>
            <p className="mb-2 font-bold" style={{ color: primaryColor }}>TENANCY AGREEMENT PREVIEW</p>
            <p className="mb-4">This is a sample document showing how your branding will appear on tenancy agreements, financial reports, and receipts.</p>
            <table className="w-full border-collapse mb-4">
              <thead>
                <tr>
                  <th className="border p-1.5 text-left text-xs font-bold" style={{ background: primaryColor, color: "#fff" }}>Item</th>
                  <th className="border p-1.5 text-right text-xs font-bold" style={{ background: primaryColor, color: "#fff" }}>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border p-1.5">Sample Rent</td><td className="border p-1.5 text-right">UGX 1,500,000</td></tr>
                <tr><td className="border p-1.5">Deposit</td><td className="border p-1.5 text-right">UGX 750,000</td></tr>
              </tbody>
            </table>
            {docFooter && <p className="mt-4 text-xs text-center" style={{ color: primaryColor }}>{docFooter}</p>}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={() => onSave({
          logo_url: logoUrl || null,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          document_footer: docFooter || null,
          receipt_footer: recFooter || null,
          company_name_override: nameOverride || null,
        })} disabled={isPending}>
          {isPending ? "Saving..." : "Save Branding"}
        </Button>
      </div>
    </div>
  );
}
