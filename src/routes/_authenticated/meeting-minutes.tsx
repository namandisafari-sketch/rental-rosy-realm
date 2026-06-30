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
import { Plus, ClipboardList, CheckCircle2, Circle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { LocationSelector } from "@/components/location-selector";

export const Route = createFileRoute("/_authenticated/meeting-minutes")({
  head: () => ({ meta: [{ title: "Meeting Minutes — Habico Portal" }] }),
  component: MeetingMinutesPage,
});

const statusOptions = ["open", "in_progress", "completed"];

const actionStatusColor: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const defaultActionItem = { action: "", assignee: "", due_date: "", status: "open" };

function MeetingMinutesPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    project_id: "", title: "", meeting_date: "", start_time: "", end_time: "",
    location: "", attendees: "", agenda: "", notes: "",
    action_items: [{ ...defaultActionItem }],
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["meeting-minutes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meeting_minutes").select("*, projects!inner(name)").order("meeting_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => setForm({
    project_id: "", title: "", meeting_date: "", start_time: "", end_time: "",
    location: "", attendees: "", agenda: "", notes: "",
    action_items: [{ ...defaultActionItem }],
  });

  const openEdit = (m: any) => {
    setEditing(m);
    setForm({
      project_id: m.project_id ?? "",
      title: m.title ?? "",
      meeting_date: m.meeting_date ?? "",
      start_time: m.start_time ?? "",
      end_time: m.end_time ?? "",
      location: m.location ?? "",
      attendees: m.attendees ?? "",
      agenda: m.agenda ?? "",
      notes: m.notes ?? "",
      action_items: Array.isArray(m.action_items) && m.action_items.length > 0
        ? m.action_items.map((ai: any) => ({ action: ai.action ?? "", assignee: ai.assignee ?? "", due_date: ai.due_date ?? "", status: ai.status ?? "open" }))
        : [{ ...defaultActionItem }],
    });
    setOpen(true);
  };

  const addActionItem = () => setForm({ ...form, action_items: [...form.action_items, { ...defaultActionItem }] });
  const removeActionItem = (i: number) => setForm({ ...form, action_items: form.action_items.filter((_: any, idx: number) => idx !== i) });
  const updateActionItem = (i: number, field: string, value: string) => {
    const items = [...form.action_items];
    items[i] = { ...items[i], [field]: value };
    setForm({ ...form, action_items: items });
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meeting_minutes").insert({
        project_id: form.project_id, title: form.title, meeting_date: form.meeting_date,
        start_time: form.start_time || null, end_time: form.end_time || null,
        location: form.location || null, attendees: form.attendees || null,
        agenda: form.agenda || null, notes: form.notes || null,
        action_items: form.action_items.filter((ai: any) => ai.action),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Meeting minutes created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["meeting-minutes"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meeting_minutes").update({
        project_id: form.project_id, title: form.title, meeting_date: form.meeting_date,
        start_time: form.start_time || null, end_time: form.end_time || null,
        location: form.location || null, attendees: form.attendees || null,
        agenda: form.agenda || null, notes: form.notes || null,
        action_items: form.action_items.filter((ai: any) => ai.action),
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Meeting minutes updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["meeting-minutes"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMeeting = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meeting_minutes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Meeting minutes deleted"); setDeleteId(null); qc.invalidateQueries({ queryKey: ["meeting-minutes"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalMeetings = meetings.length;
  const allActions = meetings.flatMap((m: any) => m.action_items ?? []);
  const openActions = allActions.filter((a: any) => a.status !== "completed").length;
  const completedActions = allActions.filter((a: any) => a.status === "completed").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Operations</div>
          <h1 className="display text-3xl font-bold">Meeting Minutes</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />{editing ? "Edit meeting" : "New meeting"}</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader><DialogTitle>{editing ? "Edit meeting minutes" : "Record meeting minutes"}</DialogTitle></DialogHeader>
              <div className="space-y-6">
                {/* Section: Meeting Info */}
                <fieldset className="rounded-lg border p-4">
                  <legend className="text-sm font-semibold text-muted-foreground">Meeting Information</legend>
                  <div className="space-y-3">
                    <div>
                      <Label>Project <span className="text-destructive">*</span></Label>
                      <SearchableSelect
                        value={form.project_id}
                        onValueChange={(v) => setForm({ ...form, project_id: v })}
                        placeholder="Select a project..."
                        options={[
                          { value: "", label: "Select a project..." },
                          ...projects.map((p: any) => ({ value: p.id, label: p.name }))
                        ]}
                      />
                    </div>
                    <div>
                      <Label>Title <span className="text-destructive">*</span></Label>
                      <Input placeholder="e.g. Weekly progress meeting" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div>
                      <Label>Meeting date <span className="text-destructive">*</span></Label>
                      <Input type="date" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Start time</Label>
                        <Input type="time" placeholder="09:00" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                      </div>
                      <div>
                        <Label>End time</Label>
                        <Input type="time" placeholder="10:30" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label>Location</Label>
                      <LocationSelector value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
                    </div>
                  </div>
                </fieldset>

                {/* Section: Attendees & Agenda */}
                <fieldset className="rounded-lg border p-4">
                  <legend className="text-sm font-semibold text-muted-foreground">Attendees &amp; Agenda</legend>
                  <div className="space-y-3">
                    <div>
                      <Label>Attendees</Label>
                      <Textarea rows={3} placeholder="One name per line&#10;John Doe&#10;Jane Smith" value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} />
                      <p className="mt-1 text-xs text-muted-foreground">List each attendee on a separate line</p>
                    </div>
                    <div>
                      <Label>Agenda</Label>
                      <Textarea rows={4} placeholder="1. Review of previous minutes&#10;2. Progress update&#10;3. Budget review&#10;4. Action items" value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} />
                    </div>
                    <div>
                      <Label>Notes / Minutes</Label>
                      <Textarea rows={5} placeholder="Detailed notes from the meeting..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                    </div>
                  </div>
                </fieldset>

                {/* Section: Action Items */}
                <fieldset className="rounded-lg border p-4">
                  <legend className="text-sm font-semibold text-muted-foreground">Action Items</legend>
                  <div className="space-y-3">
                    {form.action_items.map((item: any, idx: number) => (
                      <div key={idx} className="rounded-md border bg-muted/30 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                          {form.action_items.length > 1 && (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive" onClick={() => removeActionItem(idx)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Action</Label>
                            <Input placeholder="Describe the action required" value={item.action} onChange={(e) => updateActionItem(idx, "action", e.target.value)} />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs">Assignee</Label>
                              <Input placeholder="Responsible person" value={item.assignee} onChange={(e) => updateActionItem(idx, "assignee", e.target.value)} />
                            </div>
                            <div>
                              <Label className="text-xs">Due date</Label>
                              <Input type="date" value={item.due_date} onChange={(e) => updateActionItem(idx, "due_date", e.target.value)} />
                            </div>
                            <div>
                              <Label className="text-xs">Status</Label>
                              <SearchableSelect
                                value={item.status}
                                onValueChange={(v) => updateActionItem(idx, "status", v)}
                                placeholder="Select status"
                                options={statusOptions.map((s) => ({ value: s, label: s.replace("_", " ") }))}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addActionItem} className="w-full">
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add action item
                    </Button>
                  </div>
                </fieldset>
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => (editing ? update : create).mutate()} disabled={!form.title || !form.meeting_date || !form.project_id || create.isPending || update.isPending}>
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
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total meetings</CardTitle><ClipboardList className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalMeetings}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Open action items</CardTitle><Circle className="h-4 w-4 text-yellow-500" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{openActions}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Completed actions</CardTitle><CheckCircle2 className="h-4 w-4 text-green-500" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{completedActions}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All meeting minutes</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : meetings.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No meeting minutes yet. {isStaff ? "Record your first meeting." : ""}</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Title</TableHead><TableHead>Project</TableHead><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Attendees</TableHead><TableHead>Actions</TableHead>
                {isStaff && <TableHead className="text-right">Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {meetings.map((m: any) => (
                  <TableRow key={m.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(m)}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.projects?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{m.meeting_date}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.start_time && m.end_time ? `${m.start_time}–${m.end_time}` : m.start_time ?? m.end_time ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{m.attendees ?? "—"}</TableCell>
                    <TableCell>
                      {Array.isArray(m.action_items) && m.action_items.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {m.action_items.filter((a: any) => a).slice(0, 3).map((a: any, i: number) => (
                            <Badge key={i} className={cn("border-0 text-xs", actionStatusColor[a.status])} variant="outline">{a.status}</Badge>
                          ))}
                          {m.action_items.length > 3 && <span className="text-xs text-muted-foreground">+{m.action_items.length - 3}</span>}
                        </div>
                      )}
                    </TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog open={deleteId === m.id} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                          <AlertDialogTrigger asChild><Button variant="destructive" size="sm" onClick={() => setDeleteId(m.id)}>Delete</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete meeting minutes?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{m.title}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMeeting.mutate(m.id)} disabled={deleteMeeting.isPending}>
                                {deleteMeeting.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
