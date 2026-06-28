import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Building2, MapPin, Pencil, Archive, Search, SlidersHorizontal, Home } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({ meta: [{ title: "Properties — Habico Portal" }] }),
  component: PropertiesPage,
});

const PROPERTY_TYPES = ["residential", "commercial", "industrial", "land", "mixed_use"] as const;

function PropertiesPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingProp, setEditingProp] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [form, setForm] = useState({ name: "", address: "", location: "", city: "", property_type: "residential", description: "", image_url: "" });

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*, units(id,status)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const stats = {
    total: properties.length,
    units: (properties as any[]).reduce((s, p) => s + (p.units ?? []).length, 0),
    occupied: (properties as any[]).reduce((s, p) => s + (p.units ?? []).filter((u: any) => u.status === "occupied").length, 0),
  };

  const filtered = properties.filter((p: any) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.address ?? "").toLowerCase().includes(q) || (p.city ?? "").toLowerCase().includes(q);
    const matchesType = typeFilter === "all" || p.property_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("properties").insert({ ...form, property_type: form.property_type || "residential" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Property created"); setOpen(false); setForm({ name: "", address: "", location: "", city: "", property_type: "residential", description: "", image_url: "" }); qc.invalidateQueries({ queryKey: ["properties"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editingProp) return;
      const { error } = await supabase.from("properties").update(form).eq("id", editingProp.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Property updated"); setEditOpen(false); setEditingProp(null); qc.invalidateQueries({ queryKey: ["properties"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("properties").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Property archived"); qc.invalidateQueries({ queryKey: ["properties"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  function openEdit(p: any) {
    setEditingProp(p);
    setForm({ name: p.name, address: p.address ?? "", location: p.location ?? "", city: (p as any).city ?? "", property_type: p.property_type ?? "residential", description: p.description ?? "", image_url: p.image_url ?? "" });
    setEditOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Portfolio</div>
          <h1 className="display text-3xl font-bold">Properties</h1>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="mr-2 h-4 w-4" />Add property</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>New property</DialogTitle></DialogHeader>
              <div className="space-y-5">
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Property Details</h3></div>
                  <div className="space-y-3">
                    <div><Label>Property Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sunset Apartments, Hilltop Estate" /><p className="mt-1 text-xs text-muted-foreground">Official name of the property as used in lease agreements.</p></div>
                    <div><Label>Property Type *</Label>
                      <Select value={form.property_type} onValueChange={(v) => setForm({ ...form, property_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROPERTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace("_", " ")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief overview of the property, key features, amenities, etc." rows={3} /><p className="mt-1 text-xs text-muted-foreground">Describe the property's key features, number of units, and unique selling points.</p></div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Location &amp; Contact</h3></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label>Street Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Plot 42, Kampala Road" /></div>
                    <div><Label>City / Municipality</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Kampala, Entebbe" /></div>
                    <div><Label>Location / Area</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Kololo, Bugolobi" /><p className="mt-1 text-xs text-muted-foreground">Neighborhood or district within the city.</p></div>
                  </div>
                </div>
                <div>
                  <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Media</h3></div>
                  <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://example.com/property-image.jpg" /><p className="mt-1 text-xs text-muted-foreground">Link to a photo or rendering of the property for the listing card.</p></div>
                </div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>Create Property</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-muted-foreground">Properties</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{stats.units}</div><div className="text-xs text-muted-foreground">Total Units</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{stats.units ? Math.round((stats.occupied / stats.units) * 100) : 0}%</div><div className="text-xs text-muted-foreground">Occupancy Rate</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <select className="rounded-md border bg-background px-3 py-1.5 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace("_", " ")}</option>)}
          </select>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditingProp(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit property</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div>
              <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Property Details</h3></div>
              <div className="space-y-3">
                <div><Label>Property Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><p className="mt-1 text-xs text-muted-foreground">Official name of the property as used in lease agreements.</p></div>
                <div><Label>Property Type</Label>
                  <Select value={form.property_type} onValueChange={(v) => setForm({ ...form, property_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1).replace("_", " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief overview of the property, key features, amenities, etc." rows={3} /></div>
              </div>
            </div>
            <div>
              <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Location &amp; Contact</h3></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Street Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div><Label>City / Municipality</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>Location / Area</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              </div>
            </div>
            <div>
              <div className="border-b pb-2 mb-4"><h3 className="text-sm font-semibold">Media</h3></div>
              <div><Label>Image URL</Label><Input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://example.com/property-image.jpg" /><p className="mt-1 text-xs text-muted-foreground">Link to a photo or rendering of the property for the listing card.</p></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!form.name || update.isPending}>Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground" />
          <div className="font-medium">{search || typeFilter !== "all" ? "No matching properties" : "No properties yet"}</div>
          <div className="text-sm text-muted-foreground">{isStaff && !search ? "Add your first property to begin." : "Try a different search."}</div>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p: any) => {
            const units = p.units ?? [];
            const occ = units.filter((u: any) => u.status === "occupied").length;
            return (
              <div key={p.id} className="group relative">
                <Link to="/properties/$id" params={{ id: p.id }}>
                  <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-soft">
                    {p.image_url && <img src={p.image_url} alt={p.name} className="h-36 w-full rounded-t-xl object-cover" />}
                    <CardContent className={p.image_url ? "p-4" : "p-6"}>
                      <div className="flex items-start justify-between">
                        {!p.image_url && <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Building2 className="h-5 w-5" /></div>}
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{p.property_type ?? "—"}</span>
                      </div>
                      <h3 className="mt-4 display text-lg font-bold">{p.name}</h3>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{p.city ?? p.location ?? p.address ?? "—"}</div>
                      <div className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Units</span>
                        <span className="font-semibold">{occ}/{units.length} occupied</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                {isStaff && (
                  <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                    <Button size="icon" variant="secondary" className="h-7 w-7" onClick={(e) => { e.preventDefault(); openEdit(p); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="icon" variant="secondary" className="h-7 w-7" onClick={(e) => e.preventDefault()}><Archive className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Archive property?</AlertDialogTitle><AlertDialogDescription>This will hide {p.name} from the list. Units and lease history are preserved.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => archive.mutate(p.id)} className="bg-destructive text-destructive-foreground">Archive</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
