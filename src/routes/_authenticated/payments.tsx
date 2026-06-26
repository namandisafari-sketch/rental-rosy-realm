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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Receipt, Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Payments — Habico Portal" }] }),
  component: PaymentsPage,
});

const PAYMENT_TYPES = ["Rent", "Deposit", "Late Fee", "Utility", "Other"] as const;
const METHODS = ["cash", "bank", "mobile_money", "cheque"] as const;
const MONTHS_OPTIONS = [1, 2, 3, 4, 6, 12] as const;

function addMonths(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

function PaymentsPage() {
  const role = useHighestRole();
  const { user } = useAuth();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<any>(null);
  const [voidId, setVoidId] = useState<string | null>(null);

  const [form, setForm] = useState({
    lease_id: "",
    amount: "",
    method: "cash",
    reference: "",
    period_label: "",
    notes: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_type: "Rent",
    months_covered: "1",
    period_start: "",
  });

  const [editForm, setEditForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
    payment_date: "",
    notes: "",
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, leases(monthly_rent, units(unit_number, properties(name)), tenant_id)")
        .order("payment_date", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((p: any) => p.leases?.tenant_id).filter(Boolean)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] };
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((p: any) => ({ ...p, tenant: map.get(p.leases?.tenant_id) }));
    },
  });

  const { data: leases = [] } = useQuery({
    queryKey: ["leases-pick"],
    enabled: isStaff,
    queryFn: async () => {
      const { data } = await supabase
        .from("leases")
        .select("id, monthly_rent, tenant_id, units(unit_number, properties(name))")
        .eq("status", "active");
      const ids = Array.from(new Set((data ?? []).map((l: any) => l.tenant_id)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] };
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((l: any) => ({ ...l, profile: map.get(l.tenant_id) }));
    },
  });

  const { data: activeLeasesCount = 0 } = useQuery({
    queryKey: ["leases-count-active"],
    queryFn: async () => {
      const { count } = await supabase
        .from("leases")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      return count ?? 0;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = {
        lease_id: form.lease_id,
        amount: Number(form.amount),
        method: form.method,
        reference: form.reference || null,
        period_label: form.period_label || null,
        notes: form.notes || null,
        payment_date: form.payment_date,
        payment_type: form.payment_type,
        recorded_by: user?.id,
      };
      if (form.payment_type === "Rent") {
        payload.months_covered = Number(form.months_covered);
        payload.period_start = form.period_start || null;
        payload.period_end = form.period_start ? addMonths(form.period_start, Number(form.months_covered)) : null;
      }
      const { error } = await supabase.from("payments").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["payments"] });
      setForm({
        lease_id: "", amount: "", method: "cash", reference: "", period_label: "",
        notes: "", payment_date: new Date().toISOString().slice(0, 10),
        payment_type: "Rent", months_covered: "1", period_start: "",
      });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("payments")
        .update({
          amount: Number(editForm.amount),
          method: editForm.method,
          reference: editForm.reference || null,
          payment_date: editForm.payment_date,
          notes: editForm.notes || null,
        })
        .eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment updated");
      setEditOpen(false);
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment voided");
      setVoidId(null);
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const now = new Date();
  const thisMonthPayments = payments.filter(
    (p: any) =>
      new Date(p.payment_date).getMonth() === now.getMonth() &&
      new Date(p.payment_date).getFullYear() === now.getFullYear(),
  );
  const thisMonthTotal = thisMonthPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const rentCollected = thisMonthPayments
    .filter((p: any) => p.payment_type === "Rent" || !p.payment_type)
    .reduce((s: number, p: any) => s + Number(p.amount), 0);
  const rentCount = thisMonthPayments.filter(
    (p: any) => p.payment_type === "Rent" || !p.payment_type,
  ).length;

  function openEdit(p: any) {
    setEditId(p.id);
    setEditForm({
      amount: String(p.amount),
      method: p.method,
      reference: p.reference || "",
      payment_date: p.payment_date,
      notes: p.notes || "",
    });
    setEditOpen(true);
  }

  function openReceipt(p: any) {
    setReceiptPayment(p);
    setReceiptOpen(true);
  }

  const selectedLease = leases.find((l: any) => l.id === form.lease_id) as any;
  const monthsCovered = Number(form.months_covered);
  const periodEnd = form.payment_type === "Rent" && form.period_start
    ? addMonths(form.period_start, monthsCovered)
    : "";

  function handleLeaseChange(id: string) {
    const l: any = leases.find((x: any) => x.id === id);
    setForm((f) => ({
      ...f,
      lease_id: id,
      amount: l ? String(l.monthly_rent) : f.amount,
    }));
  }

  function handleMonthsChange(val: string) {
    setForm((f) => {
      const m = Number(val);
      const base = selectedLease?.monthly_rent ?? 0;
      const next = { ...f, months_covered: val };
      if (f.payment_type === "Rent" && base) {
        next.amount = String(base * m);
      }
      return next;
    });
  }

  function handlePaymentTypeChange(val: string) {
    setForm((f) => ({
      ...f,
      payment_type: val,
      amount: val === "Rent" && selectedLease?.monthly_rent
        ? String(selectedLease.monthly_rent * Number(f.months_covered))
        : f.amount,
      months_covered: "1",
      period_start: "",
    }));
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Finance</div>
          <h1 className="display text-3xl font-bold">Payments</h1>
        </div>
        {isStaff && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="mr-2 h-4 w-4" />Record payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Record a payment</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Lease</Label>
                  <select
                    className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm"
                    value={form.lease_id}
                    onChange={(e) => handleLeaseChange(e.target.value)}
                  >
                    <option value="">Select lease…</option>
                    {leases.map((l: any) => (
                      <option key={l.id} value={l.id}>
                        {l.profile?.full_name ?? l.profile?.email} — {l.units?.properties?.name} · {l.units?.unit_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Payment type</Label>
                  <Select value={form.payment_type} onValueChange={handlePaymentTypeChange}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {form.payment_type === "Rent" && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Period start</Label>
                      <Input
                        type="date"
                        className="mt-1.5"
                        value={form.period_start}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, period_start: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Months</Label>
                      <Select value={form.months_covered} onValueChange={handleMonthsChange}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MONTHS_OPTIONS.map((m) => (
                            <SelectItem key={m} value={String(m)}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Period end</Label>
                      <Input
                        type="date"
                        className="mt-1.5"
                        value={periodEnd}
                        readOnly
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Amount (UGX)</Label>
                    <Input
                      type="number"
                      className="mt-1.5"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      className="mt-1.5"
                      value={form.payment_date}
                      onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Method</Label>
                  <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Period label (e.g. Jan 2026)</Label>
                  <Input
                    className="mt-1.5"
                    value={form.period_label}
                    onChange={(e) => setForm((f) => ({ ...f, period_label: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>Reference / receipt #</Label>
                  <Input
                    className="mt-1.5"
                    value={form.reference}
                    onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea
                    className="mt-1.5"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => create.mutate()}
                  disabled={!form.lease_id || !form.amount || create.isPending}
                >
                  Record
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">This Month Total</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">UGX {thisMonthTotal.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Rent Collected</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">UGX {rentCollected.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{rentCount} payment{rentCount !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Leases</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{activeLeasesCount}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">Payment history</CardTitle></CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No payments yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Property · Unit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {isStaff && <TableHead className="w-32">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">{p.payment_date}</TableCell>
                      <TableCell>{p.tenant?.full_name ?? p.tenant?.email ?? "—"}</TableCell>
                      <TableCell>{p.leases?.units?.properties?.name} · {p.leases?.units?.unit_number}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                          {p.payment_type ?? "Rent"}
                        </span>
                      </TableCell>
                      <TableCell>{p.period_label ?? "—"}</TableCell>
                      <TableCell>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{p.method}</span>
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">
                        UGX {Number(p.amount).toLocaleString()}
                      </TableCell>
                      {isStaff && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Receipt" onClick={() => openReceipt(p)}>
                              <Receipt className="h-4 w-4" />
                            </Button>
                            <AlertDialog open={voidId === p.id} onOpenChange={(o) => !o && setVoidId(null)}>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title="Void" onClick={() => setVoidId(p.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Void payment?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete this payment record. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground"
                                    onClick={() => remove.mutate(p.id)}
                                  >
                                    Void
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount (UGX)</Label><Input type="number" className="mt-1.5" value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>Date</Label><Input type="date" className="mt-1.5" value={editForm.payment_date} onChange={(e) => setEditForm((f) => ({ ...f, payment_date: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Method</Label>
              <Select value={editForm.method} onValueChange={(v) => setEditForm((f) => ({ ...f, method: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reference / receipt #</Label><Input className="mt-1.5" value={editForm.reference} onChange={(e) => setEditForm((f) => ({ ...f, reference: e.target.value }))} /></div>
            <div><Label>Notes</Label><Textarea className="mt-1.5" value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => update.mutate()} disabled={!editForm.amount || update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Printer className="mr-2 inline-block h-5 w-5" />
              Payment Receipt
            </DialogTitle>
          </DialogHeader>
          {receiptPayment && (
            <div id="receipt-content" className="space-y-3 text-sm">
              <div className="border-b pb-2 text-center">
                <p className="text-lg font-bold">Habico Portal</p>
                <p className="text-xs text-muted-foreground">Payment Receipt</p>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Receipt #</span>
                <span className="font-medium">{receiptPayment.reference ?? "—"}</span>
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{receiptPayment.payment_date}</span>
                <span className="text-muted-foreground">Tenant</span>
                <span className="font-medium">{receiptPayment.tenant?.full_name ?? receiptPayment.tenant?.email ?? "—"}</span>
                <span className="text-muted-foreground">Property</span>
                <span className="font-medium">{receiptPayment.leases?.units?.properties?.name ?? "—"}</span>
                <span className="text-muted-foreground">Unit</span>
                <span className="font-medium">{receiptPayment.leases?.units?.unit_number ?? "—"}</span>
                <span className="text-muted-foreground">Period</span>
                <span className="font-medium">{receiptPayment.period_label ?? "—"}</span>
                <span className="text-muted-foreground">Payment type</span>
                <span className="font-medium">{receiptPayment.payment_type ?? "Rent"}</span>
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium capitalize">{receiptPayment.method.replace("_", " ")}</span>
              </div>
              <div className="border-t pt-2 text-right">
                <span className="text-lg font-bold">UGX {Number(receiptPayment.amount).toLocaleString()}</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />Print
            </Button>
            <Button variant="ghost" onClick={() => setReceiptOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
