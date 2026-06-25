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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — Habico Portal" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const role = useHighestRole();
  const { user } = useAuth();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [catFilter, setCatFilter] = useState("");
  const [form, setForm] = useState({ category_id: "", employee_id: "", project_id: "", amount: "0", description: "", expense_date: new Date().toISOString().slice(0, 10) });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", catFilter],
    queryFn: async () => {
      let q = supabase.from("expenses").select("*, expense_categories(name), employees(full_name), projects(name)");
      if (catFilter) q = q.eq("category_id", catFilter);
      const { data, error } = await q.order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("expense_categories").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-pick"], enabled: isStaff,
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("*").order("full_name");
      return data ?? [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-pick"], enabled: isStaff,
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").order("name");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("expenses").insert({
        category_id: form.category_id || null,
        employee_id: form.employee_id || null,
        project_id: form.project_id || null,
        amount: Number(form.amount),
        description: form.description || null,
        expense_date: form.expense_date,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Expense recorded"); setOpen(false); setForm({ category_id: "", employee_id: "", project_id: "", amount: "0", description: "", expense_date: new Date().toISOString().slice(0, 10) }); qc.invalidateQueries({ queryKey: ["expenses"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Expense deleted"); qc.invalidateQueries({ queryKey: ["expenses"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const totalAmount = expenses.reduce((s: number, p: any) => s + Number(p.amount), 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Finance</div>
          <h1 className="display text-3xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground">Total: <span className="font-semibold text-foreground">UGX {totalAmount.toLocaleString()}</span></p>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4"/>Add expense</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record an expense</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Category</Label>
                    <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                      <option value="">Select category…</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div><Label>Amount (UGX)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
                  <div><Label>Employee</Label>
                    <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                      <option value="">Select employee…</option>
                      {employees.map((e: any) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                    </select>
                  </div>
                </div>
                <div><Label>Project</Label>
                  <select className="mt-1.5 w-full rounded-md border border-input bg-background p-2 text-sm" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                    <option value="">Select project…</option>
                    {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.amount || Number(form.amount) <= 0 || create.isPending}>Record</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-sm font-medium">Filter by category</Label>
        <select className="rounded-md border border-input bg-background p-2 text-sm" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">Expense history</CardTitle></CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No expenses recorded yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Employee</TableHead><TableHead>Project</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead>
                {isStaff && <TableHead className="w-16"></TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {expenses.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.expense_date}</TableCell>
                    <TableCell>{p.expense_categories?.name ?? "—"}</TableCell>
                    <TableCell>{p.employees?.full_name ?? "—"}</TableCell>
                    <TableCell>{p.projects?.name ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={p.description ?? ""}>{p.description ?? "—"}</TableCell>
                    <TableCell className="text-right font-semibold">UGX {Number(p.amount).toLocaleString()}</TableCell>
                    {isStaff && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button>
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
