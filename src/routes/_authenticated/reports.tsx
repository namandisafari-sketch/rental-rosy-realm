import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Habico Portal" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useQuery({
    queryKey: ["report-payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("amount, payment_date, leases(units(properties(name)))").order("payment_date");
      if (error) throw error;
      return data;
    },
  });

  const monthly = (() => {
    const map = new Map<string, number>();
    (data ?? []).forEach((p:any) => {
      const d = new Date(p.payment_date);
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      map.set(k, (map.get(k) ?? 0) + Number(p.amount));
    });
    return Array.from(map.entries()).slice(-12).map(([month, total]) => ({ month, total }));
  })();

  const byProperty = (() => {
    const map = new Map<string, number>();
    (data ?? []).forEach((p:any) => {
      const name = p.leases?.units?.properties?.name ?? "Other";
      map.set(name, (map.get(name) ?? 0) + Number(p.amount));
    });
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  })();

  const total = (data ?? []).reduce((s:number,p:any)=>s+Number(p.amount),0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-accent">Reports</div>
        <h1 className="display text-3xl font-bold">Financial overview</h1>
        <p className="text-sm text-muted-foreground">Lifetime collected: <span className="font-semibold text-foreground">UGX {total.toLocaleString()}</span></p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="display">Monthly collections</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                <XAxis dataKey="month" fontSize={11}/><YAxis fontSize={11}/>
                <Tooltip formatter={(v:number)=>`UGX ${v.toLocaleString()}`}/>
                <Bar dataKey="total" fill="var(--color-primary)" radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="display">By property</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProperty} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                <XAxis type="number" fontSize={11}/><YAxis dataKey="name" type="category" fontSize={11} width={120}/>
                <Tooltip formatter={(v:number)=>`UGX ${v.toLocaleString()}`}/>
                <Bar dataKey="total" fill="var(--color-accent)" radius={[0,6,6,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
