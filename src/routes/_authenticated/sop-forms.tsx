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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, FileText, FolderTree, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sop-forms")({
  head: () => ({ meta: [{ title: "SOP Forms — Habico Portal" }] }),
  component: SopFormsPage,
});

function SopFormsPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", category: "", form_config: "{}" });

  const resetForm = () => {
    setForm({ title: "", description: "", category: "", form_config: "{}" });
    setEditing(null);
  };

  const { data: forms = [], isLoading } = useQuery({
    queryKey: ["sop-forms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sop_forms").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const categories = [...new Set(forms.map((f: any) => f.category).filter(Boolean))];

  const openEdit = (f: any) => {
    setEditing(f);
    setForm({
      title: f.title ?? "",
      description: f.description ?? "",
      category: f.category ?? "",
      form_config: typeof f.form_config === "string" ? f.form_config : JSON.stringify(f.form_config ?? {}, null, 2),
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      let parsed: any = {};
      try { parsed = JSON.parse(form.form_config); } catch { throw new Error("Invalid JSON in form_config"); }
      const { error } = await supabase.from("sop_forms").insert({
        title: form.title, description: form.description || null, category: form.category || null, form_config: parsed,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Form created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["sop-forms"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      let parsed: any = {};
      try { parsed = JSON.parse(form.form_config); } catch { throw new Error("Invalid JSON in form_config"); }
      const { error } = await supabase.from("sop_forms").update({
        title: form.title, description: form.description || null, category: form.category || null, form_config: parsed,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Form updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["sop-forms"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sop_forms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Form deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["sop-forms"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Operations</div>
          <h1 className="display text-3xl font-bold">SOP Forms</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />New form</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit form" : "Create a form"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                <div>
                  <Label>Form Config (JSON)</Label>
                  <Textarea
                    rows={12}
                    className="font-mono text-xs"
                    value={form.form_config}
                    onChange={(e) => setForm({ ...form, form_config: e.target.value })}
                    placeholder={`[\n  {\n    "label": "Field Name",\n    "type": "text",\n    "required": true\n  }\n]`}
                  />
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Forms</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{forms.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Categories</CardTitle><FolderTree className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
            {categories.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {categories.map((c: any) => <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">With Config</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{forms.filter((f: any) => f.form_config && Object.keys(f.form_config).length > 0).length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All forms</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : forms.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No forms yet. {isStaff ? "Create your first form." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Config Fields</TableHead><TableHead>Updated</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {forms.map((f: any) => {
                  const fieldCount = Array.isArray(f.form_config) ? f.form_config.length : typeof f.form_config === "object" && f.form_config ? Object.keys(f.form_config).length : 0;
                  return (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="font-medium">{f.title}</div>
                        {f.description && <div className="text-xs text-muted-foreground">{f.description}</div>}
                      </TableCell>
                      <TableCell>{f.category ? <Badge variant="outline">{f.category}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">{fieldCount} field{fieldCount !== 1 ? "s" : ""}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.updated_at ? new Date(f.updated_at).toLocaleDateString() : "—"}</TableCell>
                      {isStaff && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(f)}>Edit</Button>
                            <AlertDialog open={deleteId === f.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                              <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(f.id)}>Delete</Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Delete form?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{f.title}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => del.mutate(f.id)} disabled={del.isPending}>
                                    {del.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
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
