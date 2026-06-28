// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Plus, Users, UserCheck, Clock, FileText, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [{ title: "Employees — Habico Portal" }] }),
  component: EmployeesPage,
});

const roleOptions = ["worker", "supervisor", "manager", "admin", "contractor"];
const typeOptions = ["full_time", "part_time", "contract", "casual"];

const roleColor: Record<string, string> = {
  worker: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  supervisor: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  manager: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  admin: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  contractor: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
};

const typeColor: Record<string, string> = {
  full_time: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  part_time: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  contract: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  casual: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

function EmployeesPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filterRole, setFilterRole] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", role: "worker", employee_type: "full_time",
    daily_rate: "0", monthly_salary: "0", bank_account: "", tax_id: "", national_id: "",
    emergency_contact: "", emergency_phone: "", hire_date: "", notes: "",
  });

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => setForm({
    full_name: "", phone: "", email: "", role: "worker", employee_type: "full_time",
    daily_rate: "0", monthly_salary: "0", bank_account: "", tax_id: "", national_id: "",
    emergency_contact: "", emergency_phone: "", hire_date: "", notes: "",
  });

  const openEdit = (e: any) => {
    setEditing(e);
    setForm({
      full_name: e.full_name ?? "", phone: e.phone ?? "", email: e.email ?? "",
      role: e.role ?? "worker", employee_type: e.employee_type ?? "full_time",
      daily_rate: String(e.daily_rate ?? "0"), monthly_salary: String(e.monthly_salary ?? "0"),
      bank_account: e.bank_account ?? "", tax_id: e.tax_id ?? "", national_id: e.national_id ?? "",
      emergency_contact: e.emergency_contact ?? "", emergency_phone: e.emergency_phone ?? "",
      hire_date: e.hire_date ?? "", notes: e.notes ?? "",
    });
    setOpen(true);
  };

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").insert({
        full_name: form.full_name, phone: form.phone || null, email: form.email || null,
        role: form.role, employee_type: form.employee_type,
        daily_rate: Number(form.daily_rate), monthly_salary: Number(form.monthly_salary),
        bank_account: form.bank_account || null, tax_id: form.tax_id || null,
        national_id: form.national_id || null, emergency_contact: form.emergency_contact || null,
        emergency_phone: form.emergency_phone || null, hire_date: form.hire_date || null,
        notes: form.notes || null, status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Employee created"); setOpen(false); resetForm(); qc.invalidateQueries({ queryKey: ["employees"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employees").update({
        full_name: form.full_name, phone: form.phone || null, email: form.email || null,
        role: form.role, employee_type: form.employee_type,
        daily_rate: Number(form.daily_rate), monthly_salary: Number(form.monthly_salary),
        bank_account: form.bank_account || null, tax_id: form.tax_id || null,
        national_id: form.national_id || null, emergency_contact: form.emergency_contact || null,
        emergency_phone: form.emergency_phone || null, hire_date: form.hire_date || null,
        notes: form.notes || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Employee updated"); setOpen(false); setEditing(null); resetForm(); qc.invalidateQueries({ queryKey: ["employees"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("employees").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const filtered = employees.filter((e: any) => {
    if (filterRole && e.role !== filterRole) return false;
    if (filterType && e.employee_type !== filterType) return false;
    if (filterStatus && e.status !== filterStatus) return false;
    if (search && !e.full_name?.toLowerCase().includes(search.toLowerCase()) && !e.phone?.includes(search)) return false;
    return true;
  });

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e: any) => e.status === "active").length;
  const dailyWorkers = employees.filter((e: any) => e.employee_type === "casual" || e.employee_type === "part_time").length;
  const onContract = employees.filter((e: any) => e.employee_type === "contract").length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">People</div>
          <h1 className="display text-3xl font-bold">Employees</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setEditing(null); resetForm(); } setOpen(v); }}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />Add employee</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit employee" : "Add an employee"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Personal Info</h3></div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Full name *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Enter full name" /></div>
                      <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +256 700 000 000" /></div>
                    </div>
                    <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="employee@example.com" /></div>
                    <div><Label>National ID</Label><Input value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} placeholder="National identification number" /></div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Employment</h3></div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Role *</Label>
                        <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                          {roleOptions.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                        </select>
                      </div>
                      <div><Label>Type *</Label>
                        <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.employee_type} onChange={(e) => setForm({ ...form, employee_type: e.target.value })}>
                          {typeOptions.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Daily rate (UGX)</Label><Input type="number" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} placeholder="0" /></div>
                      <div><Label>Monthly salary (UGX)</Label><Input type="number" value={form.monthly_salary} onChange={(e) => setForm({ ...form, monthly_salary: e.target.value })} placeholder="0" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Bank account</Label><Input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} placeholder="Account number" /></div>
                      <div><Label>Tax ID</Label><Input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} placeholder="Tax identification number" /></div>
                    </div>
                    <div><Label>Hire date</Label><Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Emergency Contact</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Contact name</Label><Input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Full name" /></div>
                    <div><Label>Emergency phone</Label><Input value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} placeholder="e.g. +256 700 000 000" /></div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Notes</h3></div>
                  <div><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes or remarks" /></div>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={() => (editing ? update : create).mutate()} disabled={!form.full_name || create.isPending || update.isPending}>
                  {(create.isPending || update.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? "Save" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Employees</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalEmployees}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Active</CardTitle><UserCheck className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{activeEmployees}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Daily Workers</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{dailyWorkers}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">On Contract</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{onContract}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="display">All employees</CardTitle>
            {isStaff && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search name or phone…" className="w-48 pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className="rounded-md border border-input bg-background p-2 text-sm" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                  <option value="">All roles</option>
                  {roleOptions.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                </select>
                <select className="rounded-md border border-input bg-background p-2 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">All types</option>
                  {typeOptions.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                </select>
                <select className="rounded-md border border-input bg-background p-2 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">All status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No employees found.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Full Name</TableHead><TableHead>Phone</TableHead><TableHead>Role</TableHead><TableHead>Type</TableHead><TableHead>Rate / Salary</TableHead><TableHead>Status</TableHead>
                {isStaff && <TableHead className="text-right">Toggle</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((e: any) => (
                  <TableRow key={e.id} className={isStaff ? "cursor-pointer" : ""} onClick={() => isStaff && openEdit(e)}>
                    <TableCell className="font-medium">{e.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.phone ?? "—"}</TableCell>
                    <TableCell><Badge className="border-0" variant="outline">{e.role}</Badge></TableCell>
                    <TableCell><Badge className="border-0" variant="outline">{e.employee_type?.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-sm">
                      {Number(e.daily_rate) > 0 && <div>UGX {Number(e.daily_rate).toLocaleString()}/day</div>}
                      {Number(e.monthly_salary) > 0 && <div>UGX {Number(e.monthly_salary).toLocaleString()}/mo</div>}
                      {Number(e.daily_rate) === 0 && Number(e.monthly_salary) === 0 && <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border-0", e.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400")} variant="outline">
                        {e.status}
                      </Badge>
                    </TableCell>
                    {isStaff && (
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={e.status === "active"}
                          onCheckedChange={(v) => toggleStatus.mutate({ id: e.id, status: v ? "active" : "inactive" })}
                        />
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
