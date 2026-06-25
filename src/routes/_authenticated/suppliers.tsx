import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — Habico Portal" }] }),
  component: SuppliersPage,
});

const categoryColors: Record<string, string> = {
  materials: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  equipment: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  services: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  transport: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const statusColors: Record<string, string> = {
  active: "bg-success/15 text-success",
  inactive: "bg-secondary text-muted-foreground",
};

function SuppliersPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const blankForm = {
    name: "", contact_person: "", phone: "", email: "", address: "",
    category: "materials", payment_terms: "", tax_id: "", notes: "", status: "active",
  };
  const [form, setForm] = useState(blankForm);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      name: s.name ?? "",
      contact_person: s.contact_person ?? "",
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      category: s.category ?? "materials",
      payment_terms: s.payment_terms ?? "",
      tax_id: s.tax_id ?? "",
      notes: s.notes ?? "",
      status: s.status ?? "active",
    });
    setOpen(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setOpen(true);
  };

  const upsert = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("suppliers").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Supplier updated" : "Supplier created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("suppliers").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Procurement</div>
          <h1 className="display text-3xl font-bold">Suppliers</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> Add supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader><DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Contact person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Category</Label>
                    <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      <option value="materials">Materials</option>
                      <option value="equipment">Equipment</option>
                      <option value="services">Services</option>
                      <option value="transport">Transport</option>
                    </select>
                  </div>
                  <div><Label>Payment terms</Label><Input value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tax ID</Label><Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} /></div>
                  <div className="flex items-end gap-3 pb-1.5">
                    <div className="flex-1"><Label>Status</Label></div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Inactive</span>
                      <Switch checked={form.status === "active"} onCheckedChange={(v) => setForm({ ...form, status: v ? "active" : "inactive" })} />
                      <span className="text-sm text-muted-foreground">Active</span>
                    </div>
                  </div>
                </div>
                <div><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => upsert.mutate()} disabled={!form.name || upsert.isPending}>
                  {editing ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All suppliers</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : suppliers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground" />
              <div className="font-medium">No suppliers yet</div>
              <div className="text-sm text-muted-foreground">Add your first supplier to begin.</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact person</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  {isStaff && <TableHead className="w-16" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.contact_person ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.phone ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.email ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${categoryColors[s.category] ?? "bg-secondary text-muted-foreground"}`}>
                        {s.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[s.status] ?? "bg-secondary text-muted-foreground"}`}>
                        {s.status}
                      </span>
                    </TableCell>
                    {isStaff && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Switch
                            checked={s.status === "active"}
                            onCheckedChange={(v) => toggleStatus.mutate({ id: s.id, status: v ? "active" : "inactive" })}
                          />
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
