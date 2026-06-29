import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileSignature, Link2, UserPlus, CheckCircle, XCircle, Copy, QrCode } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/e-leasing")({
  head: () => ({ meta: [{ title: "E-Leasing — Habico Portal" }] }),
  component: ELeasingPage,
});

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  screening: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const overallSigColors: Record<string, string> = {
  fully_signed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  partially_signed: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  unsigned: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

function StatusBadge({ status }: { status: string }) {
  const color = statusColors[status] ?? "bg-secondary text-muted-foreground";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>;
}

function ELeasingPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [statusUpdate, setStatusUpdate] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ property_id: "", unit_id: "" });

  const { data: applications = [] } = useQuery({
    queryKey: ["rental_applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_applications")
        .select("*, property:property_id(name), unit:unit_id(unit_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("id, name").order("name");
      if (error) throw error;
      return data as any;
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units-all"],
    enabled: isStaff,
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("id, unit_number, property_id").order("unit_number");
      if (error) throw error;
      return data as any;
    },
  });

  const { data: signatures = [] } = useQuery({
    queryKey: ["lease-signatures-view"],
    queryFn: async () => {
      const { data: leasesData, error: lError } = await supabase
        .from("leases")
        .select("id, tenant_id, created_at")
        .order("created_at", { ascending: false });
      if (lError) throw lError;

      const leaseIds = (leasesData ?? []).map((l: any) => l.id);
      const tenantIds = Array.from(new Set((leasesData ?? []).map((l: any) => l.tenant_id)));

      const { data: sigsData } = leaseIds.length
        ? await supabase.from("lease_signatures").select("*").in("lease_id", leaseIds)
        : { data: [] };

      const { data: tenantList } = tenantIds.length
        ? await supabase.from("tenants").select("id, full_name").in("id", tenantIds)
        : { data: [] };

      const profMap = new Map((tenantList ?? []).map((t: any) => [t.id, t]));
      const sigMap = new Map<string, any[]>();
      for (const s of sigsData ?? []) {
        const arr = sigMap.get(s.lease_id) ?? [];
        arr.push(s);
        sigMap.set(s.lease_id, arr);
      }

      return (leasesData ?? []).map((l: any) => {
        const sigs = sigMap.get(l.id) ?? [];
        const managerSig = sigs.find((s: any) => s.signed_by === "manager");
        const tenantSig = sigs.find((s: any) => s.signed_by === "tenant");
        const overall =
          managerSig && tenantSig ? "fully_signed"
          : managerSig || tenantSig ? "partially_signed"
          : "unsigned";
        return {
          lease_id: l.id,
          lease_number: `L-${String(l.id).slice(0, 8).toUpperCase()}`,
          tenant_name: profMap.get(l.tenant_id)?.full_name ?? "Unknown",
          manager_signed: !!managerSig,
          tenant_signed: !!tenantSig,
          overall,
        };
      });
    },
  });

  const { data: listingLinks = [] } = useQuery({
    queryKey: ["rental_application_links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_application_links")
        .select("*, property:property_id(name), unit:unit_id(unit_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any;
    },
  });

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const totalApps = applications.length;
  const pendingReview = applications.filter((a: any) => a.status === "pending").length;
  const approvedThisMonth = applications.filter((a: any) => {
    if (a.status !== "approved") return false;
    const d = new Date(a.updated_at ?? a.created_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  }).length;

  const filteredApps = applications.filter((a: any) => {
    const q = search.toLowerCase();
    return !q || a.full_name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) || a.phone?.toLowerCase().includes(q);
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("rental_applications").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application status updated");
      qc.invalidateQueries({ queryKey: ["rental_applications"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const createTenantFromApp = useMutation({
    mutationFn: async (app: any) => {
      const { error } = await supabase.from("tenants").insert({
        full_name: app.full_name,
        phone: app.phone,
        email: app.email,
        id_type: app.id_type,
        id_number: app.id_number,
        emergency_contact_name: app.emergency_contact_name,
        emergency_contact_phone: app.emergency_contact_phone,
        occupation: app.occupation,
        employer: app.employer,
        monthly_income: app.monthly_income,
        previous_address: app.previous_address,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tenant created from application");
      qc.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const generateLink = useMutation({
    mutationFn: async () => {
      const slug = Math.random().toString(36).substring(2, 10);
      const { error } = await supabase.from("rental_application_links").insert({
        property_id: linkForm.property_id,
        unit_id: linkForm.unit_id || null,
        slug,
        is_active: true,
        click_count: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing link generated");
      setLinkOpen(false);
      setLinkForm({ property_id: "", unit_id: "" });
      qc.invalidateQueries({ queryKey: ["rental_application_links"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleLinkActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("rental_application_links").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link status updated");
      qc.invalidateQueries({ queryKey: ["rental_application_links"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const filteredUnits = linkForm.property_id ? units.filter((u: any) => u.property_id === linkForm.property_id) : [];

  function openDetail(app: any) {
    setSelectedApp(app);
    setStatusUpdate(app.status ?? "pending");
    setDetailOpen(true);
  }

  function handleStatusUpdate() {
    if (!selectedApp) return;
    updateStatus.mutate({ id: selectedApp.id, status: statusUpdate });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => toast.success("Copied")).catch(() => toast.error("Failed to copy"));
  }

  if (!isStaff) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Leasing</div>
          <h1 className="display text-3xl font-bold">E-Leasing</h1>
        </div>
      </div>

      <Tabs defaultValue="applications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="esignatures">eSignatures</TabsTrigger>
          <TabsTrigger value="listing-links">Listing Links</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Applications</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{totalApps}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pending Review</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-amber-600">{pendingReview}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Approved This Month</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-green-600">{approvedThisMonth}</div></CardContent>
            </Card>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email or phone..."
              value={search}
              onChange={(e: any) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant Name</TableHead>
                    <TableHead>Email / Phone</TableHead>
                    <TableHead>Property / Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No applications found</TableCell>
                    </TableRow>
                  ) : (
                    filteredApps.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.full_name || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div>{a.email || "—"}</div>
                          <div>{a.phone || "—"}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.property?.name ?? "—"} {a.unit ? `/ ${a.unit.unit_number}` : ""}
                        </TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(a)}>View</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={detailOpen} onOpenChange={(v) => { setDetailOpen(v); if (!v) setSelectedApp(null); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>Application Details</DialogTitle></DialogHeader>
              {selectedApp && (
                <div className="space-y-4">
                  <div>
                    <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Applicant</h3></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Full Name</Label>
                        <p className="text-sm font-medium">{selectedApp.full_name}</p>
                      </div>
                      <div>
                        <Label>Email</Label>
                        <p className="text-sm">{selectedApp.email}</p>
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <p className="text-sm">{selectedApp.phone}</p>
                      </div>
                      <div>
                        <Label>ID Type</Label>
                        <p className="text-sm">{selectedApp.id_type}</p>
                      </div>
                      <div>
                        <Label>ID Number</Label>
                        <p className="text-sm">{selectedApp.id_number}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Property</h3></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Property / Unit</Label>
                        <p className="text-sm">
                          {selectedApp.property?.name ?? "—"} {selectedApp.unit ? `/ ${selectedApp.unit.unit_number}` : ""}
                        </p>
                      </div>
                      <div>
                        <Label>Status</Label>
                        <div><StatusBadge status={selectedApp.status} /></div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Terms</h3></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Occupation</Label>
                        <p className="text-sm">{selectedApp.occupation || "—"}</p>
                      </div>
                      <div>
                        <Label>Employer</Label>
                        <p className="text-sm">{selectedApp.employer || "—"}</p>
                      </div>
                      <div>
                        <Label>Monthly Income</Label>
                        <p className="text-sm">{selectedApp.monthly_income ? `UGX ${Number(selectedApp.monthly_income).toLocaleString()}` : "—"}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Label>Previous Address</Label>
                      <p className="text-sm">{selectedApp.previous_address || "—"}</p>
                    </div>
                    <div className="mt-3">
                      <Label>Emergency Contact</Label>
                      <p className="text-sm">{selectedApp.emergency_contact_name || "—"} {selectedApp.emergency_contact_phone ? `(${selectedApp.emergency_contact_phone})` : ""}</p>
                    </div>
                  </div>
                  <div>
                    <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Documents &amp; Notes</h3></div>
                    <div>
                      <Label>Notes</Label>
                      <p className="text-sm">{selectedApp.notes || "—"}</p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t pt-2">
                    <Label>Update Status</Label>
                    <div className="flex gap-2">
                      <Select value={statusUpdate} onValueChange={setStatusUpdate}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="screening">Screening</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button onClick={handleStatusUpdate} disabled={updateStatus.isPending || statusUpdate === selectedApp.status}>Update</Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Move the application through the review process.</p>
                  </div>

                  {selectedApp.status === "approved" && (
                    <div className="border-t pt-2">
                      <Button className="w-full" onClick={() => createTenantFromApp.mutate(selectedApp)} disabled={createTenantFromApp.isPending}>
                        <UserPlus className="mr-2 h-4 w-4" /> Create Tenant from Application
                      </Button>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setDetailOpen(false); setSelectedApp(null); }}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="esignatures" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="display">Lease Signatures</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lease #</TableHead>
                    <TableHead>Tenant Name</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Overall Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signatures.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No lease signatures found</TableCell>
                    </TableRow>
                  ) : (
                    signatures.map((s: any) => (
                      <TableRow key={s.lease_id}>
                        <TableCell className="font-mono text-sm">{s.lease_number}</TableCell>
                        <TableCell className="font-medium">{s.tenant_name}</TableCell>
                        <TableCell>
                          {s.manager_signed ? (
                            <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4" /> Signed</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground"><XCircle className="h-4 w-4" /> Pending</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.tenant_signed ? (
                            <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4" /> Signed</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground"><XCircle className="h-4 w-4" /> Pending</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${overallSigColors[s.overall] ?? ""}`}>
                            {s.overall === "fully_signed" ? "Fully Signed" : s.overall === "partially_signed" ? "Partially Signed" : "Unsigned"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listing-links" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={linkOpen} onOpenChange={(v) => { setLinkOpen(v); if (!v) setLinkForm({ property_id: "", unit_id: "" }); }}>
              <DialogTrigger asChild>
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                  <Plus className="mr-2 h-4 w-4" /> Generate Link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Generate Listing Link</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Application Settings</h3></div>
                    <div className="space-y-3">
                      <div>
                        <Label>Property *</Label>
                        <Select value={linkForm.property_id} onValueChange={(v) => setLinkForm({ property_id: v, unit_id: "" })}>
                          <SelectTrigger><SelectValue placeholder="Select property…" /></SelectTrigger>
                          <SelectContent>
                            {properties.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-muted-foreground">The property this listing link refers to.</p>
                      </div>
                      <div>
                        <Label>Unit (optional)</Label>
                        <Select value={linkForm.unit_id} onValueChange={(v) => setLinkForm({ ...linkForm, unit_id: v })} disabled={!linkForm.property_id}>
                          <SelectTrigger><SelectValue placeholder="Select unit…" /></SelectTrigger>
                          <SelectContent>
                            {filteredUnits.map((u: any) => (
                              <SelectItem key={u.id} value={u.id}>Unit {u.unit_number}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="mt-1 text-xs text-muted-foreground">If omitted, applicants can choose from all available units in this property.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => generateLink.mutate()} disabled={!linkForm.property_id || generateLink.isPending}>Generate</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listingLinks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No listing links generated</TableCell>
                    </TableRow>
                  ) : (
                    listingLinks.map((l: any) => {
                      const url = `${window.location.origin}/apply/${l.slug}`;
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="text-sm">{l.property?.name ?? "—"}</TableCell>
                          <TableCell className="text-sm">{l.unit?.unit_number ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{l.slug}</TableCell>
                          <TableCell className="text-sm">
                            <Button variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => copyToClipboard(url)}>
                              <Copy className="mr-1 h-3 w-3" /> Copy
                            </Button>
                          </TableCell>
                          <TableCell className="text-sm">{l.click_count ?? 0}</TableCell>
                          <TableCell>
                            {l.is_active ? (
                              <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle className="h-4 w-4" /> Active</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-muted-foreground"><XCircle className="h-4 w-4" /> Inactive</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleLinkActive.mutate({ id: l.id, is_active: !l.is_active })}
                            >
                              {l.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
