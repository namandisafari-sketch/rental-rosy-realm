import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leases")({
  head: () => ({ meta: [{ title: "Leases — Habico Portal" }] }),
  component: LeasesPage,
});

function LeasesPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ unit_id: "", tenant_email: "", monthly_rent: "0", deposit: "0", start_date: new Date().toISOString().slice(0,10), end_date: "" });

  const { data: leases = [] } = useQuery({
    queryKey: ["leases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leases").select("*, units(unit_number, properties(name))").order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((l) => l.tenant_id)));
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((l) => ({ ...l, profile: map.get(l.tenant_id) }));
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units-all"], enabled: isStaff,
    queryFn: async () => {
      const { data } = await supabase.from("units").select("id, unit_number, monthly_rent, properties(name)").order("unit_number");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      // look up tenant by email
      const { data: prof, error: pe } = await supabase.from("profiles").select("id").eq("email", form.tenant_email).maybeSingle();
      if (pe) throw pe;
      if (!prof) throw new Error("No tenant account found for that email. Ask them to sign up first.");
      const { error } = await supabase.from("leases").insert({
        unit_id: form.unit_id, tenant_id: prof.id,
        monthly_rent: Number(form.monthly_rent), deposit: Number(form.deposit),
        start_date: form.start_date, end_date: form.end_date || null,
      });
      if (error) throw error;
      await supabase.from("units").update({ status: "occupied" }).eq("id", form.unit_id);
    },
    onSuccess: () => { toast.success("Lease created"); setOpen(false); qc.invalidateQueries({ queryKey: ["leases"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Agreements</div>
          <h1 className="display text-3xl font-bold">Leases</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4"/>New lease</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New lease</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Unit</Label>
                  <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.unit_id} onChange={(e)=>{
                    const u = units.find((x:any)=>x.id===e.target.value) as any;
                    setForm({...form, unit_id: e.target.value, monthly_rent: u ? String(u.monthly_rent) : form.monthly_rent });
                  }}>
                    <option value="">Select unit…</option>
                    {units.map((u:any)=> <option key={u.id} value={u.id}>{u.properties?.name} · Unit {u.unit_number}</option>)}
                  </select>
                </div>
                <div><Label>Tenant email (must have signed up)</Label><Input value={form.tenant_email} onChange={(e)=>setForm({...form, tenant_email:e.target.value})}/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Monthly rent</Label><Input type="number" value={form.monthly_rent} onChange={(e)=>setForm({...form, monthly_rent:e.target.value})}/></div>
                  <div><Label>Deposit</Label><Input type="number" value={form.deposit} onChange={(e)=>setForm({...form, deposit:e.target.value})}/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Start date</Label><Input type="date" value={form.start_date} onChange={(e)=>setForm({...form, start_date:e.target.value})}/></div>
                  <div><Label>End date (optional)</Label><Input type="date" value={form.end_date} onChange={(e)=>setForm({...form, end_date:e.target.value})}/></div>
                </div>
              </div>
              <DialogFooter><Button onClick={()=>create.mutate()} disabled={!form.unit_id || !form.tenant_email || create.isPending}>Create lease</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All leases</CardTitle></CardHeader>
        <CardContent>
          {leases.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No leases yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Tenant</TableHead><TableHead>Property · Unit</TableHead><TableHead>Rent</TableHead><TableHead>Start</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {leases.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.profile?.full_name ?? l.profile?.email ?? "—"}</TableCell>
                    <TableCell>{l.units?.properties?.name} · {l.units?.unit_number}</TableCell>
                    <TableCell>UGX {Number(l.monthly_rent).toLocaleString()}</TableCell>
                    <TableCell>{l.start_date}</TableCell>
                    <TableCell><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{l.status}</span></TableCell>
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
