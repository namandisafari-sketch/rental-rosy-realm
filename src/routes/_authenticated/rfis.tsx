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
import { Plus, MessageSquareText, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/rfis")({
  head: () => ({ meta: [{ title: "RFIs — Habico Portal" }] }),
  component: RfisPage,
});

const statusColor: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  answered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const priorityColor: Record<string, string> = {
  low: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusOptions = ["open", "answered", "closed"];
const priorityOptions = ["low", "medium", "high", "urgent"];

function RfisPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "", rfi_number: "", title: "", question: "", response: "",
    status: "open", priority: "medium", due_date: "",
  });

  const { data: rfis = [], isLoading } = useQuery({
    queryKey: ["rfis"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rfis").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => setForm({
    project_id: "", rfi_number: "", title: "", question: "", response: "",
    status: "open", priority: "medium", due_date: "",
  });

  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      project_id: r.project_id ?? "", rfi_number: r.rfi_number ?? "", title: r.title ?? "",
      question: r.question ?? "", response: r.response ?? "", status: r.status ?? "open",
      priority: r.priority ?? "medium", due_date: r.due_date ?? "",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rfis").insert({
        project_id: form.project_id || null, rfi_number: form.rfi_number || null, title: form.title,
        question: form.question || null, response: form.response || null, status: form.status,
        priority: form.priority, due_date: form.due_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("RFI created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["rfis"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rfis").update({
        project_id: form.project_id || null, rfi_number: form.rfi_number || null, title: form.title,
        question: form.question || null, response: form.response || null, status: form.status,
        priority: form.priority, due_date: form.due_date || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("RFI updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["rfis"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteRfi = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rfis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("RFI deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["rfis"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const today = new Date();
  const openRfis = rfis.filter((r: any) => r.status === "open").length;
  const overdueRfis = rfis.filter((r: any) => r.status === "open" && r.due_date && new Date(r.due_date) < today).length;
  const answeredRfis = rfis.filter((r: any) => r.status === "answered").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Operations</div>
          <h1 className="display text-3xl font-bold">RFIs</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit RFI" : "New RFI"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit RFI" : "Create an RFI"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>RFI number</Label><Input value={form.rfi_number} onChange={(e) => setForm({ ...form, rfi_number: e.target.value })} /></div>
                  <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                </div>
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
                <div><Label>Question</Label><Textarea rows={3} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></div>
                <div><Label>Response</Label><Textarea rows={3} value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} /></div>
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
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Open RFIs</CardTitle><MessageSquareText className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{openRfis}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Overdue</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{overdueRfis}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Answered</CardTitle><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{answeredRfis}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All RFIs</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rfis.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No RFIs yet. {isStaff ? "Create your first RFI." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Due date</TableHead><TableHead>Question</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {rfis.map((r: any) => (
                  <TableRow key={r.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(r)}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell><Badge className={cn("border-0", statusColor[r.status])} variant="outline">{r.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell><Badge className={cn("border-0", priorityColor[r.priority])} variant="outline">{r.priority}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.due_date ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{r.question ?? "—"}</TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === r.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(r.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete RFI?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{r.title}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteRfi.mutate(r.id)} disabled={deleteRfi.isPending}>
                                {deleteRfi.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
