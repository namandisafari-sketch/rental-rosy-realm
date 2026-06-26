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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Hash, FolderTree, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cost-codes")({
  head: () => ({ meta: [{ title: "Cost Codes — Habico Portal" }] }),
  component: CostCodesPage,
});

function CostCodesPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "", category: "", is_active: true });

  const resetForm = () => {
    setForm({ code: "", name: "", description: "", category: "", is_active: true });
    setEditing(null);
  };

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ["cost-codes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cost_codes").select("*").order("code", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const activeCodes = codes.filter((c: any) => c.is_active).length;
  const uniqueCategories = [...new Set(codes.map((c: any) => c.category).filter(Boolean))];

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      code: c.code ?? "",
      name: c.name ?? "",
      description: c.description ?? "",
      category: c.category ?? "",
      is_active: c.is_active ?? true,
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cost_codes").insert({
        code: form.code, name: form.name, description: form.description || null,
        category: form.category || null, is_active: form.is_active,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cost code created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["cost-codes"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("cost_codes").update({
        code: form.code, name: form.name, description: form.description || null,
        category: form.category || null, is_active: form.is_active,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cost code updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["cost-codes"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleActive = useMutation({
    mutationFn: async (c: any) => {
      const { error } = await supabase.from("cost_codes").update({ is_active: !c.is_active }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["cost-codes"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cost_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cost code deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["cost-codes"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Finance</div>
          <h1 className="display text-3xl font-bold">Cost Codes</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />New cost code</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{editing ? "Edit cost code" : "Create a cost code"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. 01-010" /></div>
                <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Labour, Materials, Equipment" /></div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  <Label>Active</Label>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => (editing ? update : create).mutate()} disabled={!form.code || !form.name || create.isPending || update.isPending}>
                  {(create.isPending || update.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? "Save" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Codes</CardTitle><Hash className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{codes.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Active</CardTitle><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-success">{activeCodes}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Categories</CardTitle><FolderTree className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueCategories.length}</div>
            {uniqueCategories.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {uniqueCategories.map((c: any) => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All cost codes</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : codes.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No cost codes yet. {isStaff ? "Create your first cost code." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead><TableHead>Description</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {codes.map((c: any) => (
                  <TableRow key={c.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(c)}>
                    <TableCell className="font-mono font-medium">{c.code}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.category ? <Badge variant="outline">{c.category}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {isStaff ? (
                        <Switch checked={c.is_active} onCheckedChange={() => toggleActive.mutate(c)} onClick={(e) => e.stopPropagation()} />
                      ) : (
                        <Badge variant="outline" className={c.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}>
                          {c.is_active ? "Active" : "Inactive"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.description ?? "—"}</TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === c.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(c.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete cost code?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{c.code} — {c.name}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => del.mutate(c.id)} disabled={del.isPending}>
                                {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
