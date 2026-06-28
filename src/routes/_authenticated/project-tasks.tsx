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
import { Plus, ListChecks, CheckCircle2, PlayCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/project-tasks")({
  head: () => ({ meta: [{ title: "Project Tasks — Habico Portal" }] }),
  component: ProjectTasksPage,
});

const statusColor: Record<string, string> = {
  todo: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const priorityColor: Record<string, string> = {
  low: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusOptions = ["todo", "in_progress", "review", "done", "cancelled"];
const priorityOptions = ["low", "medium", "high", "urgent"];

function ProjectTasksPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "", title: "", description: "", status: "todo", priority: "medium",
    due_date: "", estimated_hours: "", actual_hours: "",
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["project-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_tasks").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => setForm({
    project_id: "", title: "", description: "", status: "todo", priority: "medium",
    due_date: "", estimated_hours: "", actual_hours: "",
  });

  const openEdit = (t: any) => {
    setEditing(t);
    setForm({
      project_id: t.project_id ?? "", title: t.title ?? "", description: t.description ?? "",
      status: t.status ?? "todo", priority: t.priority ?? "medium",
      due_date: t.due_date ?? "", estimated_hours: String(t.estimated_hours ?? ""),
      actual_hours: String(t.actual_hours ?? ""),
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_tasks").insert({
        project_id: form.project_id || null, title: form.title, description: form.description || null,
        status: form.status, priority: form.priority, due_date: form.due_date || null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        actual_hours: form.actual_hours ? Number(form.actual_hours) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Task created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["project-tasks"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_tasks").update({
        project_id: form.project_id || null, title: form.title, description: form.description || null,
        status: form.status, priority: form.priority, due_date: form.due_date || null,
        estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
        actual_hours: form.actual_hours ? Number(form.actual_hours) : null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Task updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["project-tasks"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Task deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["project-tasks"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t: any) => t.status === "done").length;
  const inProgressTasks = tasks.filter((t: any) => t.status === "in_progress").length;
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Operations</div>
          <h1 className="display text-3xl font-bold">Project Tasks</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit task" : "New task"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit task" : "Create a task"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Task Details</h3></div>
                  <div className="space-y-3">
                    <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Enter task title" /></div>
                    <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What needs to be done?" /></div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Assignment</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Status</Label>
                      <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        {statusOptions.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select>
                    </div>
                    <div><Label>Priority</Label>
                      <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                        {priorityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Schedule</h3></div>
                  <div className="space-y-3">
                    <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Estimated hours</Label><Input type="number" value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} placeholder="e.g. 8" /></div>
                      <div><Label>Actual hours</Label><Input type="number" value={form.actual_hours} onChange={(e) => setForm({ ...form, actual_hours: e.target.value })} placeholder="e.g. 6" /></div>
                    </div>
                  </div>
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
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Tasks</CardTitle><ListChecks className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalTasks}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Done</CardTitle><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{doneTasks}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">In Progress</CardTitle><PlayCircle className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{inProgressTasks}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Completion %</CardTitle><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{completionRate}%</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All tasks</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : tasks.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No tasks yet. {isStaff ? "Create your first task." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Due date</TableHead><TableHead className="text-right">Est. hours</TableHead><TableHead className="text-right">Actual hours</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {tasks.map((t: any) => (
                  <TableRow key={t.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(t)}>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell><Badge className={cn("border-0", statusColor[t.status])} variant="outline">{t.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell><Badge className={cn("border-0", priorityColor[t.priority])} variant="outline">{t.priority}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.due_date ?? "—"}</TableCell>
                    <TableCell className="text-right">{t.estimated_hours ?? "—"}</TableCell>
                    <TableCell className="text-right">{t.actual_hours ?? "—"}</TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === t.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(t.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete task?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{t.title}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteTask.mutate(t.id)} disabled={deleteTask.isPending}>
                                {deleteTask.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
