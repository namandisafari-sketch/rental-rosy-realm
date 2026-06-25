import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Payments — Habico Portal" }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const role = useHighestRole();
  const { user } = useAuth();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ lease_id: "", amount: "0", method: "cash", reference: "", period_label: "", notes: "", payment_date: new Date().toISOString().slice(0,10) });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*, leases(monthly_rent, units(unit_number, properties(name)), tenant_id)").order("payment_date", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((p: any) => p.leases?.tenant_id).filter(Boolean)));
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((p: any) => ({ ...p, tenant: map.get(p.leases?.tenant_id) }));
    },
  });

  const { data: leases = [] } = useQuery({
    queryKey: ["leases-pick"], enabled: isStaff,
    queryFn: async () => {
      const { data } = await supabase.from("leases").select("id, monthly_rent, tenant_id, units(unit_number, properties(name))").eq("status", "active");
      const ids = Array.from(new Set((data ?? []).map((l) => l.tenant_id)));
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((l: any) => ({ ...l, profile: map.get(l.tenant_id) }));
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payments").insert({
        lease_id: form.lease_id, amount: Number(form.amount), method: form.method,
        reference: form.reference || null, period_label: form.period_label || null,
        notes: form.notes || null, payment_date: form.payment_date, recorded_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payment recorded"); setOpen(false); qc.invalidateQueries({ queryKey: ["payments"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalMonth = payments.filter((p:any) => new Date(p.payment_date).getMonth() === new Date().getMonth())
    .reduce((s:number,p:any)=>s+Number(p.amount),0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Finance</div>
          <h1 className="display text-3xl font-bold">Payments</h1>
          <p className="text-sm text-muted-foreground">This month total: <span className="font-semibold text-foreground">UGX {totalMonth.toLocaleString()}</span></p>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4"/>Record payment</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record a payment</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Lease</Label>
                  <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.lease_id} onChange={(e)=>{
                    const l:any = leases.find((x:any)=>x.id===e.target.value);
                    setForm({...form, lease_id: e.target.value, amount: l ? String(l.monthly_rent) : form.amount });
                  }}>
                    <option value="">Select lease…</option>
                    {leases.map((l:any)=> <option key={l.id} value={l.id}>{l.profile?.full_name ?? l.profile?.email} — {l.units?.properties?.name} · {l.units?.unit_number}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Amount (UGX)</Label><Input type="number" value={form.amount} onChange={(e)=>setForm({...form, amount:e.target.value})}/></div>
                  <div><Label>Date</Label><Input type="date" value={form.payment_date} onChange={(e)=>setForm({...form, payment_date:e.target.value})}/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Method</Label>
                    <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.method} onChange={(e)=>setForm({...form, method:e.target.value})}>
                      <option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="mobile_money">Mobile money</option><option value="cheque">Cheque</option>
                    </select>
                  </div>
                  <div><Label>Period (e.g. Jan 2026)</Label><Input value={form.period_label} onChange={(e)=>setForm({...form, period_label:e.target.value})}/></div>
                </div>
                <div><Label>Reference / receipt #</Label><Input value={form.reference} onChange={(e)=>setForm({...form, reference:e.target.value})}/></div>
              </div>
              <DialogFooter><Button onClick={()=>create.mutate()} disabled={!form.lease_id || create.isPending}>Record</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="display">Payment history</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No payments yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Tenant</TableHead><TableHead>Property · Unit</TableHead><TableHead>Period</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {payments.map((p:any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.payment_date}</TableCell>
                    <TableCell>{p.tenant?.full_name ?? p.tenant?.email ?? "—"}</TableCell>
                    <TableCell>{p.leases?.units?.properties?.name} · {p.leases?.units?.unit_number}</TableCell>
                    <TableCell>{p.period_label ?? "—"}</TableCell>
                    <TableCell><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{p.method}</span></TableCell>
                    <TableCell className="text-right font-semibold">UGX {Number(p.amount).toLocaleString()}</TableCell>
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
