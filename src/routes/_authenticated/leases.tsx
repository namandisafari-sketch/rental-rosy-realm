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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, XCircle, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leases")({
  head: () => ({ meta: [{ title: "Leases — Habico Portal" }] }),
  component: LeasesPage,
});

const PAYMENT_DUE_DAYS = [1, 5, 10, 15, 20, 25, 28];
const BILLING_PERIODS = ["monthly", "quarterly", "bi_annual", "annual"];
const TERMINATION_REASONS = ["Left without paying", "Absconded", "Evicted", "Dispute", "Other"];
const LATE_PENALTY_RATE = 0.05; // 5% per clause 3

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  ended: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  terminated: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function LeasesPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<any>(null);
  const [terminatingLease, setTerminatingLease] = useState<any>(null);

  const blankForm = {
    unit_id: "", tenant_email: "", monthly_rent: "0", deposit: "0",
    deposit_months: "1", start_date: new Date().toISOString().slice(0, 10), end_date: "",
    payment_due_day: "25", billing_period: "monthly",
    late_fee_amount: "0", late_fee_grace_days: "0", special_conditions: "",
  };
  const [form, setForm] = useState({ ...blankForm });

  const [terminateForm, setTerminateForm] = useState({ outstanding_balance: "0", termination_reason: "" });

  const { data: leases = [] } = useQuery({
    queryKey: ["leases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leases")
        .select("*, units(unit_number, properties(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((l: any) => l.tenant_id)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] };
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((l: any) => ({ ...l, profile: map.get(l.tenant_id) }));
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units-all"], enabled: isStaff,
    queryFn: async () => {
      const { data } = await supabase
        .from("units")
        .select("id, unit_number, monthly_rent, status, properties(name)")
        .order("unit_number");
      return data ?? [];
    },
  });

  const now = new Date();
  const activeLeases = leases.filter((l: any) => l.status === "active");
  const activeCount = activeLeases.length;
  const totalMonthly = activeLeases.reduce((s: number, l: any) => s + Number(l.monthly_rent), 0);
  const expiringSoon = activeLeases.filter((l: any) => {
    if (!l.end_date) return false;
    const end = new Date(l.end_date);
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 30;
  }).length;

  const create = useMutation({
    mutationFn: async () => {
      const { data: prof, error: pe } = await supabase.from("profiles").select("id").eq("email", form.tenant_email).maybeSingle();
      if (pe) throw pe;
      if (!prof) throw new Error("No tenant account found for that email. Ask them to sign up first.");
      const monthlyRent = Number(form.monthly_rent);
      const lateFee = Number(form.late_fee_amount) || Math.round(monthlyRent * LATE_PENALTY_RATE);
      const { error } = await supabase.from("leases").insert({
        unit_id: form.unit_id, tenant_id: prof.id,
        monthly_rent: monthlyRent, deposit: Number(form.deposit),
        deposit_months: Number(form.deposit_months),
        start_date: form.start_date, end_date: form.end_date || null,
        payment_due_day: Number(form.payment_due_day), billing_period: form.billing_period,
        late_fee_amount: lateFee,
        late_fee_grace_days: Number(form.late_fee_grace_days),
        special_conditions: form.special_conditions || null,
        notice_period_days: 30,
      });
      if (error) throw error;
      await supabase.from("units").update({ status: "occupied" }).eq("id", form.unit_id);
    },
    onSuccess: () => { toast.success("Lease created"); setOpen(false); setForm({ ...blankForm }); qc.invalidateQueries({ queryKey: ["leases"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editingLease) return;
      if (editingLease.unit_id !== form.unit_id) {
        await supabase.from("units").update({ status: "vacant" }).eq("id", editingLease.unit_id);
        await supabase.from("units").update({ status: "occupied" }).eq("id", form.unit_id);
      }
      const monthlyRent = Number(form.monthly_rent);
      const lateFee = Number(form.late_fee_amount) || Math.round(monthlyRent * LATE_PENALTY_RATE);
      const { error } = await supabase.from("leases").update({
        unit_id: form.unit_id, monthly_rent: monthlyRent,
        deposit: Number(form.deposit), deposit_months: Number(form.deposit_months),
        start_date: form.start_date, end_date: form.end_date || null,
        payment_due_day: Number(form.payment_due_day), billing_period: form.billing_period,
        late_fee_amount: lateFee,
        late_fee_grace_days: Number(form.late_fee_grace_days),
        special_conditions: form.special_conditions || null,
        notice_period_days: 30,
      }).eq("id", editingLease.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lease updated"); setEditOpen(false); setEditingLease(null); setForm({ ...blankForm }); qc.invalidateQueries({ queryKey: ["leases"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const terminate = useMutation({
    mutationFn: async () => {
      if (!terminatingLease) return;
      await supabase.from("leases").update({
        status: "terminated", outstanding_balance: Number(terminateForm.outstanding_balance),
        termination_reason: terminateForm.termination_reason,
        termination_date: new Date().toISOString().slice(0, 10),
      }).eq("id", terminatingLease.id);
      await supabase.from("units").update({ status: "vacant" }).eq("id", terminatingLease.unit_id);
    },
    onSuccess: () => {
      toast.success("Lease terminated");
      setTerminateOpen(false); setTerminatingLease(null);
      setTerminateForm({ outstanding_balance: "0", termination_reason: "" });
      qc.invalidateQueries({ queryKey: ["leases"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function openEdit(l: any) {
    setEditingLease(l);
    setForm({
      unit_id: l.unit_id, tenant_email: l.profile?.email ?? "",
      monthly_rent: String(l.monthly_rent), deposit: String(l.deposit ?? 0),
      deposit_months: String(l.deposit_months ?? 1),
      start_date: l.start_date, end_date: l.end_date ?? "",
      payment_due_day: String(l.payment_due_day ?? 1),
      billing_period: l.billing_period ?? "monthly",
      late_fee_amount: String(l.late_fee_amount ?? 0),
      late_fee_grace_days: String(l.late_fee_grace_days ?? 0),
      special_conditions: l.special_conditions ?? "",
    });
    setEditOpen(true);
  }

  function openTerminate(l: any) {
    setTerminatingLease(l);
    setTerminateForm({ outstanding_balance: "0", termination_reason: "" });
    setTerminateOpen(true);
  }

  function unitChange(value: string) {
    const u = units.find((x: any) => x.id === value) as any;
    const rent = u ? String(u.monthly_rent) : "0";
    setForm({ ...form, unit_id: value, monthly_rent: rent, deposit: String(Number(rent) * Number(form.deposit_months)) });
  }

  function monthlyRentChange(value: string) {
    setForm({ ...form, monthly_rent: value, deposit: String(Number(value) * Number(form.deposit_months)) });
  }

  function depositMonthsChange(value: string) {
    setForm({ ...form, deposit_months: value, deposit: String(Number(form.monthly_rent) * Number(value)) });
  }

  function daysRemaining(endDate: string | null): number | null {
    if (!endDate) return null;
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  function DaysCell({ endDate }: { endDate: string | null }) {
    const diff = daysRemaining(endDate);
    if (diff === null) return <TableCell className="text-sm text-muted-foreground">—</TableCell>;
    if (diff < 0) return <TableCell className="text-sm font-semibold text-destructive">Expired</TableCell>;
    if (diff <= 30) return <TableCell className="text-sm font-semibold text-orange-500">{diff} days</TableCell>;
    return <TableCell className="text-sm">{diff} days</TableCell>;
  }

  function StatusBadge({ status }: { status: string }) {
    const color = statusColors[status] ?? "bg-secondary text-muted-foreground";
    return <span className={`rounded-full px-2 py-0.5 text-xs ${color}`}>{status}</span>;
  }

  function renderFormFields(isEdit = false) {
    return (
      <div className="space-y-3">
        <div>
          <Label>Unit</Label>
          <Select value={form.unit_id} onValueChange={unitChange}>
            <SelectTrigger><SelectValue placeholder="Select unit…" /></SelectTrigger>
            <SelectContent>
              {units.map((u: any) => {
                const isOccupied = u.status === "occupied";
                const isCurrent = isEdit && u.id === editingLease?.unit_id;
                return (
                  <SelectItem key={u.id} value={u.id} disabled={!isEdit && isOccupied}>
                    {u.properties?.name} · Unit {u.unit_number} — UGX {Number(u.monthly_rent).toLocaleString()}/mo
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tenant email {isEdit ? "(cannot change)" : "(must have signed up)"}</Label>
          <Input value={form.tenant_email} onChange={(e: any) => setForm({ ...form, tenant_email: e.target.value })} disabled={isEdit} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Monthly rent (UGX)</Label>
            <Input type="number" value={form.monthly_rent} onChange={(e: any) => monthlyRentChange(e.target.value)} />
          </div>
          <div>
            <Label>Deposit months</Label>
            <Select value={form.deposit_months} onValueChange={depositMonthsChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} month{n > 1 ? "s" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Deposit amount (UGX)</Label>
            <Input type="number" value={form.deposit} onChange={(e: any) => setForm({ ...form, deposit: e.target.value })} />
          </div>
          <div>
            <Label>Payment due day</Label>
            <Select value={form.payment_due_day} onValueChange={(v) => setForm({ ...form, payment_due_day: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_DUE_DAYS.map((d) => (
                  <SelectItem key={d} value={String(d)}>{d > 28 ? "End of month" : `Day ${d}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Billing period</Label>
            <Select value={form.billing_period} onValueChange={(v) => setForm({ ...form, billing_period: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BILLING_PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>{p.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Late fee (UGX)</Label>
            <Input type="number" value={form.late_fee_amount} onChange={(e: any) => setForm({ ...form, late_fee_amount: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Late fee grace days</Label>
            <Input type="number" value={form.late_fee_grace_days} onChange={(e: any) => setForm({ ...form, late_fee_grace_days: e.target.value })} />
          </div>
          <div>
            <Label>Start date</Label>
            <Input type="date" value={form.start_date} onChange={(e: any) => setForm({ ...form, start_date: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>End date (optional)</Label>
          <Input type="date" value={form.end_date} onChange={(e: any) => setForm({ ...form, end_date: e.target.value })} />
        </div>
        <div>
          <Label>Special conditions</Label>
          <Textarea value={form.special_conditions} onChange={(e: any) => setForm({ ...form, special_conditions: e.target.value })} placeholder="Any special terms or conditions…" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Agreements</div>
          <h1 className="display text-3xl font-bold">Leases</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm({ ...blankForm }); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />New lease</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>New lease</DialogTitle></DialogHeader>
              {renderFormFields()}
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!form.unit_id || !form.tenant_email || create.isPending}>Create lease</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Leases</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{activeCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Monthly Recurring</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">UGX {totalMonthly.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Expiring Soon (≤30 days)</CardTitle></CardHeader>
          <CardContent><div className={`text-2xl font-bold ${expiringSoon > 0 ? "text-orange-500" : ""}`}>{expiringSoon}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">All leases</CardTitle></CardHeader>
        <CardContent>
          {leases.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Building2 className="h-10 w-10 text-muted-foreground" />
              <div className="font-medium">No leases yet</div>
              <div className="text-sm text-muted-foreground">{isStaff ? "Create a lease to get started." : "No active leases at the moment."}</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead><TableHead>Property · Unit</TableHead><TableHead>Monthly Rent</TableHead><TableHead>Arrears</TableHead><TableHead>Late Fee (5%)</TableHead><TableHead>Days Remaining</TableHead><TableHead>Deposit</TableHead><TableHead>Status</TableHead>
                  {isStaff && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.map((l: any) => {
                  const lateFee = l.late_fee_amount ?? Math.round(Number(l.monthly_rent) * LATE_PENALTY_RATE);
                  return (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.profile?.full_name ?? l.profile?.email ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.units?.properties?.name} · {l.units?.unit_number}</TableCell>
                    <TableCell className="font-semibold">UGX {Number(l.monthly_rent).toLocaleString()}</TableCell>
                    <TableCell className="text-red-500 font-medium">UGX {Number(l.outstanding_balance ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">UGX {lateFee.toLocaleString()}</TableCell>
                    <DaysCell endDate={l.end_date} />
                    <TableCell>UGX {Number(l.deposit ?? 0).toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={l.status} /></TableCell>
                    {isStaff && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(l)} title="Edit lease"><Pencil className="h-4 w-4" /></Button>
                          {l.status === "active" && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openTerminate(l)} title="Terminate lease"><XCircle className="h-4 w-4" /></Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setEditingLease(null); setForm({ ...blankForm }); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit lease</DialogTitle></DialogHeader>
          {renderFormFields(true)}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); setEditingLease(null); setForm({ ...blankForm }); }}>Cancel</Button>
            <Button onClick={() => update.mutate()} disabled={!form.unit_id || update.isPending}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={terminateOpen} onOpenChange={(v) => { setTerminateOpen(v); if (!v) { setTerminatingLease(null); setTerminateForm({ outstanding_balance: "0", termination_reason: "" }); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Terminate Lease (30-day notice)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <AlertDialogDescription className="text-sm">
              {terminatingLease && (
                <span>
                  Ending lease for <strong>{terminatingLease.profile?.full_name ?? terminatingLease.profile?.email}</strong> at {terminatingLease.units?.properties?.name} · {terminatingLease.units?.unit_number}. Per clause 10(a), either party must give <strong>30 days' notice</strong>. Outstanding arrears will be tracked. The unit will be marked as vacant and deposit refund processed within 2 weeks per clause 4.
                </span>
              )}
            </AlertDialogDescription>
            <div>
              <Label>Outstanding balance (UGX)</Label>
              <Input type="number" value={terminateForm.outstanding_balance} onChange={(e: any) => setTerminateForm({ ...terminateForm, outstanding_balance: e.target.value })} />
            </div>
            <div>
              <Label>Termination reason *</Label>
              <Select value={terminateForm.termination_reason} onValueChange={(v) => setTerminateForm({ ...terminateForm, termination_reason: v })}>
                <SelectTrigger><SelectValue placeholder="Select reason…" /></SelectTrigger>
                <SelectContent>
                  {TERMINATION_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTerminateOpen(false); setTerminatingLease(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => terminate.mutate()} disabled={!terminateForm.termination_reason || terminate.isPending}>
              {terminate.isPending ? "Processing…" : "Terminate lease"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
