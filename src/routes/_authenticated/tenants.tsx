import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/tenants")({
  head: () => ({ meta: [{ title: "Tenants — Habico Portal" }] }),
  component: TenantsPage,
});

function TenantsPage() {
  const { data: tenants = [] } = useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leases")
        .select("tenant_id, monthly_rent, status, start_date, units(unit_number, properties(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // get profiles
      const ids = Array.from(new Set((data ?? []).map((l) => l.tenant_id)));
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids) : { data: [] };
      const map = new Map((profs ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((l) => ({ ...l, profile: map.get(l.tenant_id) }));
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-accent">People</div>
        <h1 className="display text-3xl font-bold">Tenants</h1>
      </div>
      <Card>
        <CardHeader><CardTitle className="display">Active and recent tenants</CardTitle></CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No tenants yet. Create a lease to assign a tenant.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Unit</TableHead><TableHead>Rent</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {tenants.map((t: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{t.profile?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.profile?.email}<br/>{t.profile?.phone}</TableCell>
                    <TableCell>{t.units?.properties?.name} · {t.units?.unit_number}</TableCell>
                    <TableCell>UGX {Number(t.monthly_rent).toLocaleString()}</TableCell>
                    <TableCell><span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{t.status}</span></TableCell>
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
