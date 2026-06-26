import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Repeat, Send, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recurring-billing")({
  component: RecurringBilling,
});

function RecurringBilling() {
  const role = useHighestRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ lease_id: "", due_day: 1, amount: 0, reminder_type: "auto" });

  const remindersQ = useQuery({
    queryKey: ["payment_reminders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_reminders")
        .select("*, lease:lease_id(id, monthly_rent, tenant:tenant_id(id, full_name), unit:unit_id(id, unit_number, property:property_id(id, name)))")
        .order("next_reminder_date", { ascending: true, nullsFirst: false }) as any;
      return (data ?? []) as any[];
    },
  });

  const reminders = remindersQ.data ?? [];

  const leasesQ = useQuery({
    queryKey: ["leases_for_reminder"],
    queryFn: async () => {
      const { data: existing } = await supabase.from("payment_reminders").select("lease_id") as any;
      const existingIds = (existing ?? []).map((r: any) => r.lease_id);
      const { data } = await supabase
        .from("leases")
        .select("id, monthly_rent, tenant:tenant_id(id, full_name), unit:unit_id(id, unit_number, property:property_id(id, name))")
        .eq("status", "active") as any;
      return ((data ?? []) as any[]).filter((l: any) => !existingIds.includes(l.id));
    },
  });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const paidThisMonthQ = useQuery({
    queryKey: ["paid_this_month", currentMonth, currentYear],
    queryFn: async () => {
      const start = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
      const { data } = await supabase
        .from("payments")
        .select("lease_id")
        .gte("payment_date", start)
        .lte("payment_date", `${currentYear}-${String(currentMonth).padStart(2, "0")}-31`) as any;
      return new Set((data ?? []).map((p: any) => p.lease_id));
    },
  });

  const paidLeaseIds = paidThisMonthQ.data ?? new Set();

  const activeReminders = reminders.filter((r: any) => r.is_active);
  const monthlyTotal = activeReminders.reduce((s: number, r: any) => s + Number(r.amount), 0);

  const overdueCount = reminders.filter((r: any) => {
    if (!r.is_active) return false;
    const today = now.getDate();
    const dueDay = Number(r.due_day);
    if (dueDay >= today) return false;
    return !paidLeaseIds.has(r.lease_id);
  }).length;

  const createReminder = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payment_reminders").insert({
        lease_id: form.lease_id,
        due_day: form.due_day,
        amount: form.amount,
        reminder_type: form.reminder_type,
        is_active: true,
      }) as any;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment_reminders"] });
      qc.invalidateQueries({ queryKey: ["leases_for_reminder"] });
      setOpen(false);
      setForm({ lease_id: "", due_day: 1, amount: 0, reminder_type: "auto" });
      toast.success("Reminder created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleReminder = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("payment_reminders").update({ is_active }).eq("id", id) as any;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment_reminders"] });
      toast.success("Reminder updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendNow = useMutation({
    mutationFn: async (id: string) => {
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      const { error } = await supabase
        .from("payment_reminders")
        .update({ last_reminder_sent: new Date().toISOString(), next_reminder_date: next.toISOString().slice(0, 10) })
        .eq("id", id) as any;
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment_reminders"] });
      toast.success("Reminder sent");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!role || role === "owner" || role === "tenant") {
    return <div className="text-center text-muted-foreground py-12">Access restricted to staff.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Recurring Billing</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Create Reminder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Payment Reminder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Lease (Tenant — Property/Unit)</Label>
                <Select
                  value={form.lease_id}
                  onValueChange={(v) => {
                    const lease = (leasesQ.data ?? []).find((l: any) => l.id === v);
                    setForm((f) => ({
                      ...f,
                      lease_id: v,
                      amount: lease?.monthly_rent ?? 0,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a lease" />
                  </SelectTrigger>
                  <SelectContent>
                    {(leasesQ.data ?? []).map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.tenant?.full_name ?? "Unknown"} — {l.unit?.property?.name ?? ""} / {l.unit?.unit_number ?? ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Day (1–31)</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={form.due_day}
                  onChange={(e) => setForm((f) => ({ ...f, due_day: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount (UGX)</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Reminder Type</Label>
                <Select
                  value={form.reminder_type}
                  onValueChange={(v) => setForm((f) => ({ ...f, reminder_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => createReminder.mutate()} disabled={!form.lease_id || createReminder.isPending}>
                {createReminder.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Reminders</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeReminders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring Total</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">UGX {monthlyTotal.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue Payments</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueCount > 0 ? "text-red-600" : ""}`}>
              {overdueCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Reminders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lease / Tenant</TableHead>
                <TableHead>Property / Unit</TableHead>
                <TableHead>Due Day</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Sent</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reminders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No payment reminders configured.
                  </TableCell>
                </TableRow>
              )}
              {reminders.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.lease?.tenant?.full_name ?? "—"}</TableCell>
                  <TableCell>
                    {r.lease?.unit?.property?.name ?? ""} / {r.lease?.unit?.unit_number ?? ""}
                  </TableCell>
                  <TableCell>{r.due_day}</TableCell>
                  <TableCell>UGX {Number(r.amount).toLocaleString()}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.reminder_type === "auto"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {r.reminder_type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleReminder.mutate({ id: r.id, is_active: !r.is_active })
                      }
                    >
                      {r.is_active ? (
                        <ToggleRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="ml-1 text-xs">{r.is_active ? "Active" : "Paused"}</span>
                    </Button>
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.last_reminder_sent
                      ? new Date(r.last_reminder_sent).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.next_reminder_date
                      ? new Date(r.next_reminder_date).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {r.reminder_type === "manual" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendNow.mutate(r.id)}
                        disabled={sendNow.isPending}
                      >
                        <Send className="mr-1 h-3 w-3" /> Send Now
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
