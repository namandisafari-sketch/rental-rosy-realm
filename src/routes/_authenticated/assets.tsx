// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Monitor, Sofa, Wrench, HardDrive, Building2, ArmchairIcon, Plus, Search, Filter } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assets")({
  head: () => ({ meta: [{ title: "Assets — Habico Portal" }] }),
  component: AssetsPage,
});

const categoryIcons: Record<string, typeof Package> = {
  electronics: Monitor,
  furniture: Sofa,
  appliance: Wrench,
  vehicle: HardDrive,
  equipment: Building2,
  other: Package,
};

const categoryLabels: Record<string, string> = {
  electronics: "Electronics",
  furniture: "Furniture",
  appliance: "Appliance",
  vehicle: "Vehicle",
  equipment: "Equipment",
  other: "Other",
};

const statusColor: Record<string, string> = {
  active: "bg-success/15 text-success border-success/20",
  maintenance: "bg-warning/20 text-warning-foreground border-warning/20",
  disposed: "bg-destructive/15 text-destructive border-destructive/20",
  stored: "bg-secondary text-muted-foreground border-border",
};

const conditionColor: Record<string, string> = {
  new: "bg-success/15 text-success border-success/20",
  good: "bg-primary/15 text-primary border-primary/20",
  fair: "bg-warning/20 text-warning-foreground border-warning/20",
  poor: "bg-destructive/15 text-destructive border-destructive/20",
};

const categories = ["electronics", "furniture", "appliance", "vehicle", "equipment", "other"];
const conditions = ["new", "good", "fair", "poor"];
const statuses = ["active", "maintenance", "disposed", "stored"];

function getCategoryIcon(cat: string) {
  const Icon = categoryIcons[cat] ?? Package;
  return <Icon className="h-4 w-4" />;
}

function AssetsPage() {
  const { user } = useAuth();
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCondition, setFilterCondition] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "other",
    status: "active",
    condition: "good",
    purchase_value: "0",
    current_value: "0",
    purchase_date: "",
    serial_number: "",
    assigned_to: "",
    notes: "",
  });

  const { data: assets = [] } = useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets")
        .select("*, employees(full_name), projects(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-pick"], enabled: isStaff,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      return data ?? [];
    },
  });

  const resetForm = () => {
    setForm({
      name: "", category: "other", status: "active", condition: "good",
      purchase_value: "0", current_value: "0", purchase_date: "",
      serial_number: "", assigned_to: "", notes: "",
    });
    setEditId(null);
  };

  const openEdit = (a: any) => {
    setEditId(a.id);
    setForm({
      name: a.name ?? "",
      category: a.category ?? "other",
      status: a.status ?? "active",
      condition: a.condition ?? "good",
      purchase_value: String(a.purchase_value ?? "0"),
      current_value: String(a.current_value ?? "0"),
      purchase_date: a.purchase_date ?? "",
      serial_number: a.serial_number ?? "",
      assigned_to: a.assigned_to ?? "",
      notes: a.notes ?? "",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        category: form.category,
        status: form.status,
        condition: form.condition,
        purchase_value: Number(form.purchase_value) || 0,
        current_value: Number(form.current_value) || 0,
        purchase_date: form.purchase_date || null,
        serial_number: form.serial_number || null,
        assigned_to: form.assigned_to || null,
        notes: form.notes || null,
      };
      if (editId) {
        const { error } = await supabase.from("assets").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("assets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Asset updated" : "Asset created");
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Asset deleted"); qc.invalidateQueries({ queryKey: ["assets"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const filtered = assets.filter((a: any) => {
    const q = search.toLowerCase();
    if (q && !a.name?.toLowerCase().includes(q) && !a.serial_number?.toLowerCase().includes(q)) return false;
    if (filterCategory && a.category !== filterCategory) return false;
    if (filterCondition && a.condition !== filterCondition) return false;
    return true;
  });

  const totalValue = assets.reduce((s: number, a: any) => s + Number(a.purchase_value ?? 0), 0);
  const bookValue = assets.reduce((s: number, a: any) => s + Number(a.current_value ?? 0), 0);
  const needsRepair = assets.filter((a: any) => a.condition === "poor" || a.status === "maintenance").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Inventory</div>
          <h1 className="display text-3xl font-bold">Assets</h1>
        </div>
        {isStaff && (
          <Sheet open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <SheetTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => resetForm()}>
                <Plus className="mr-2 h-4 w-4" />Add asset
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{editId ? "Edit asset" : "Add a new asset"}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Asset Info</h3></div>
                  <div className="space-y-3">
                    <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Asset name" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Category *</Label>
                        <SearchableSelect
                          value={form.category}
                          onValueChange={(v) => setForm({ ...form, category: v })}
                          placeholder="Select category"
                          options={categories.map((c) => ({ value: c, label: categoryLabels[c] }))}
                        />
                      </div>
                      <div>
                        <Label>Serial / ID #</Label>
                        <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} placeholder="Serial number or asset ID" />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Acquisition</h3></div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Purchase date *</Label>
                        <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
                      </div>
                      <div>
                        <Label>Purchase value (UGX) *</Label>
                        <Input type="number" value={form.purchase_value} onChange={(e) => setForm({ ...form, purchase_value: e.target.value })} placeholder="0" />
                      </div>
                    </div>
                    <div><Label>Supplier / Vendor</Label><Input placeholder="Supplier or vendor name" /></div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Status & Location</h3></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Status</Label>
                      <SearchableSelect
                        value={form.status}
                        onValueChange={(v) => setForm({ ...form, status: v })}
                        placeholder="Select status"
                        options={statuses.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                      />
                    </div>
                    <div>
                      <Label>Condition</Label>
                      <SearchableSelect
                        value={form.condition}
                        onValueChange={(v) => setForm({ ...form, condition: v })}
                        placeholder="Select condition"
                        options={conditions.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label>Assigned to</Label>
                    <SearchableSelect
                      value={form.assigned_to}
                      onValueChange={(v) => setForm({ ...form, assigned_to: v })}
                      placeholder="Unassigned"
                      options={[
                        { value: "", label: "Unassigned" },
                        ...employees.map((e: any) => ({ value: e.id, label: e.full_name ?? e.email }))
                      ]}
                    />
                  </div>
                  <div className="mt-3">
                    <Label>Current value (UGX)</Label>
                    <Input type="number" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })} placeholder="Depreciated value" />
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Notes</h3></div>
                  <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes or maintenance history" />
                </div>
              </div>
              <SheetFooter className="mt-6">
                <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>
                  {editId ? "Update" : "Save"}
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">UGX {totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Book Value</CardTitle>
            <Sofa className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">UGX {bookValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Needs Repair</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{needsRepair}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="display">All assets</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name or serial…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-48 pl-8"
                />
              </div>
              <SearchableSelect
                value={filterCategory}
                onValueChange={setFilterCategory}
                placeholder="All categories"
                options={[
                  { value: "", label: "All categories" },
                  ...categories.map((c) => ({ value: c, label: categoryLabels[c] }))
                ]}
              />
              <SearchableSelect
                value={filterCondition}
                onValueChange={setFilterCondition}
                placeholder="All conditions"
                options={[
                  { value: "", label: "All conditions" },
                  ...conditions.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))
                ]}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <Package className="h-8 w-8" />
              <div className="text-sm">No assets found.</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead className="text-right">Value (UGX)</TableHead>
                  <TableHead>Assigned To</TableHead>
                  {isStaff && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{getCategoryIcon(a.category)}</span>
                        <div>
                          <div className="font-medium">{a.name}</div>
                          {a.serial_number && <div className="text-xs text-muted-foreground">{a.serial_number}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{categoryLabels[a.category] ?? a.category}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor[a.status]}>{a.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={conditionColor[a.condition]}>{a.condition}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      UGX {Number(a.current_value ?? a.purchase_value ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {a.assigned_to ? (
                        <span className="text-sm">{a.employees?.full_name ?? "—"}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {isStaff && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>Edit</Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this asset?")) del.mutate(a.id); }}>Delete</Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
