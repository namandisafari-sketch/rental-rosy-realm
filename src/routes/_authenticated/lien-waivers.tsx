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
import { Plus, FileSignature, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lien-waivers")({
  head: () => ({ meta: [{ title: "Lien Waivers — Habico Portal" }] }),
  component: LienWaiversPage,
});

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  signed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  received: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const statusOptions = ["pending", "signed", "received"];
const waiverTypeOptions = ["partial", "final"];

function LienWaiversPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "", supplier_id: "", waiver_type: "partial", amount: "0",
    status: "pending", signed_date: "", notes: "",
  });

  const { data: waivers = [], isLoading } = useQuery({
    queryKey: ["lien-waivers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lien_waivers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => setForm({
    project_id: "", supplier_id: "", waiver_type: "partial", amount: "0",
    status: "pending", signed_date: "", notes: "",
  });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      project_id: p.project_id ?? "", supplier_id: p.supplier_id ?? "",
      waiver_type: p.waiver_type ?? "partial", amount: String(p.amount ?? "0"),
      status: p.status ?? "pending", signed_date: p.signed_date ?? "", notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lien_waivers").insert({
        project_id: form.project_id || null, supplier_id: form.supplier_id || null,
        waiver_type: form.waiver_type, amount: Number(form.amount),
        status: form.status, signed_date: form.signed_date || null, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lien waiver created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["lien-waivers"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lien_waivers").update({
        project_id: form.project_id || null, supplier_id: form.supplier_id || null,
        waiver_type: form.waiver_type, amount: Number(form.amount),
        status: form.status, signed_date: form.signed_date || null, notes: form.notes || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lien waiver updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["lien-waivers"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteWaiver = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lien_waivers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lien waiver deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["lien-waivers"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalWaivers = waivers.length;
  const signedWaivers = waivers.filter((p: any) => p.status === "signed" || p.status === "received").length;
  const pendingWaivers = waivers.filter((p: any) => p.status === "pending").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Financial Management</div>
          <h1 className="display text-3xl font-bold">Lien Waivers</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit lien waiver" : "New lien waiver"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit lien waiver" : "Create a lien waiver"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Project ID</Label><Input value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} /></div>
                  <div><Label>Supplier ID</Label><Input value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} /></div>
                </div>
                <div><Label>Waiver type</Label>
                  <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.waiver_type} onChange={(e) => setForm({ ...form, waiver_type: e.target.value })}>
                    {waiverTypeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div><Label>Status</Label>
                  <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {statusOptions.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                  </select>
                </div>
                <div><Label>Signed date</Label><Input type="date" value={form.signed_date} onChange={(e) => setForm({ ...form, signed_date: e.target.value })} /></div>
                <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Waivers</CardTitle><FileSignature className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalWaivers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Signed / Received</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{signedWaivers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pending</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{pendingWaivers}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All lien waivers</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : waivers.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No lien waivers yet. {isStaff ? "Create your first lien waiver." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Type</TableHead><TableHead>Supplier</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead>Signed date</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {waivers.map((p: any) => (
                  <TableRow key={p.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(p)}>
                    <TableCell className="font-medium">{p.waiver_type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.supplier_id ?? "—"}</TableCell>
                    <TableCell className="text-right">UGX {Number(p.amount || 0).toLocaleString()}</TableCell>
                    <TableCell><Badge className={cn("border-0", statusColor[p.status])} variant="outline">{p.status}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.signed_date ?? "—"}</TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === p.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(p.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete lien waiver?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this lien waiver. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteWaiver.mutate(p.id)} disabled={deleteWaiver.isPending}>
                                {deleteWaiver.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
