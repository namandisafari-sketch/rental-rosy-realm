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
import { Plus, Clock, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/timesheets")({
  head: () => ({ meta: [{ title: "Timesheets — Habico Portal" }] }),
  component: TimesheetsPage,
});

const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusOptions = ["pending", "approved", "rejected"];

function TimesheetsPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    employee_id: "", project_id: "", date: "", start_time: "", end_time: "",
    hours: "0", overtime_hours: "0", description: "", status: "pending",
  });

  const { data: timesheets = [], isLoading } = useQuery({
    queryKey: ["timesheets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("timesheets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => setForm({
    employee_id: "", project_id: "", date: "", start_time: "", end_time: "",
    hours: "0", overtime_hours: "0", description: "", status: "pending",
  });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      employee_id: p.employee_id ?? "", project_id: p.project_id ?? "", date: p.date ?? "",
      start_time: p.start_time ?? "", end_time: p.end_time ?? "",
      hours: String(p.hours ?? "0"), overtime_hours: String(p.overtime_hours ?? "0"),
      description: p.description ?? "", status: p.status ?? "pending",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("timesheets").insert({
        employee_id: form.employee_id || null, project_id: form.project_id || null,
        date: form.date || null, start_time: form.start_time || null, end_time: form.end_time || null,
        hours: Number(form.hours), overtime_hours: Number(form.overtime_hours),
        description: form.description || null, status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Timesheet entry created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["timesheets"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("timesheets").update({
        employee_id: form.employee_id || null, project_id: form.project_id || null,
        date: form.date || null, start_time: form.start_time || null, end_time: form.end_time || null,
        hours: Number(form.hours), overtime_hours: Number(form.overtime_hours),
        description: form.description || null, status: form.status,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Timesheet entry updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["timesheets"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteTimesheet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timesheets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Timesheet entry deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["timesheets"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalHours = timesheets.reduce((s: number, p: any) => s + Number(p.hours || 0), 0);
  const pendingHours = timesheets.filter((p: any) => p.status === "pending").reduce((s: number, p: any) => s + Number(p.hours || 0), 0);
  const approvedHours = timesheets.filter((p: any) => p.status === "approved").reduce((s: number, p: any) => s + Number(p.hours || 0), 0);
  const employeesClocked = new Set(timesheets.map((p: any) => p.employee_id).filter(Boolean)).size;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Financial Management</div>
          <h1 className="display text-3xl font-bold">Timesheets</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit entry" : "New entry"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit timesheet entry" : "Create a timesheet entry"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Employee & Project</h3></div>
                  <div className="space-y-3">
                    <div><Label>Employee ID</Label><Input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} placeholder="Select or enter employee" /></div>
                    <div><Label>Project ID</Label><Input value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} placeholder="Select or enter project" /></div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Date & Time</h3></div>
                  <div className="space-y-3">
                    <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Start time</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
                      <div><Label>End time</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Hours *</Label><Input type="number" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="Total hours worked" /></div>
                      <div><Label>Overtime hours</Label><Input type="number" value={form.overtime_hours} onChange={(e) => setForm({ ...form, overtime_hours: e.target.value })} placeholder="0" /></div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Description</h3></div>
                  <div><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Work performed during this period" /></div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Approval</h3></div>
                  <div><Label>Status</Label>
                    <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      {statusOptions.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  </div>
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
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Hours</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalHours.toFixed(1)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Pending Hours</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{pendingHours.toFixed(1)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Approved Hours</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{approvedHours.toFixed(1)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Employees Clocked</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{employeesClocked}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All timesheets</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : timesheets.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No timesheet entries yet. {isStaff ? "Create your first entry." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Employee</TableHead><TableHead>Date</TableHead><TableHead>Hours</TableHead><TableHead>OT</TableHead><TableHead>Status</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {timesheets.map((p: any) => (
                  <TableRow key={p.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(p)}>
                    <TableCell className="font-medium">{p.employee_id ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.date ?? "—"}</TableCell>
                    <TableCell>{Number(p.hours || 0).toFixed(1)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{Number(p.overtime_hours || 0).toFixed(1)}</TableCell>
                    <TableCell><Badge className={cn("border-0", statusColor[p.status])} variant="outline">{p.status}</Badge></TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === p.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(p.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete timesheet entry?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this entry. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteTimesheet.mutate(p.id)} disabled={deleteTimesheet.isPending}>
                                {deleteTimesheet.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
