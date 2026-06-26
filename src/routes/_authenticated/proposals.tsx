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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileSpreadsheet, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/proposals")({
  head: () => ({ meta: [{ title: "Proposals — Habico Portal" }] }),
  component: ProposalsPage,
});

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  reviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusOptions = ["draft", "sent", "reviewing", "accepted", "rejected"];

function ProposalsPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "", lead_id: "", estimate_id: "", proposal_number: "", title: "",
    content: "", status: "draft", total_amount: "", valid_until: "",
    sent_at: "", accepted_at: "", notes: "",
  });

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["proposals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("proposals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const resetForm = () => setForm({
    project_id: "", lead_id: "", estimate_id: "", proposal_number: "", title: "",
    content: "", status: "draft", total_amount: "", valid_until: "",
    sent_at: "", accepted_at: "", notes: "",
  });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      project_id: p.project_id ?? "", lead_id: p.lead_id ?? "", estimate_id: p.estimate_id ?? "",
      proposal_number: p.proposal_number ?? "", title: p.title ?? "", content: p.content ?? "",
      status: p.status ?? "draft", total_amount: p.total_amount != null ? String(p.total_amount) : "",
      valid_until: p.valid_until ?? "", sent_at: p.sent_at ?? "", accepted_at: p.accepted_at ?? "",
      notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("proposals").insert({
        project_id: form.project_id || null, lead_id: form.lead_id || null, estimate_id: form.estimate_id || null,
        proposal_number: form.proposal_number || null, title: form.title, content: form.content || null,
        status: form.status, total_amount: form.total_amount ? Number(form.total_amount) : 0,
        valid_until: form.valid_until || null, sent_at: form.sent_at || null, accepted_at: form.accepted_at || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Proposal created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["proposals"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("proposals").update({
        project_id: form.project_id || null, lead_id: form.lead_id || null, estimate_id: form.estimate_id || null,
        proposal_number: form.proposal_number || null, title: form.title, content: form.content || null,
        status: form.status, total_amount: form.total_amount ? Number(form.total_amount) : 0,
        valid_until: form.valid_until || null, sent_at: form.sent_at || null, accepted_at: form.accepted_at || null,
        notes: form.notes || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Proposal updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["proposals"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteProposal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proposals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Proposal deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["proposals"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalProposals = proposals.length;
  const acceptedProposals = proposals.filter((p: any) => p.status === "accepted").length;
  const rejectedProposals = proposals.filter((p: any) => p.status === "rejected").length;
  const acceptanceRate = proposals.length > 0 ? Math.round((acceptedProposals / proposals.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Preconstruction</div>
          <h1 className="display text-3xl font-bold">Proposals</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit proposal" : "New proposal"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit proposal" : "Create a proposal"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Project ID</Label><Input value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} /></div>
                  <div><Label>Lead ID</Label><Input value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Estimate ID</Label><Input value={form.estimate_id} onChange={(e) => setForm({ ...form, estimate_id: e.target.value })} /></div>
                  <div><Label>Proposal #</Label><Input value={form.proposal_number} onChange={(e) => setForm({ ...form, proposal_number: e.target.value })} /></div>
                </div>
                <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Content</Label><Textarea rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Total (UGX)</Label><Input type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valid until</Label><Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
                  <div><Label>Sent at</Label><Input type="date" value={form.sent_at} onChange={(e) => setForm({ ...form, sent_at: e.target.value })} /></div>
                </div>
                <div><Label>Accepted at</Label><Input type="date" value={form.accepted_at} onChange={(e) => setForm({ ...form, accepted_at: e.target.value })} /></div>
                <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Proposals</CardTitle><FileSpreadsheet className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalProposals}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Accepted</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{acceptedProposals}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Rejected</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{rejectedProposals}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{acceptanceRate}%</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All proposals</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : proposals.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No proposals yet. {isStaff ? "Create your first proposal." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>Proposal #</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Valid until</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {proposals.map((p: any) => (
                  <TableRow key={p.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(p)}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.proposal_number ?? "—"}</TableCell>
                    <TableCell><Badge className={cn("border-0", statusColor[p.status])} variant="outline">{p.status?.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-right">UGX {Number(p.total_amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.valid_until ?? "—"}</TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === p.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(p.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete proposal?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{p.title}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProposal.mutate(p.id)} disabled={deleteProposal.isPending}>
                                {deleteProposal.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
