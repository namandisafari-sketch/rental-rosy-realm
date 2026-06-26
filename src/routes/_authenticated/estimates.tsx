import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, TrendingUp, Clock, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estimates")({
  head: () => ({ meta: [{ title: "Estimates — Habico Portal" }] }),
  component: EstimatesPage,
});

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusOptions = ["draft", "pending", "approved", "rejected"];

function EstimatesPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "", lead_id: "", estimate_number: "", title: "", description: "",
    status: "draft", subtotal: "", tax_rate: "", tax_amount: "", total_amount: "",
    valid_until: "", notes: "",
  });
  const [items, setItems] = useState<any[]>([]);

  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ["estimates"],
    queryFn: async () => {
      const { data, error } = await supabase.from("estimates").select("*, estimate_items(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const resetForm = () => {
    setForm({
      project_id: "", lead_id: "", estimate_number: "", title: "", description: "",
      status: "draft", subtotal: "", tax_rate: "", tax_amount: "", total_amount: "",
      valid_until: "", notes: "",
    });
    setItems([]);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      project_id: p.project_id ?? "", lead_id: p.lead_id ?? "", estimate_number: p.estimate_number ?? "",
      title: p.title ?? "", description: p.description ?? "", status: p.status ?? "draft",
      subtotal: p.subtotal != null ? String(p.subtotal) : "",
      tax_rate: p.tax_rate != null ? String(p.tax_rate) : "",
      tax_amount: p.tax_amount != null ? String(p.tax_amount) : "",
      total_amount: p.total_amount != null ? String(p.total_amount) : "",
      valid_until: p.valid_until ?? "", notes: p.notes ?? "",
    });
    setItems(p.estimate_items ?? []);
    setOpen(true);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit_price: 0, amount: 0 }]);
  };

  const updateItem = (i: number, field: string, value: any) => {
    const copy = [...items];
    copy[i] = { ...copy[i], [field]: value };
    if (field === "quantity" || field === "unit_price") {
      copy[i].amount = Number(copy[i].quantity) * Number(copy[i].unit_price);
    }
    setItems(copy);
  };

  const removeItem = (i: number) => {
    setItems(items.filter((_, idx) => idx !== i));
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data: est, error } = await supabase.from("estimates").insert({
        project_id: form.project_id || null, lead_id: form.lead_id || null,
        estimate_number: form.estimate_number || null, title: form.title, description: form.description || null,
        status: form.status, subtotal: form.subtotal ? Number(form.subtotal) : 0,
        tax_rate: form.tax_rate ? Number(form.tax_rate) : 0,
        tax_amount: form.tax_amount ? Number(form.tax_amount) : 0,
        total_amount: form.total_amount ? Number(form.total_amount) : 0,
        valid_until: form.valid_until || null, notes: form.notes || null,
      }).select("id").single();
      if (error) throw error;
      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from("estimate_items").insert(
          items.map((it) => ({ estimate_id: est.id, description: it.description, quantity: it.quantity, unit_price: it.unit_price, amount: it.amount }))
        );
        if (itemsErr) throw itemsErr;
      }
    },
    onSuccess: () => { toast.success("Estimate created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["estimates"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("estimates").update({
        project_id: form.project_id || null, lead_id: form.lead_id || null,
        estimate_number: form.estimate_number || null, title: form.title, description: form.description || null,
        status: form.status, subtotal: form.subtotal ? Number(form.subtotal) : 0,
        tax_rate: form.tax_rate ? Number(form.tax_rate) : 0,
        tax_amount: form.tax_amount ? Number(form.tax_amount) : 0,
        total_amount: form.total_amount ? Number(form.total_amount) : 0,
        valid_until: form.valid_until || null, notes: form.notes || null,
      }).eq("id", editing.id);
      if (error) throw error;
      await supabase.from("estimate_items").delete().eq("estimate_id", editing.id);
      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from("estimate_items").insert(
          items.map((it) => ({ estimate_id: editing.id, description: it.description, quantity: it.quantity, unit_price: it.unit_price, amount: it.amount }))
        );
        if (itemsErr) throw itemsErr;
      }
    },
    onSuccess: () => { toast.success("Estimate updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["estimates"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteEstimate = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("estimate_items").delete().eq("estimate_id", id);
      const { error } = await supabase.from("estimates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Estimate deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["estimates"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalEstimates = estimates.length;
  const approvedTotal = estimates.filter((p: any) => p.status === "approved").reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0);
  const pendingEstimates = estimates.filter((p: any) => p.status === "pending").length;
  const approvalRate = estimates.length > 0 ? Math.round((estimates.filter((p: any) => p.status === "approved").length / estimates.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Preconstruction</div>
          <h1 className="display text-3xl font-bold">Estimates</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit estimate" : "New estimate"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader><DialogTitle>{editing ? "Edit estimate" : "Create an estimate"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Project ID</Label><Input value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} /></div>
                  <div><Label>Lead ID</Label><Input value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Estimate number</Label><Input value={form.estimate_number} onChange={(e) => setForm({ ...form, estimate_number: e.target.value })} /></div>
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Subtotal (UGX)</Label><Input type="number" value={form.subtotal} onChange={(e) => setForm({ ...form, subtotal: e.target.value })} /></div>
                  <div><Label>Tax rate (%)</Label><Input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tax amount (UGX)</Label><Input type="number" value={form.tax_amount} onChange={(e) => setForm({ ...form, tax_amount: e.target.value })} /></div>
                  <div><Label>Total (UGX)</Label><Input type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} /></div>
                </div>
                <div><Label>Valid until</Label><Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
                <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Line items</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="mr-1 h-3 w-3" />Add item</Button>
                  </div>
                  {items.map((item, i) => (
                    <div key={i} className="flex items-end gap-2 rounded-md border p-2">
                      <div className="flex-1">
                        <Label className="text-xs">Description</Label>
                        <Input value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                      </div>
                      <div className="w-20">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" value={item.quantity} onChange={(e) => updateItem(i, "quantity", Number(e.target.value))} />
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">Unit price</Label>
                        <Input type="number" value={item.unit_price} onChange={(e) => updateItem(i, "unit_price", Number(e.target.value))} />
                      </div>
                      <div className="w-24">
                        <Label className="text-xs">Amount</Label>
                        <Input type="number" value={item.amount} readOnly className="bg-muted" />
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => (editing ? update : create).mutate()} disabled={!form.title || create.isPending || update.isPending}>
                  {(create.isPending || update.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? "Save" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Estimates</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalEstimates}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Approved Total</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">UGX {approvedTotal.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pending</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{pendingEstimates}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Approval Rate</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{approvalRate}%</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All estimates</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : estimates.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No estimates yet. {isStaff ? "Create your first estimate." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>Est. #</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Valid until</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {estimates.map((p: any) => (
                  <TableRow key={p.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(p)}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.estimate_number ?? "—"}</TableCell>
                    <TableCell><Badge className={cn("border-0", statusColor[p.status])} variant="outline">{p.status?.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-right">UGX {Number(p.total_amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.valid_until ?? "—"}</TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === p.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(p.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete estimate?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{p.title}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteEstimate.mutate(p.id)} disabled={deleteEstimate.isPending}>
                                {deleteEstimate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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
