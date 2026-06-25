import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Building2, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({ meta: [{ title: "Properties — Habico Portal" }] }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", location: "", property_type: "Residential", description: "" });

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*, units(id,status)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("properties").insert(form);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Property created"); setOpen(false); setForm({ name:"",address:"",location:"",property_type:"Residential",description:"" }); qc.invalidateQueries({ queryKey: ["properties"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Portfolio</div>
          <h1 className="display text-3xl font-bold">Properties</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4"/>Add property</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New property</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e)=>setForm({...form, name:e.target.value})}/></div>
                <div><Label>Address</Label><Input value={form.address} onChange={(e)=>setForm({...form, address:e.target.value})}/></div>
                <div><Label>Location / Area</Label><Input value={form.location} onChange={(e)=>setForm({...form, location:e.target.value})}/></div>
                <div><Label>Type</Label><Input value={form.property_type} onChange={(e)=>setForm({...form, property_type:e.target.value})}/></div>
              </div>
              <DialogFooter><Button onClick={()=>create.mutate()} disabled={!form.name || create.isPending}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : properties.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground"/>
          <div className="font-medium">No properties yet</div>
          <div className="text-sm text-muted-foreground">{isStaff ? "Add your first property to begin." : "Your properties will appear here once Habico links them to your account."}</div>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => {
            const units = (p as any).units ?? [];
            const occ = units.filter((u: any) => u.status === "occupied").length;
            return (
              <Link key={p.id} to="/properties/$id" params={{ id: p.id }}>
                <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-soft">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Building2 className="h-5 w-5"/></div>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{p.property_type ?? "—"}</span>
                    </div>
                    <h3 className="mt-4 display text-lg font-bold">{p.name}</h3>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3"/>{p.location ?? p.address ?? "—"}</div>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Units</span>
                      <span className="font-semibold">{occ}/{units.length} occupied</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
