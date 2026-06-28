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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Users, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({ meta: [{ title: "Leads — Habico Portal" }] }),
  component: LeadsPage,
});

const statusColor: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  contacted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  qualified: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  proposal: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  won: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  lost: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const statusOptions = ["new", "contacted", "qualified", "proposal", "won", "lost"];
const sourceOptions = ["direct", "website", "referral", "phone", "email", "social_media", "other"];

function LeadsPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    source: "direct", contact_name: "", contact_phone: "", contact_email: "",
    company: "", description: "", status: "new", budget_range_min: "", budget_range_max: "",
    notes: "", assigned_to: "",
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const resetForm = () => setForm({
    source: "direct", contact_name: "", contact_phone: "", contact_email: "",
    company: "", description: "", status: "new", budget_range_min: "", budget_range_max: "",
    notes: "", assigned_to: "",
  });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      source: p.source ?? "direct", contact_name: p.contact_name ?? "", contact_phone: p.contact_phone ?? "",
      contact_email: p.contact_email ?? "", company: p.company ?? "", description: p.description ?? "",
      status: p.status ?? "new", budget_range_min: p.budget_range_min != null ? String(p.budget_range_min) : "",
      budget_range_max: p.budget_range_max != null ? String(p.budget_range_max) : "",
      notes: p.notes ?? "", assigned_to: p.assigned_to ?? "",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").insert({
        source: form.source, contact_name: form.contact_name || null, contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null, company: form.company || null, description: form.description || null,
        status: form.status, budget_range_min: form.budget_range_min ? Number(form.budget_range_min) : null,
        budget_range_max: form.budget_range_max ? Number(form.budget_range_max) : null,
        notes: form.notes || null, assigned_to: form.assigned_to || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lead created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["leads"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").update({
        source: form.source, contact_name: form.contact_name || null, contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null, company: form.company || null, description: form.description || null,
        status: form.status, budget_range_min: form.budget_range_min ? Number(form.budget_range_min) : null,
        budget_range_max: form.budget_range_max ? Number(form.budget_range_max) : null,
        notes: form.notes || null, assigned_to: form.assigned_to || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lead updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["leads"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lead deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["leads"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalLeads = leads.length;
  const wonLeads = leads.filter((p: any) => p.status === "won").length;
  const lostLeads = leads.filter((p: any) => p.status === "lost").length;
  const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Preconstruction</div>
          <h1 className="display text-3xl font-bold">Leads</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit lead" : "New lead"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit lead" : "Create a lead"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Contact Information</h3></div>
                  <div className="space-y-3">
                    <div><Label>Contact name <span className="text-destructive">*</span></Label><Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Full name of the contact person" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Phone</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+256 XXX XXX XXX" /></div>
                      <div><Label>Email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="email@example.com" /></div>
                    </div>
                    <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Company or organization name" /></div>
                    <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the lead and their needs" /></div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Lead Details</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Source <span className="text-destructive">*</span></Label>
                      <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                        <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                        <SelectContent>
                          {sourceOptions.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Status <span className="text-destructive">*</span></Label>
                      <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div><Label>Budget min (UGX)</Label><Input type="number" value={form.budget_range_min} onChange={(e) => setForm({ ...form, budget_range_min: e.target.value })} placeholder="Minimum expected budget" /></div>
                    <div><Label>Budget max (UGX)</Label><Input type="number" value={form.budget_range_max} onChange={(e) => setForm({ ...form, budget_range_max: e.target.value })} placeholder="Maximum expected budget" /></div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Assignment &amp; Notes</h3></div>
                  <div><Label>Assigned to</Label><Input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="Team member responsible for this lead" /></div>
                  <div className="mt-3"><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes or comments" /></div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => (editing ? update : create).mutate()} disabled={!form.contact_name || create.isPending || update.isPending}>
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
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Leads</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalLeads}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Won</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{wonLeads}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Lost</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{lostLeads}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Conversion Rate</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{conversionRate}%</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All leads</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : leads.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No leads yet. {isStaff ? "Create your first lead." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Contact</TableHead><TableHead>Company</TableHead><TableHead>Source</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Budget</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {leads.map((p: any) => (
                  <TableRow key={p.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(p)}>
                    <TableCell>
                      <div className="font-medium">{p.contact_name}</div>
                      {p.contact_email && <div className="text-xs text-muted-foreground">{p.contact_email}</div>}
                      {p.contact_phone && <div className="text-xs text-muted-foreground">{p.contact_phone}</div>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.company ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{p.source?.replace("_", " ")}</Badge></TableCell>
                    <TableCell><Badge className={cn("border-0", statusColor[p.status])} variant="outline">{p.status?.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-right">
                      {p.budget_range_min != null ? `UGX ${Number(p.budget_range_min).toLocaleString()}` : "—"}
                      {p.budget_range_max != null ? ` – UGX ${Number(p.budget_range_max).toLocaleString()}` : ""}
                    </TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === p.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(p.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete lead?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{p.contact_name}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteLead.mutate(p.id)} disabled={deleteLead.isPending}>
                                {deleteLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
