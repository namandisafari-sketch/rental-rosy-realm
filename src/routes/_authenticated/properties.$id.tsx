import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Home } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/properties/$id")({
  head: () => ({ meta: [{ title: "Property — Habico Portal" }] }),
  component: PropertyDetail,
});

function PropertyDetail() {
  const { id } = Route.useParams();
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ unit_number: "", monthly_rent: "0", bedrooms: "1", bathrooms: "1", status: "vacant", notes: "" });

  const { data: property } = useQuery({
    queryKey: ["property", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("*").eq("property_id", id).order("unit_number");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("units").insert({
        property_id: id, unit_number: form.unit_number,
        monthly_rent: Number(form.monthly_rent), bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms), status: form.status, notes: form.notes,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Unit added"); setOpen(false); qc.invalidateQueries({ queryKey: ["units", id] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link to="/properties" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/> Back to properties</Link>
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-accent">Property</div>
        <h1 className="display text-3xl font-bold">{property?.name ?? "Loading…"}</h1>
        <p className="text-sm text-muted-foreground">{property?.address}{property?.location ? ` · ${property.location}` : ""}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="display">Units</CardTitle>
          {isStaff && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4"/>Add unit</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New unit</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div><Label>Unit number</Label><Input value={form.unit_number} onChange={(e)=>setForm({...form, unit_number:e.target.value})}/></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Bedrooms</Label><Input type="number" value={form.bedrooms} onChange={(e)=>setForm({...form, bedrooms:e.target.value})}/></div>
                    <div><Label>Bathrooms</Label><Input type="number" value={form.bathrooms} onChange={(e)=>setForm({...form, bathrooms:e.target.value})}/></div>
                  </div>
                  <div><Label>Monthly rent (UGX)</Label><Input type="number" value={form.monthly_rent} onChange={(e)=>setForm({...form, monthly_rent:e.target.value})}/></div>
                </div>
                <DialogFooter><Button onClick={()=>create.mutate()} disabled={!form.unit_number || create.isPending}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {units.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No units yet.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {units.map((u) => (
                <div key={u.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><Home className="h-4 w-4 text-primary"/><span className="font-semibold">Unit {u.unit_number}</span></div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${u.status === "occupied" ? "bg-success/15 text-success" : u.status === "maintenance" ? "bg-warning/20 text-warning-foreground" : "bg-secondary text-muted-foreground"}`}>{u.status}</span>
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{u.bedrooms ?? "—"} bed · {u.bathrooms ?? "—"} bath</div>
                  <div className="mt-1 text-sm font-semibold">UGX {Number(u.monthly_rent).toLocaleString()}/mo</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
