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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, PackageOpen, TrendingUp, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bid-packages")({
  head: () => ({ meta: [{ title: "Bid Packages — Habico Portal" }] }),
  component: BidPackagesPage,
});

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  under_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  awarded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusOptions = ["draft", "sent", "under_review", "awarded", "closed"];

function BidPackagesPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "", title: "", description: "", status: "draft",
    due_date: "", estimated_budget: "", actual_award: "", awarded_to: "", notes: "",
  });

  const { data: bidPackages = [], isLoading } = useQuery({
    queryKey: ["bid_packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bid_packages").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const resetForm = () => setForm({
    project_id: "", title: "", description: "", status: "draft",
    due_date: "", estimated_budget: "", actual_award: "", awarded_to: "", notes: "",
  });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      project_id: p.project_id ?? "", title: p.title ?? "", description: p.description ?? "",
      status: p.status ?? "draft", due_date: p.due_date ?? "",
      estimated_budget: p.estimated_budget != null ? String(p.estimated_budget) : "",
      actual_award: p.actual_award != null ? String(p.actual_award) : "",
      awarded_to: p.awarded_to ?? "", notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bid_packages").insert({
        project_id: form.project_id || null, title: form.title, description: form.description || null,
        status: form.status, due_date: form.due_date || null,
        estimated_budget: form.estimated_budget ? Number(form.estimated_budget) : null,
        actual_award: form.actual_award ? Number(form.actual_award) : null,
        awarded_to: form.awarded_to || null, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Bid package created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["bid_packages"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bid_packages").update({
        project_id: form.project_id || null, title: form.title, description: form.description || null,
        status: form.status, due_date: form.due_date || null,
        estimated_budget: form.estimated_budget ? Number(form.estimated_budget) : null,
        actual_award: form.actual_award ? Number(form.actual_award) : null,
        awarded_to: form.awarded_to || null, notes: form.notes || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Bid package updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["bid_packages"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteBidPackage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bid_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Bid package deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["bid_packages"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalPackages = bidPackages.length;
  const awardedValue = bidPackages.filter((p: any) => p.status === "awarded").reduce((s: number, p: any) => s + Number(p.actual_award || 0), 0);
  const pendingPackages = bidPackages.filter((p: any) => p.status === "sent" || p.status === "under_review").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Preconstruction</div>
          <h1 className="display text-3xl font-bold">Bid Packages</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit bid package" : "New bid package"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit bid package" : "Create a bid package"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Package Information</h3></div>
                  <div><Label>Title <span className="text-destructive">*</span></Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Bid package title or scope name" /></div>
                  <div className="mt-3"><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detailed description of the work package" /></div>
                  <div className="mt-3"><Label>Project ID</Label><Input value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} placeholder="Reference project ID" /></div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Bid Details</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                    <div><Label>Estimated budget (UGX)</Label><Input type="number" value={form.estimated_budget} onChange={(e) => setForm({ ...form, estimated_budget: e.target.value })} placeholder="Estimated budget range" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div><Label>Actual award (UGX)</Label><Input type="number" value={form.actual_award} onChange={(e) => setForm({ ...form, actual_award: e.target.value })} placeholder="Final awarded amount" /></div>
                    <div><Label>Awarded to</Label><Input value={form.awarded_to} onChange={(e) => setForm({ ...form, awarded_to: e.target.value })} placeholder="Contractor or vendor awarded the bid" /></div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Status &amp; Notes</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Status</Label>
                      <SearchableSelect
                        value={form.status}
                        onValueChange={(v) => setForm({ ...form, status: v })}
                        placeholder="Select status"
                        options={statusOptions.map((s) => ({ value: s, label: s.replace("_", " ") }))}
                      />
                    </div>
                  </div>
                  <div className="mt-3"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes regarding this bid package" /></div>
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
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Packages</CardTitle><PackageOpen className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalPackages}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Awarded Value</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">UGX {awardedValue.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pending</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{pendingPackages}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Avg. Award</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">
            {totalPackages > 0 ? `UGX ${Math.round(awardedValue / totalPackages).toLocaleString()}` : "UGX 0"}
          </div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All bid packages</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : bidPackages.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No bid packages yet. {isStaff ? "Create your first bid package." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>Project</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Est. budget</TableHead><TableHead className="text-right">Award</TableHead><TableHead>Due date</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {bidPackages.map((p: any) => (
                  <TableRow key={p.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(p)}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.project_id ?? "—"}</TableCell>
                    <TableCell><Badge className={cn("border-0", statusColor[p.status])} variant="outline">{p.status?.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-right">{p.estimated_budget != null ? `UGX ${Number(p.estimated_budget).toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="text-right">{p.actual_award != null ? `UGX ${Number(p.actual_award).toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.due_date ?? "—"}</TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === p.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(p.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete bid package?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{p.title}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteBidPackage.mutate(p.id)} disabled={deleteBidPackage.isPending}>
                                {deleteBidPackage.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
