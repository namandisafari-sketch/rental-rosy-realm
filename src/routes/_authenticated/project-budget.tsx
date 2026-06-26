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
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, PiggyBank, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/project-budget")({
  head: () => ({ meta: [{ title: "Project Budget — Habico Portal" }] }),
  component: ProjectBudgetPage,
});

function ProjectBudgetPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "", category: "", budgeted: "0", committed: "0", spent: "0", notes: "",
  });

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ["project-budget"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_budgets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => setForm({
    project_id: "", category: "", budgeted: "0", committed: "0", spent: "0", notes: "",
  });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      project_id: p.project_id ?? "", category: p.category ?? "",
      budgeted: String(p.budgeted ?? "0"), committed: String(p.committed ?? "0"),
      spent: String(p.spent ?? "0"), notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_budgets").insert({
        project_id: form.project_id || null, category: form.category || null,
        budgeted: Number(form.budgeted), committed: Number(form.committed),
        spent: Number(form.spent), notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Budget item created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["project-budget"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_budgets").update({
        project_id: form.project_id || null, category: form.category || null,
        budgeted: Number(form.budgeted), committed: Number(form.committed),
        spent: Number(form.spent), notes: form.notes || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Budget item updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["project-budget"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Budget item deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["project-budget"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalBudget = budgets.reduce((s: number, p: any) => s + Number(p.budgeted || 0), 0);
  const totalCommitted = budgets.reduce((s: number, p: any) => s + Number(p.committed || 0), 0);
  const totalSpent = budgets.reduce((s: number, p: any) => s + Number(p.spent || 0), 0);
  const remaining = totalBudget - totalSpent;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Financial Management</div>
          <h1 className="display text-3xl font-bold">Project Budget</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit budget item" : "New budget item"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit budget item" : "Create a budget item"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Project ID</Label><Input value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} /></div>
                <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Budgeted</Label><Input type="number" value={form.budgeted} onChange={(e) => setForm({ ...form, budgeted: e.target.value })} /></div>
                  <div><Label>Committed</Label><Input type="number" value={form.committed} onChange={(e) => setForm({ ...form, committed: e.target.value })} /></div>
                  <div><Label>Spent</Label><Input type="number" value={form.spent} onChange={(e) => setForm({ ...form, spent: e.target.value })} /></div>
                </div>
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
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Budget</CardTitle><PiggyBank className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">UGX {totalBudget.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Committed</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">UGX {totalCommitted.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Spent</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">UGX {totalSpent.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Remaining</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">UGX {remaining.toLocaleString()}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">Budget by category</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : budgets.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No budget items yet. {isStaff ? "Create your first budget item." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Category</TableHead><TableHead className="text-right">Budgeted</TableHead><TableHead className="text-right">Committed</TableHead><TableHead className="text-right">Spent</TableHead><TableHead>Progress</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {budgets.map((p: any) => {
                  const progress = Number(p.budgeted) > 0 ? Math.min(Math.round((Number(p.spent || 0) / Number(p.budgeted)) * 100), 100) : 0;
                  return (
                    <TableRow key={p.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(p)}>
                      <TableCell className="font-medium">{p.category ?? "—"}</TableCell>
                      <TableCell className="text-right">UGX {Number(p.budgeted || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">UGX {Number(p.committed || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">UGX {Number(p.spent || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="h-2 w-20" />
                          <span className="text-xs text-muted-foreground">{progress}%</span>
                        </div>
                      </TableCell>
                      {isStaff && (
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <AlertDialog open={deleteId === p.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                            <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(p.id)}>Delete</Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete budget item?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the "{p.category}" budget item. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteBudget.mutate(p.id)} disabled={deleteBudget.isPending}>
                                  {deleteBudget.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
