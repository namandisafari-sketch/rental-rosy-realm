// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Download, DollarSign, TrendingUp, TrendingDown, HardHat, AlertTriangle, FileText, Wrench, Truck, ShoppingCart, RefreshCw } from "lucide-react";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import { PageTour } from "@/components/page-tour";

export const Route = createFileRoute("/_authenticated/construction-finance")({
  head: () => ({ meta: [{ title: "Construction Finance — Habico Portal" }] }),
  component: ConstructionFinancePage,
});

function formatUGX(amount: number) {
  if (amount >= 1_000_000) return `UGX ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `UGX ${(amount / 1_000).toFixed(1)}K`;
  return `UGX ${amount.toLocaleString()}`;
}

function ConstructionFinancePage() {
  const role = useHighestRole();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const pdfRef = useRef<HTMLDivElement>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["cf-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, budget, status, start_date, target_end_date")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["cf-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, project_id, total_amount, amount_paid, status, invoice_date")
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: subcontracts = [] } = useQuery({
    queryKey: ["cf-subcontracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subcontracts")
        .select("id, project_id, contract_amount, paid_to_date, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["cf-bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("id, project_id, amount, status, due_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: changeOrders = [] } = useQuery({
    queryKey: ["cf-change-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("change_orders")
        .select("id, project_id, amount, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["cf-expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, project_id, amount, category");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: purchaseOrders = [] } = useQuery({
    queryKey: ["cf-pos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, project_id, total_amount, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: progressPayments = [] } = useQuery({
    queryKey: ["cf-progress-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progress_payments")
        .select("id, project_id, amount, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const years = useMemo(() => {
    const set = new Set([now.getFullYear()]);
    invoices.forEach((i: any) => { if (i.invoice_date) set.add(new Date(i.invoice_date).getFullYear()); });
    bills.forEach((b: any) => { if (b.due_date) set.add(new Date(b.due_date).getFullYear()); });
    return Array.from(set).sort((a, b) => b - a);
  }, [invoices, bills]);

  const projectMap = useMemo(() => new Map(projects.map((p: any) => [p.id, p])), [projects]);

  const totalRevenue = useMemo(
    () => invoices.reduce((s: number, i: any) => s + Number(i.amount_paid ?? 0), 0),
    [invoices],
  );

  const totalSubcontractsPaid = useMemo(
    () => subcontracts.reduce((s: number, sc: any) => s + Number(sc.paid_to_date ?? 0), 0),
    [subcontracts],
  );

  const totalBillsPaid = useMemo(() => {
    return bills
      .filter((b: any) => ["paid", "partial"].includes(b.status))
      .reduce((s: number, b: any) => s + Number(b.amount ?? 0), 0);
  }, [bills]);

  const totalExpenses = useMemo(
    () => expenses.reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0),
    [expenses],
  );

  const totalPOsReceived = useMemo(() => {
    return purchaseOrders
      .filter((po: any) => ["received", "received_partial"].includes(po.status))
      .reduce((s: number, po: any) => s + Number(po.total_amount ?? 0), 0);
  }, [purchaseOrders]);

  const totalCosts = totalSubcontractsPaid + totalBillsPaid + totalExpenses + totalPOsReceived;
  const grossProfit = totalRevenue - totalCosts;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const activeProjectCount = projects.filter((p: any) => p.status === "active" || p.status === "in_progress").length;

  const outstandingReceivables = useMemo(
    () => invoices
      .filter((i: any) => i.status !== "paid" && i.status !== "cancelled")
      .reduce((s: number, i: any) => s + (Number(i.total_amount ?? 0) - Number(i.amount_paid ?? 0)), 0),
    [invoices],
  );

  const monthlyData = useMemo(() => {
    const map = new Map<string, { revenue: number; costs: number }>();

    invoices.forEach((inv: any) => {
      const d = new Date(inv.invoice_date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(k)) map.set(k, { revenue: 0, costs: 0 });
      map.get(k)!.revenue += Number(inv.amount_paid ?? 0);
    });

    bills.forEach((b: any) => {
      const d = new Date(b.due_date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(k)) map.set(k, { revenue: 0, costs: 0 });
      map.get(k)!.costs += Number(b.amount ?? 0);
    });

    subcontracts.forEach((sc: any) => {
      if (!sc.project_id) return;
      const proj = projectMap.get(sc.project_id);
      if (!proj?.start_date) return;
      const d = new Date(proj.start_date);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(k)) map.set(k, { revenue: 0, costs: 0 });
      map.get(k)!.costs += Number(sc.paid_to_date ?? 0);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => ({ month, ...data }));
  }, [invoices, bills, subcontracts, projectMap]);

  const costBreakdown = useMemo(() => {
    const cats = [
      { name: "Subcontracts", total: totalSubcontractsPaid, icon: Wrench },
      { name: "Bills", total: totalBillsPaid, icon: Truck },
      { name: "Expenses", total: totalExpenses, icon: DollarSign },
      { name: "Purchase Orders", total: totalPOsReceived, icon: ShoppingCart },
      { name: "Change Orders", total: changeOrders.reduce((s: number, co: any) => s + Number(co.amount ?? 0), 0), icon: RefreshCw },
    ];
    const grandTotal = cats.reduce((s, c) => s + c.total, 0);
    return cats.map((c) => ({
      ...c,
      pct: grandTotal > 0 ? ((c.total / grandTotal) * 100).toFixed(1) : "0.0",
    }));
  }, [totalSubcontractsPaid, totalBillsPaid, totalExpenses, totalPOsReceived, changeOrders]);

  const projectPL = useMemo(() => {
    return projects.map((proj: any) => {
      const pid = proj.id;
      const projRevenue = invoices
        .filter((i: any) => i.project_id === pid)
        .reduce((s: number, i: any) => s + Number(i.amount_paid ?? 0), 0);
      const projSubcontracts = subcontracts
        .filter((sc: any) => sc.project_id === pid)
        .reduce((s: number, sc: any) => s + Number(sc.paid_to_date ?? 0), 0);
      const projBills = bills
        .filter((b: any) => b.project_id === pid)
        .reduce((s: number, b: any) => s + Number(b.amount ?? 0), 0);
      const projExpenses = expenses
        .filter((e: any) => e.project_id === pid)
        .reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0);
      const projPOs = purchaseOrders
        .filter((po: any) => po.project_id === pid)
        .reduce((s: number, po: any) => s + Number(po.total_amount ?? 0), 0);
      const projCosts = projSubcontracts + projBills + projExpenses + projPOs;
      const profit = projRevenue - projCosts;
      const margin = projRevenue > 0 ? (profit / projRevenue) * 100 : 0;

      return {
        name: proj.name,
        status: proj.status,
        budget: Number(proj.budget ?? 0),
        revenue: projRevenue,
        subcontracts: projSubcontracts,
        bills: projBills,
        expenses: projExpenses,
        pos: projPOs,
        totalCosts: projCosts,
        profit,
        margin,
      };
    })
      .filter((p: any) => p.revenue > 0 || p.totalCosts > 0)
      .sort((a: any, b: any) => b.margin - a.margin);
  }, [projects, invoices, subcontracts, bills, expenses, purchaseOrders]);

  const projectTotals = useMemo(() => {
    return projectPL.reduce(
      (acc: any, p: any) => ({
        budget: acc.budget + p.budget,
        revenue: acc.revenue + p.revenue,
        subcontracts: acc.subcontracts + p.subcontracts,
        bills: acc.bills + p.bills,
        expenses: acc.expenses + p.expenses,
        pos: acc.pos + p.pos,
        totalCosts: acc.totalCosts + p.totalCosts,
        profit: acc.profit + p.profit,
      }),
      { budget: 0, revenue: 0, subcontracts: 0, bills: 0, expenses: 0, pos: 0, totalCosts: 0, profit: 0 },
    );
  }, [projectPL]);

  const outstandingInvoices = useMemo(
    () => invoices
      .filter((i: any) => {
        const outstanding = Number(i.total_amount ?? 0) - Number(i.amount_paid ?? 0);
        return outstanding > 0 && i.status !== "paid" && i.status !== "cancelled";
      })
      .map((i: any) => {
        const outstanding = Number(i.total_amount ?? 0) - Number(i.amount_paid ?? 0);
        const daysOverdue = i.invoice_date
          ? Math.max(0, Math.floor((now.getTime() - new Date(i.invoice_date).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
        return { ...i, outstanding, daysOverdue };
      })
      .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue),
    [invoices],
  );

  async function downloadPdf() {
    if (!pdfRef.current) return;
    try {
      const imgData = await toPng(pdfRef.current, { backgroundColor: "#fff" });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (pdfRef.current.scrollHeight * imgW) / pdfRef.current.scrollWidth;
      let left = imgH;
      let pos = margin;
      pdf.addImage(imgData, "PNG", margin, pos, imgW, imgH);
      left -= pageH - margin * 2;
      while (left > 0) {
        pdf.addPage();
        pos = margin - (imgH - left);
        pdf.addImage(imgData, "PNG", margin, pos, imgW, imgH);
        left -= pageH - margin * 2;
      }
      pdf.save(`construction-finance-${selectedYear}.pdf`);
    } catch (err) {
      console.error("PDF export failed", err);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageTour route="/construction-finance" role={role} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Construction Division</div>
          <h1 className="display text-3xl font-bold">Construction Finance</h1>
          <p className="text-sm text-muted-foreground">
            Project-level P&amp;L, cost tracking, and receivables
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-input bg-background p-2 text-sm"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <FileText className="mr-2 h-4 w-4" />Export PDF
          </Button>
        </div>
      </div>

      <div ref={pdfRef}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-500">{formatUGX(totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Paid construction invoices</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-500">{formatUGX(totalCosts)}</p>
              <p className="text-xs text-muted-foreground">Subcontracts + Bills + Expenses + POs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
              {grossProfit >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${grossProfit >= 0 ? "text-green-500" : "text-red-500"}`}>
                {formatUGX(Math.abs(grossProfit))}
              </p>
              <p className="text-xs text-muted-foreground">{grossProfit >= 0 ? "Positive margin" : "Negative margin"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Gross Margin %</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${grossMargin >= 0 ? "text-green-500" : "text-red-500"}`}>
                {grossMargin.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">Profit / Revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <HardHat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeProjectCount}</p>
              <p className="text-xs text-muted-foreground">of {projects.length} total projects</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Outstanding Receivables</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-500">{formatUGX(outstandingReceivables)}</p>
              <p className="text-xs text-muted-foreground">Invoiced but unpaid</p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="display">Revenue vs Costs</CardTitle>
              <CardDescription>Last 12 months</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {monthlyData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No financial data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: number) => formatUGX(v)} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="costs" name="Costs" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="display">Cost Breakdown by Category</CardTitle>
              <CardDescription>All-time cost distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costBreakdown.map((cat: any) => (
                    <TableRow key={cat.name}>
                      <TableCell className="flex items-center gap-2">
                        <cat.icon className="h-4 w-4 text-muted-foreground" />
                        {cat.name}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatUGX(cat.total)}</TableCell>
                      <TableCell className="text-right">{cat.pct}%</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell className="font-bold">Total Costs</TableCell>
                    <TableCell className="text-right font-bold">{formatUGX(costBreakdown.reduce((s: number, c: any) => s + c.total, 0))}</TableCell>
                    <TableCell className="text-right font-bold">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="display">Project P&amp;L</CardTitle>
            <CardDescription>Per-project profit and loss — sorted by margin</CardDescription>
          </CardHeader>
          <CardContent>
            {projectPL.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No project data yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Subcontracts</TableHead>
                      <TableHead className="text-right">Bills</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                      <TableHead className="text-right">POs</TableHead>
                      <TableHead className="text-right">Total Costs</TableHead>
                      <TableHead className="text-right">Profit/Loss</TableHead>
                      <TableHead className="text-right">Margin %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectPL.map((proj: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium whitespace-nowrap">{proj.name}</TableCell>
                        <TableCell>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              proj.status === "active" || proj.status === "in_progress"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : proj.status === "completed"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                            }`}
                          >
                            {proj.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatUGX(proj.budget)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatUGX(proj.revenue)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatUGX(proj.subcontracts)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatUGX(proj.bills)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatUGX(proj.expenses)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatUGX(proj.pos)}</TableCell>
                        <TableCell className="text-right font-semibold whitespace-nowrap">{formatUGX(proj.totalCosts)}</TableCell>
                        <TableCell className={`text-right font-semibold whitespace-nowrap ${proj.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {formatUGX(Math.abs(proj.profit))}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${proj.margin >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {proj.margin.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-primary/20">
                      <TableCell className="font-bold" colSpan={2}>Totals</TableCell>
                      <TableCell className="text-right font-bold whitespace-nowrap">{formatUGX(projectTotals.budget)}</TableCell>
                      <TableCell className="text-right font-bold whitespace-nowrap">{formatUGX(projectTotals.revenue)}</TableCell>
                      <TableCell className="text-right font-bold whitespace-nowrap">{formatUGX(projectTotals.subcontracts)}</TableCell>
                      <TableCell className="text-right font-bold whitespace-nowrap">{formatUGX(projectTotals.bills)}</TableCell>
                      <TableCell className="text-right font-bold whitespace-nowrap">{formatUGX(projectTotals.expenses)}</TableCell>
                      <TableCell className="text-right font-bold whitespace-nowrap">{formatUGX(projectTotals.pos)}</TableCell>
                      <TableCell className="text-right font-bold whitespace-nowrap">{formatUGX(projectTotals.totalCosts)}</TableCell>
                      <TableCell className={`text-right font-bold whitespace-nowrap ${projectTotals.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {formatUGX(Math.abs(projectTotals.profit))}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${projectTotals.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {projectTotals.revenue > 0 ? ((projectTotals.profit / projectTotals.revenue) * 100).toFixed(1) : "0.0"}%
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="display">Outstanding Receivables</CardTitle>
            <CardDescription>Unpaid construction invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {outstandingInvoices.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No outstanding receivables.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Days Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outstandingInvoices.map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium whitespace-nowrap">{inv.id?.slice(0, 8) ?? "—"}</TableCell>
                      <TableCell>{projectMap.get(inv.project_id)?.name ?? "—"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatUGX(Number(inv.total_amount ?? 0))}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatUGX(Number(inv.amount_paid ?? 0))}</TableCell>
                      <TableCell className="text-right font-semibold text-red-500 whitespace-nowrap">{formatUGX(inv.outstanding)}</TableCell>
                      <TableCell className="text-right">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          inv.daysOverdue > 60
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : inv.daysOverdue > 30
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                        }`}>
                          {inv.daysOverdue}d
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
