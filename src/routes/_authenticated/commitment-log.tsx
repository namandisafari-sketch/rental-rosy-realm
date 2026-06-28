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
import { Plus, FileSignature, TrendingUp, TrendingDown, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/commitment-log")({
  head: () => ({ meta: [{ title: "Commitment Log — Habico Portal" }] }),
  component: CommitmentLogPage,
});

const typeOptions = ["subcontract", "purchase_order", "change_order", "other"];

const statusOptions = ["pending", "approved", "executed", "completed"];

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  executed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const typeColor: Record<string, string> = {
  subcontract: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  purchase_order: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  change_order: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

function CommitmentLogPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "", vendor: "", type: "subcontract", description: "",
    amount: "0", budget_line: "", status: "pending",
    executed_date: "", notes: "",
  });

  const { data: commitments = [], isLoading } = useQuery({
    queryKey: ["commitment_log"],
    queryFn: async () => {
      const { data, error } = await supabase.from("commitment_log").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => setForm({
    project_id: "", vendor: "", type: "subcontract", description: "",
    amount: "0", budget_line: "", status: "pending",
    executed_date: "", notes: "",
  });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      project_id: p.project_id ?? "", vendor: p.vendor ?? "", type: p.type ?? "subcontract",
      description: p.description ?? "", amount: String(p.amount ?? "0"),
      budget_line: p.budget_line ?? "", status: p.status ?? "pending",
      executed_date: p.executed_date ?? "", notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("commitment_log").insert({
        project_id: form.project_id, vendor: form.vendor, type: form.type,
        description: form.description || null, amount: Number(form.amount),
        budget_line: form.budget_line || null, status: form.status,
        executed_date: form.executed_date || null, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Commitment created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["commitment_log"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("commitment_log").update({
        project_id: form.project_id, vendor: form.vendor, type: form.type,
        description: form.description || null, amount: Number(form.amount),
        budget_line: form.budget_line || null, status: form.status,
        executed_date: form.executed_date || null, notes: form.notes || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Commitment updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["commitment_log"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteCommitment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commitment_log").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Commitment deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["commitment_log"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalCommitments = commitments.length;
  const executedValue = commitments
    .filter((c: any) => c.status === "executed" || c.status === "completed")
    .reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
  const pendingCount = commitments.filter((c: any) => c.status === "pending").length;
  const totalBudget = commitments.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Financial Control</div>
          <h1 className="display text-3xl font-bold">Commitment Log</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit commitment" : "New commitment"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit commitment" : "Record a commitment"}</DialogTitle></DialogHeader>
              <div className="space-y-5">
                <div>
                  <div className="mb-3 border-b pb-1"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Required Information</span></div>
                  <div><Label>Project ID <span className="text-destructive">*</span></Label><Input value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} placeholder="e.g. a1b2c3d4-..." /></div>
                  <div className="mt-3"><Label>Vendor / Contractor <span className="text-destructive">*</span></Label><Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. ABC Construction Ltd" /></div>
                  <div className="mt-3"><Label>Type <span className="text-destructive">*</span></Label>
                    <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                      {typeOptions.map((s) => <option key={s} value={s}>{s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div className="mt-3"><Label>Amount (UGX) <span className="text-destructive">*</span></Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 50000000" /></div>
                </div>
                <div>
                  <div className="mb-3 border-b pb-1"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Terms & Status</span></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Status</Label>
                      <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        {statusOptions.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    </div>
                    <div><Label>Budget line</Label><Input value={form.budget_line} onChange={(e) => setForm({ ...form, budget_line: e.target.value })} placeholder="e.g. 01-100-STRUCT" /></div>
                  </div>
                  <div className="mt-3"><Label>Executed date</Label><Input type="date" value={form.executed_date} onChange={(e) => setForm({ ...form, executed_date: e.target.value })} /></div>
                </div>
                <div>
                  <div className="mb-3 border-b pb-1"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description & Notes</span></div>
                  <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Scope of work, deliverables, and key terms..." /></div>
                  <div className="mt-3"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes or comments..." /></div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => (editing ? update : create).mutate()} disabled={!form.project_id || !form.vendor || !form.type || !form.amount || Number(form.amount) <= 0 || create.isPending || update.isPending}>
                  {(create.isPending || update.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? "Save changes" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Commitments</CardTitle><FileSignature className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalCommitments}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Executed Value</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">UGX {executedValue.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pending</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{pendingCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Budget</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">UGX {totalBudget.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All commitments</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : commitments.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No commitments yet. {isStaff ? "Record your first commitment." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Vendor</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Executed</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {commitments.map((c: any) => (
                  <TableRow key={c.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(c)}>
                    <TableCell className="font-medium">{c.vendor}</TableCell>
                    <TableCell><Badge className={cn("border-0", typeColor[c.type])} variant="outline">{c.type.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{c.description ?? "—"}</TableCell>
                    <TableCell className="text-right">UGX {Number(c.amount || 0).toLocaleString()}</TableCell>
                    <TableCell><Badge className={cn("border-0", statusColor[c.status])} variant="outline">{c.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.executed_date ?? "—"}</TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === c.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(c.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete commitment?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the commitment with "{c.vendor}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteCommitment.mutate(c.id)} disabled={deleteCommitment.isPending}>
                                {deleteCommitment.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
