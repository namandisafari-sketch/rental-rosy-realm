import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Wrench } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance — Habico Portal" }] }),
  component: MaintenancePage,
});

const priorityColor: Record<string,string> = { low:"bg-secondary text-muted-foreground", normal:"bg-secondary text-foreground", high:"bg-warning/30 text-warning-foreground", urgent:"bg-destructive/15 text-destructive" };
const statusColor: Record<string,string> = { open:"bg-warning/20 text-warning-foreground", in_progress:"bg-primary/15 text-primary", resolved:"bg-success/15 text-success", cancelled:"bg-secondary text-muted-foreground" };

function MaintenancePage() {
  const { user } = useAuth();
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ unit_id: "", title: "", description: "", priority: "normal" });

  const { data: requests = [] } = useQuery({
    queryKey: ["maintenance"],
    queryFn: async () => {
      const { data, error } = await supabase.from("maintenance_requests").select("*, units(unit_number, properties(name))").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // tenants pick their unit from their active leases
  const { data: myUnits = [] } = useQuery({
    queryKey: ["my-units", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("leases").select("unit_id, units(unit_number, properties(name))").eq("tenant_id", user!.id).eq("status", "active");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("maintenance_requests").insert({
        unit_id: form.unit_id, tenant_id: user!.id, title: form.title, description: form.description, priority: form.priority,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Request submitted"); setOpen(false); setForm({ unit_id:"",title:"",description:"",priority:"normal" }); qc.invalidateQueries({ queryKey:["maintenance"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("maintenance_requests").update({ status, resolved_at: status === "resolved" ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Operations</div>
          <h1 className="display text-3xl font-bold">Maintenance</h1>
        </div>
        {(role === "tenant" || isStaff) && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4"/>New request</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Submit a request</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Unit</Label>
                  <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.unit_id} onChange={(e)=>setForm({...form, unit_id:e.target.value})}>
                    <option value="">Select unit…</option>
                    {myUnits.map((u:any) => <option key={u.unit_id} value={u.unit_id}>{u.units?.properties?.name} · Unit {u.units?.unit_number}</option>)}
                  </select>
                </div>
                <div><Label>Title</Label><Input value={form.title} onChange={(e)=>setForm({...form, title:e.target.value})} maxLength={100}/></div>
                <div><Label>Description</Label><Textarea rows={4} value={form.description} onChange={(e)=>setForm({...form, description:e.target.value})} maxLength={1000}/></div>
                <div><Label>Priority</Label>
                  <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.priority} onChange={(e)=>setForm({...form, priority:e.target.value})}>
                    <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <DialogFooter><Button onClick={()=>create.mutate()} disabled={!form.unit_id || !form.title || create.isPending}>Submit</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All requests</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground"><Wrench className="h-8 w-8"/><div className="text-sm">No maintenance requests yet.</div></div>
          ) : (
            <div className="space-y-3">
              {requests.map((r:any) => (
                <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{r.title}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${priorityColor[r.priority]}`}>{r.priority}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor[r.status]}`}>{r.status.replace("_"," ")}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{r.units?.properties?.name} · Unit {r.units?.unit_number} · {new Date(r.created_at).toLocaleDateString()}</div>
                      {r.description && <p className="mt-2 text-sm text-foreground/80">{r.description}</p>}
                    </div>
                    {isStaff && r.status !== "resolved" && (
                      <div className="flex gap-2">
                        {r.status === "open" && <Button size="sm" variant="outline" onClick={()=>updateStatus.mutate({ id:r.id, status:"in_progress" })}>Start work</Button>}
                        <Button size="sm" onClick={()=>updateStatus.mutate({ id:r.id, status:"resolved" })}>Mark resolved</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
