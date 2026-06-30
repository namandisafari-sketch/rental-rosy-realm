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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, FileText, FolderOpen, TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/project-documents")({
  head: () => ({ meta: [{ title: "Project Documents — Habico Portal" }] }),
  component: ProjectDocumentsPage,
});

const categoryOptions = ["general", "drawing", "contract", "permit", "report", "photo", "other"];

const categoryColor: Record<string, string> = {
  general: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  drawing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  contract: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  permit: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  report: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  photo: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function ProjectDocumentsPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "", name: "", file_url: "", file_size: "", file_type: "",
    category: "general", version: "1.0", description: "",
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["project_documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => setForm({
    project_id: "", name: "", file_url: "", file_size: "", file_type: "",
    category: "general", version: "1.0", description: "",
  });

  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      project_id: p.project_id ?? "", name: p.name ?? "", file_url: p.file_url ?? "",
      file_size: p.file_size != null ? String(p.file_size) : "", file_type: p.file_type ?? "",
      category: p.category ?? "general", version: p.version ?? "1.0", description: p.description ?? "",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_documents").insert({
        project_id: form.project_id, name: form.name, file_url: form.file_url || null,
        file_size: form.file_size ? Number(form.file_size) : null, file_type: form.file_type || null,
        category: form.category, version: form.version, description: form.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Document created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["project_documents"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_documents").update({
        project_id: form.project_id, name: form.name, file_url: form.file_url || null,
        file_size: form.file_size ? Number(form.file_size) : null, file_type: form.file_type || null,
        category: form.category, version: form.version, description: form.description || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Document updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["project_documents"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Document deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["project_documents"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalDocs = docs.length;
  const categoriesCount = new Set(docs.map((d: any) => d.category)).size;
  const recentUploads = docs.filter((d: any) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return new Date(d.created_at) >= sevenDaysAgo;
  }).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Document Control</div>
          <h1 className="display text-3xl font-bold">Project Documents</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit document" : "New document"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit document" : "Upload a document"}</DialogTitle></DialogHeader>
              <div className="space-y-5">
                <div>
                  <div className="mb-3 border-b pb-1"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Required Information</span></div>
                  <div><Label>Project ID <span className="text-destructive">*</span></Label><Input value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} placeholder="e.g. a1b2c3d4-..." /></div>
                  <div className="mt-3"><Label>Document name <span className="text-destructive">*</span></Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Structural Drawings - Block A" /></div>
                  <div className="mt-3"><Label>Version <span className="text-destructive">*</span></Label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 1.0, 2.1" /></div>
                </div>
                <div>
                  <div className="mb-3 border-b pb-1"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">File Details</span></div>
                  <div><Label>File URL</Label><Input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} placeholder="https://storage.example.com/doc.pdf" /></div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div><Label>File size (bytes)</Label><Input type="number" value={form.file_size} onChange={(e) => setForm({ ...form, file_size: e.target.value })} placeholder="e.g. 204800" /></div>
                    <div><Label>File type</Label><Input value={form.file_type} onChange={(e) => setForm({ ...form, file_type: e.target.value })} placeholder="e.g. pdf, dwg, xlsx" /></div>
                  </div>
                  <div className="mt-3"><Label>Category</Label>
                    <SearchableSelect
                      value={form.category}
                      onValueChange={(v) => setForm({ ...form, category: v })}
                      placeholder="Select category"
                      options={categoryOptions.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-3 border-b pb-1"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</span></div>
                  <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the document contents and purpose..." /></div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => (editing ? update : create).mutate()} disabled={!form.project_id || !form.name || !form.version || create.isPending || update.isPending}>
                  {(create.isPending || update.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? "Save changes" : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Documents</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalDocs}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Categories Used</CardTitle><FolderOpen className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{categoriesCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Recent Uploads (7d)</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{recentUploads}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All documents</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : docs.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No documents yet. {isStaff ? "Upload your first document." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Version</TableHead><TableHead className="text-right">File size</TableHead><TableHead>Type</TableHead><TableHead>Created</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {docs.map((d: any) => (
                  <TableRow key={d.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(d)}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell><Badge className={cn("border-0", categoryColor[d.category])} variant="outline">{d.category}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">v{d.version}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatFileSize(d.file_size)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.file_type?.toUpperCase() ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.created_at ? new Date(d.created_at).toLocaleDateString() : "—"}</TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === d.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(d.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete document?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{d.name}" (v{d.version}). This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteDoc.mutate(d.id)} disabled={deleteDoc.isPending}>
                                {deleteDoc.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
