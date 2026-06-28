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
import { Plus, FileText, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/subcontracts")({
  head: () => ({ meta: [{ title: "Subcontracts — Habico Portal" }] }),
  component: SubcontractsPage,
});

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  terminated: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusOptions = ["draft", "active", "completed", "terminated"];

function SubcontractsPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "", supplier_id: "", contract_number: "", scope_of_work: "",
    contract_amount: "0", start_date: "", end_date: "", status: "draft",
    retention_percent: "0", paid_to_date: "0", notes: "",
  });

  const { data: subcontracts = [], isLoading } = useQuery({
    queryKey: ["subcontracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subcontracts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => setForm({
    project_id: "", supplier_id: "", contract_number: "", scope_of_work: "",
    contract_amount: "0", start_date: "", end_date: "", status: "draft",
    retention_percent: "0", paid_to_date: "0", notes: "",
  });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      project_id: p.project_id ?? "", supplier_id: p.supplier_id ?? "", contract_number: p.contract_number ?? "",
      scope_of_work: p.scope_of_work ?? "", contract_amount: String(p.contract_amount ?? "0"),
      start_date: p.start_date ?? "", end_date: p.end_date ?? "", status: p.status ?? "draft",
      retention_percent: String(p.retention_percent ?? "0"), paid_to_date: String(p.paid_to_date ?? "0"),
      notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subcontracts").insert({
        project_id: form.project_id || null, supplier_id: form.supplier_id || null,
        contract_number: form.contract_number || null, scope_of_work: form.scope_of_work || null,
        contract_amount: Number(form.contract_amount), start_date: form.start_date || null,
        end_date: form.end_date || null, status: form.status,
        retention_percent: Number(form.retention_percent), paid_to_date: Number(form.paid_to_date),
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Subcontract created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["subcontracts"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subcontracts").update({
        project_id: form.project_id || null, supplier_id: form.supplier_id || null,
        contract_number: form.contract_number || null, scope_of_work: form.scope_of_work || null,
        contract_amount: Number(form.contract_amount), start_date: form.start_date || null,
        end_date: form.end_date || null, status: form.status,
        retention_percent: Number(form.retention_percent), paid_to_date: Number(form.paid_to_date),
        notes: form.notes || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Subcontract updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["subcontracts"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteSubcontract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subcontracts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Subcontract deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["subcontracts"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const activeContracts = subcontracts.filter((p: any) => p.status === "active").length;
  const totalValue = subcontracts.reduce((s: number, p: any) => s + Number(p.contract_amount || 0), 0);
  const totalPaid = subcontracts.reduce((s: number, p: any) => s + Number(p.paid_to_date || 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Financial Management</div>
          <h1 className="display text-3xl font-bold">Subcontracts</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit subcontract" : "New subcontract"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit subcontract" : "Create a subcontract"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Contract Information</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Contract number <span className="text-destructive">*</span></Label><Input value={form.contract_number} onChange={(e) => setForm({ ...form, contract_number: e.target.value })} placeholder="e.g. SC-001" /></div>
                    <div><Label>Project ID</Label><Input value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} placeholder="Reference project ID" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div><Label>Supplier ID</Label><Input value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} placeholder="Associated supplier or vendor ID" /></div>
                  </div>
                  <div className="mt-3"><Label>Scope of work <span className="text-destructive">*</span></Label><Textarea rows={3} value={form.scope_of_work} onChange={(e) => setForm({ ...form, scope_of_work: e.target.value })} placeholder="Detailed description of the contracted work" /></div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Financial Details</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Contract amount (UGX)</Label><Input type="number" value={form.contract_amount} onChange={(e) => setForm({ ...form, contract_amount: e.target.value })} placeholder="Total contract value" /></div>
                    <div><Label>Retention (%)</Label><Input type="number" value={form.retention_percent} onChange={(e) => setForm({ ...form, retention_percent: e.target.value })} placeholder="e.g. 10" /></div>
                  </div>
                  <div className="mt-3"><Label>Paid to date (UGX)</Label><Input type="number" value={form.paid_to_date} onChange={(e) => setForm({ ...form, paid_to_date: e.target.value })} placeholder="Total amount paid so far" /></div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Dates &amp; Status</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                    <div><Label>End date</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                  </div>
                  <div className="mt-3"><Label>Status</Label>
                    <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      {statusOptions.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Notes</h3></div>
                  <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Special terms, conditions, or remarks" /></div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => (editing ? update : create).mutate()} disabled={create.isPending || update.isPending}>
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
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Active Contracts</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{activeContracts}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Value</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">UGX {totalValue.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Paid to Date</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">UGX {totalPaid.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All subcontracts</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : subcontracts.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No subcontracts yet. {isStaff ? "Create your first subcontract." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Contract #</TableHead><TableHead>Scope</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Paid</TableHead><TableHead>Dates</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {subcontracts.map((p: any) => (
                  <TableRow key={p.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(p)}>
                    <TableCell className="font-medium">{p.contract_number ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.scope_of_work ? p.scope_of_work.substring(0, 50) + (p.scope_of_work.length > 50 ? "…" : "") : "—"}</TableCell>
                    <TableCell><Badge className={cn("border-0", statusColor[p.status])} variant="outline">{p.status}</Badge></TableCell>
                    <TableCell className="text-right">UGX {Number(p.contract_amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">UGX {Number(p.paid_to_date || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.start_date && <div>Start: {p.start_date}</div>}
                      {p.end_date && <div>End: {p.end_date}</div>}
                    </TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === p.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(p.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete subcontract?</AlertDialogTitle><AlertDialogDescription>This will permanently delete subcontract "{p.contract_number}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteSubcontract.mutate(p.id)} disabled={deleteSubcontract.isPending}>
                                {deleteSubcontract.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
