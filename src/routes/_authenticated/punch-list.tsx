// @ts-nocheck
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
import { Plus, ClipboardCheck, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/punch-list")({
  head: () => ({ meta: [{ title: "Punch List — Habico Portal" }] }),
  component: PunchListPage,
});

const statusOptions = ["open", "in_progress", "completed", "verified"];
const priorityOptions = ["low", "medium", "high", "urgent"];

const statusColor: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  verified: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const priorityColor: Record<string, string> = {
  low: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function PunchListPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager" || role === "site_engineer";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "", title: "", description: "", status: "open", priority: "medium",
    assignee: "", due_date: "", completed_date: "", verified_by: "", notes: "",
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["punch-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("punch_list_items").select("*, projects!inner(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => setForm({
    project_id: "", title: "", description: "", status: "open", priority: "medium",
    assignee: "", due_date: "", completed_date: "", verified_by: "", notes: "",
  });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      project_id: p.project_id ?? "",
      title: p.title ?? "",
      description: p.description ?? "",
      status: p.status ?? "open",
      priority: p.priority ?? "medium",
      assignee: p.assignee ?? "",
      due_date: p.due_date ?? "",
      completed_date: p.completed_date ?? "",
      verified_by: p.verified_by ?? "",
      notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("punch_list_items").insert({
        project_id: form.project_id, title: form.title, description: form.description,
        status: form.status, priority: form.priority, assignee: form.assignee || null,
        due_date: form.due_date || null, completed_date: form.completed_date || null,
        verified_by: form.verified_by || null, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Punch list item created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["punch-list"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("punch_list_items").update({
        project_id: form.project_id, title: form.title, description: form.description,
        status: form.status, priority: form.priority, assignee: form.assignee || null,
        due_date: form.due_date || null, completed_date: form.completed_date || null,
        verified_by: form.verified_by || null, notes: form.notes || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Punch list item updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["punch-list"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("punch_list_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Punch list item deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["punch-list"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const now = new Date().toISOString().split("T")[0];
  const totalItems = items.length;
  const openItems = items.filter((p: any) => p.status === "open" || p.status === "in_progress").length;
  const completedItems = items.filter((p: any) => p.status === "completed" || p.status === "verified").length;
  const overdueItems = items.filter((p: any) => p.status !== "completed" && p.status !== "verified" && p.due_date && p.due_date < now).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Quality</div>
          <h1 className="display text-3xl font-bold">Punch List</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit item" : "New item"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit punch list item" : "Add punch list item"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {/* Section: Item Details */}
                <fieldset className="rounded-lg border p-4">
                  <legend className="text-sm font-semibold text-muted-foreground">Item Details</legend>
                  <div className="space-y-3">
                    <div>
                      <Label>Project <span className="text-destructive">*</span></Label>
                      <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                        <option value="">Select a project...</option>
                        {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Title <span className="text-destructive">*</span></Label>
                      <Input placeholder="e.g. Crack in column B-3" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div>
                      <Label>Description <span className="text-destructive">*</span></Label>
                      <Textarea rows={3} placeholder="Detailed description of the issue, including location and observations..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>
                  </div>
                </fieldset>

                {/* Section: Classification */}
                <fieldset className="rounded-lg border p-4">
                  <legend className="text-sm font-semibold text-muted-foreground">Classification</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Status</Label>
                      <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        {statusOptions.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                        {priorityOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                </fieldset>

                {/* Section: Assignment & Dates */}
                <fieldset className="rounded-lg border p-4">
                  <legend className="text-sm font-semibold text-muted-foreground">Assignment &amp; Dates</legend>
                  <div className="space-y-3">
                    <div>
                      <Label>Assignee</Label>
                      <Input placeholder="Full name of responsible person" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Due date</Label>
                        <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                      </div>
                      <div>
                        <Label>Completed date</Label>
                        <Input type="date" value={form.completed_date} onChange={(e) => setForm({ ...form, completed_date: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Verified by</Label>
                      <Input placeholder="Name of person who verified completion" value={form.verified_by} onChange={(e) => setForm({ ...form, verified_by: e.target.value })} />
                    </div>
                  </div>
                </fieldset>

                {/* Section: Notes */}
                <fieldset className="rounded-lg border p-4">
                  <legend className="text-sm font-semibold text-muted-foreground">Additional Notes</legend>
                  <div>
                    <Label>Notes</Label>
                    <Textarea rows={3} placeholder="Any additional remarks, inspection notes, or observations..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                </fieldset>
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => (editing ? update : create).mutate()} disabled={!form.title || !form.description || !form.project_id || create.isPending || update.isPending}>
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
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total items</CardTitle><ClipboardCheck className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalItems}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Open</CardTitle><AlertTriangle className="h-4 w-4 text-yellow-500" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{openItems}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Completed</CardTitle><CheckCircle2 className="h-4 w-4 text-green-500" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{completedItems}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Overdue</CardTitle><Clock className="h-4 w-4 text-red-500" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{overdueItems}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All punch list items</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No punch list items yet. {isStaff ? "Add your first item." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>Project</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Assignee</TableHead><TableHead>Due date</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {items.map((p: any) => (
                  <TableRow key={p.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(p)}>
                    <TableCell className="max-w-[250px] truncate font-medium">{p.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.projects?.name ?? "—"}</TableCell>
                    <TableCell><Badge className={cn("border-0", statusColor[p.status])} variant="outline">{p.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell><Badge className={cn("border-0", priorityColor[p.priority])} variant="outline">{p.priority}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.assignee ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.due_date ? (
                        <span className={p.due_date < now && p.status !== "completed" && p.status !== "verified" ? "font-semibold text-destructive" : ""}>
                          {p.due_date}
                        </span>
                      ) : "—"}
                    </TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === p.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(p.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete punch list item?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{p.title}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteItem.mutate(p.id)} disabled={deleteItem.isPending}>
                                {deleteItem.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
