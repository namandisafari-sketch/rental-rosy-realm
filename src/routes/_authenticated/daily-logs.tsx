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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, FileText, Users, Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/daily-logs")({
  head: () => ({ meta: [{ title: "Daily Logs — Habico Portal" }] }),
  component: DailyLogsPage,
});

function DailyLogsPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "", log_date: new Date().toISOString().split("T")[0],
    weather: "", temperature: "", workers_on_site: "", hours_worked: "",
    notes: "", delays: "", safety_incidents: "",
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["daily-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("daily_logs").select("*").order("log_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => setForm({
    project_id: "", log_date: new Date().toISOString().split("T")[0],
    weather: "", temperature: "", workers_on_site: "", hours_worked: "",
    notes: "", delays: "", safety_incidents: "",
  });

  const openEdit = (l: any) => {
    setEditing(l);
    setForm({
      project_id: l.project_id ?? "", log_date: l.log_date ?? new Date().toISOString().split("T")[0],
      weather: l.weather ?? "", temperature: String(l.temperature ?? ""),
      workers_on_site: String(l.workers_on_site ?? ""), hours_worked: String(l.hours_worked ?? ""),
      notes: l.notes ?? "", delays: l.delays ?? "", safety_incidents: l.safety_incidents ?? "",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("daily_logs").insert({
        project_id: form.project_id || null, log_date: form.log_date,
        weather: form.weather || null, temperature: form.temperature ? Number(form.temperature) : null,
        workers_on_site: form.workers_on_site ? Number(form.workers_on_site) : null,
        hours_worked: form.hours_worked ? Number(form.hours_worked) : null,
        notes: form.notes || null, delays: form.delays || null, safety_incidents: form.safety_incidents || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Daily log created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["daily-logs"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("daily_logs").update({
        project_id: form.project_id || null, log_date: form.log_date,
        weather: form.weather || null, temperature: form.temperature ? Number(form.temperature) : null,
        workers_on_site: form.workers_on_site ? Number(form.workers_on_site) : null,
        hours_worked: form.hours_worked ? Number(form.hours_worked) : null,
        notes: form.notes || null, delays: form.delays || null, safety_incidents: form.safety_incidents || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Daily log updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["daily-logs"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Daily log deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["daily-logs"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalLogs = logs.length;
  const todayStr = new Date().toISOString().split("T")[0];
  const workersToday = logs
    .filter((l: any) => l.log_date === todayStr)
    .reduce((sum: number, l: any) => sum + Number(l.workers_on_site || 0), 0);
  const projectsWithLogs = new Set(logs.map((l: any) => l.project_id)).size;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Operations</div>
          <h1 className="display text-3xl font-bold">Daily Logs</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit log" : "New log"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit daily log" : "Create a daily log"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Log date *</Label><Input type="date" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} /></div>
                <div><Label>Weather</Label><Input value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} placeholder="e.g. Sunny, Rainy" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Temperature (°C)</Label><Input type="number" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} /></div>
                  <div><Label>Workers on site</Label><Input type="number" value={form.workers_on_site} onChange={(e) => setForm({ ...form, workers_on_site: e.target.value })} /></div>
                </div>
                <div><Label>Hours worked</Label><Input type="number" value={form.hours_worked} onChange={(e) => setForm({ ...form, hours_worked: e.target.value })} /></div>
                <div><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <div><Label>Delays</Label><Textarea rows={2} value={form.delays} onChange={(e) => setForm({ ...form, delays: e.target.value })} /></div>
                <div><Label>Safety incidents</Label><Textarea rows={2} value={form.safety_incidents} onChange={(e) => setForm({ ...form, safety_incidents: e.target.value })} /></div>
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => (editing ? update : create).mutate()} disabled={!form.log_date || create.isPending || update.isPending}>
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
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Logs</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalLogs}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Workers Today</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{workersToday}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Projects with Logs</CardTitle><Building2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{projectsWithLogs}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All daily logs</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : logs.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No daily logs yet. {isStaff ? "Create your first log." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Weather</TableHead><TableHead className="text-right">Temp</TableHead><TableHead className="text-right">Workers</TableHead><TableHead className="text-right">Hours</TableHead><TableHead>Delays</TableHead><TableHead>Incidents</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {logs.map((l: any) => (
                  <TableRow key={l.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(l)}>
                    <TableCell className="font-medium">{l.log_date}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.weather ?? "—"}</TableCell>
                    <TableCell className="text-right">{l.temperature != null ? `${l.temperature}°C` : "—"}</TableCell>
                    <TableCell className="text-right">{l.workers_on_site ?? "—"}</TableCell>
                    <TableCell className="text-right">{l.hours_worked ?? "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-sm text-muted-foreground">{l.delays ?? "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate text-sm text-muted-foreground">{l.safety_incidents ?? "—"}</TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === l.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(l.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete daily log?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the log for {l.log_date}. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteLog.mutate(l.id)} disabled={deleteLog.isPending}>
                                {deleteLog.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
