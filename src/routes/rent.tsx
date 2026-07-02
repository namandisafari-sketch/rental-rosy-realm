import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { toast } from "sonner";
import {
  Building2, MapPin, Home, Bath, Bed, Search, SlidersHorizontal,
  ArrowRight, CheckCircle2, Loader2, Phone, Mail, Briefcase,
  DollarSign, User, ChevronDown, X
} from "lucide-react";

export const Route = createFileRoute("/rent")({
  head: () => ({
    meta: [
      { title: "Find Your Next Home — Habico Rentals" },
      { name: "description", content: "Browse available rental properties in Kampala and across Uganda. Submit your rental application online." },
    ],
  }),
  component: RentPage,
});

const PROPERTY_TYPES = ["residential", "commercial", "industrial", "mixed_use"] as const;
const ID_TYPE_OPTIONS: SearchableOption[] = [
  { value: "national_id", label: "National ID" },
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver's License" },
];

type Unit = {
  id: string;
  unit_number: string;
  unit_type: string;
  monthly_rent: number;
  bedrooms: number;
  bathrooms: number;
  size_sqm: number | null;
  status: string;
  floor_number: number | null;
};

type Property = {
  id: string;
  name: string;
  address: string | null;
  location: string | null;
  city: string | null;
  property_type: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean | null;
  units: Unit[];
};

function RentPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedProp, setSelectedProp] = useState<Property | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [showAppForm, setShowAppForm] = useState(false);
  const [appForm, setAppForm] = useState({
    full_name: "", phone: "", email: "",
    id_type: "national_id", id_number: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    occupation: "", employer: "", monthly_income: "",
    previous_address: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const { data: properties = [], isLoading, error } = useQuery({
    queryKey: ["rental-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*, units(*)")
        .or("is_active.is.null,is_active.eq.true")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter(
        (p: any) => !p.units?.length || p.units.some((u: any) => u.status?.toLowerCase() === "vacant")
      ) as Property[];
    },
  });

  if (error) console.error("[rent] failed to load properties:", error);

  const allUnits = properties.flatMap((p) =>
    (p.units ?? []).filter((u) => u.status === "vacant").map((u) => ({ ...u, propertyName: p.name, propertyId: p.id }))
  );
  const minRent = allUnits.length ? Math.min(...allUnits.map((u) => u.monthly_rent)) : 0;
  const maxRent = allUnits.length ? Math.max(...allUnits.map((u) => u.monthly_rent)) : 0;

  const filtered = properties.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.address ?? "").toLowerCase().includes(q) || (p.city ?? "").toLowerCase().includes(q);
    const matchesType = typeFilter === "all" || p.property_type === typeFilter;
    return matchesSearch && matchesType;
  });

  function openApply(property: Property, unit: Unit) {
    setSelectedProp(property);
    setSelectedUnit(unit);
    if (user) {
      setAppForm((f) => ({ ...f, full_name: user.user_metadata?.full_name ?? "", email: user.email ?? "" }));
      setShowAppForm(true);
    } else {
      nav({ to: "/auth", search: { mode: "signup", redirect: "/rent" } });
    }
  }

  async function handleSubmitApp(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUnit || !selectedProp) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("rental_applications").insert({
        property_id: selectedProp.id,
        unit_id: selectedUnit.id,
        full_name: appForm.full_name,
        phone: appForm.phone || null,
        email: appForm.email || null,
        id_type: appForm.id_type,
        id_number: appForm.id_number || null,
        emergency_contact_name: appForm.emergency_contact_name || null,
        emergency_contact_phone: appForm.emergency_contact_phone || null,
        occupation: appForm.occupation || null,
        employer: appForm.employer || null,
        monthly_income: appForm.monthly_income ? Number(appForm.monthly_income) : null,
        previous_address: appForm.previous_address || null,
        notes: appForm.notes || null,
      });
      if (error) throw error;
      toast.success("Application submitted! A Habico agent will contact you.");
      setShowAppForm(false);
      setSelectedProp(null);
      setSelectedUnit(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(price);
  }

  const propDetail = selectedProp;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-hero py-16 text-primary-foreground md:py-24">
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/30 via-transparent to-transparent" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Available Properties
          </div>
          <h1 className="mt-6 display text-4xl font-bold leading-tight md:text-6xl">
            Find Your Next <span className="text-accent">Home</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">
            Browse available rental properties managed by Habico. View details, compare options, and submit your application — all in one place.
          </p>
          <div className="mx-auto mt-8 flex max-w-xl gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="border-primary-foreground/20 bg-primary-foreground/10 pl-9 text-primary-foreground placeholder:text-primary-foreground/50"
                placeholder="Search by name, address or city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary-foreground/60" />
              <SearchableSelect
                value={typeFilter}
                onValueChange={setTypeFilter}
                placeholder="All types"
                options={[
                  { value: "all", label: "All types" },
                  ...PROPERTY_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1).replace("_", " ") })),
                ]}
                className="w-44 border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground"
              />
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-3 gap-4">
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-accent">{properties.length}</div><div className="text-xs text-muted-foreground">Properties Available</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-accent">{allUnits.length}</div><div className="text-xs text-muted-foreground">Vacant Units</div></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-accent">{minRent ? `${formatPrice(minRent).replace(/UGX\s?/, "")} - ${formatPrice(maxRent).replace(/UGX\s?/, "")}` : "—"}</div><div className="text-xs text-muted-foreground">Price Range (UGX)</div></CardContent></Card>
        </div>
      </section>

      {/* PROPERTY GRID */}
      <section className="mx-auto max-w-7xl px-4 pb-20">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading properties...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <Building2 className="h-12 w-12 text-destructive/60" />
            <div className="text-lg font-medium text-destructive">Failed to load properties</div>
            <div className="text-sm text-muted-foreground">{(error as Error).message}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40" />
            <div className="text-lg font-medium">No properties found</div>
            <div className="text-sm text-muted-foreground">{search || typeFilter !== "all" ? "Try a different search or filter." : "No available rentals at the moment. Check back soon."}</div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => {
              const vacant = (p.units ?? []).filter((u) => u.status === "vacant");
              const minUnitRent = vacant.length ? Math.min(...vacant.map((u) => u.monthly_rent)) : 0;

              return (
                <Card
                  key={p.id}
                  className="group cursor-pointer overflow-hidden transition hover:-translate-y-1 hover:shadow-soft"
                  onClick={() => setSelectedProp(p)}
                >
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="h-48 w-full object-cover" />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-secondary">
                      <Building2 className="h-12 w-12 text-muted-foreground/30" />
                    </div>
                  )}
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                          {p.property_type ?? "Property"}
                        </span>
                      </div>
                      {minUnitRent > 0 && (
                        <div className="text-right">
                          <div className="text-sm font-bold text-foreground">{formatPrice(minUnitRent)}</div>
                          <div className="text-[10px] text-muted-foreground">/month</div>
                        </div>
                      )}
                    </div>
                    <h3 className="mt-3 display text-lg font-bold">{p.name}</h3>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />{p.city ?? p.location ?? p.address ?? "Kampala"}
                    </div>
                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Home className="h-3 w-3" /> {vacant.length} available</span>
                      {vacant.some((u) => u.bedrooms > 0) && (
                        <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {Math.min(...vacant.map((u) => u.bedrooms))}+ beds</span>
                      )}
                      {vacant.some((u) => u.bathrooms > 0) && (
                        <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {Math.min(...vacant.map((u) => u.bathrooms))}+ baths</span>
                      )}
                    </div>
                    <Button
                      className="mt-4 w-full"
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); setSelectedProp(p); }}
                    >
                      View Details <ArrowRight className="ml-2 h-3 w-3" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* PROPERTY DETAIL DIALOG */}
      <Dialog open={!!propDetail && !showAppForm} onOpenChange={(v) => { if (!v) { setSelectedProp(null); setSelectedUnit(null); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {propDetail && (
            <>
              <DialogHeader>
                <DialogTitle className="display text-2xl">{propDetail.name}</DialogTitle>
                <DialogDescription className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />{propDetail.city ?? propDetail.location ?? propDetail.address ?? "Kampala, Uganda"}
                </DialogDescription>
              </DialogHeader>

              {propDetail.image_url && (
                <img src={propDetail.image_url} alt={propDetail.name} className="h-56 w-full rounded-lg object-cover" />
              )}

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">About</h4>
                  <p className="mt-1 text-sm">{propDetail.description ?? "No description available."}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{propDetail.property_type}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Available Units</h4>
                  <div className="mt-3 space-y-3">
                    {(propDetail.units ?? []).filter((u) => u.status === "vacant").length === 0 ? (
                      <p className="text-sm text-muted-foreground">No vacant units at this time.</p>
                    ) : (
                      (propDetail.units ?? []).filter((u) => u.status === "vacant").map((unit) => (
                        <div key={unit.id} className="flex items-center justify-between rounded-lg border p-4 transition hover:border-accent">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{unit.unit_number}</span>
                              <span className="text-xs text-muted-foreground">{unit.unit_type}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {unit.bedrooms > 0 && <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {unit.bedrooms} bed</span>}
                              {unit.bathrooms > 0 && <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {unit.bathrooms} bath</span>}
                              {unit.size_sqm && <span>{unit.size_sqm} sqm</span>}
                              {unit.floor_number != null && <span>Floor {unit.floor_number}</span>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{formatPrice(unit.monthly_rent)}</div>
                            <div className="text-[10px] text-muted-foreground">/month</div>
                            <Button
                              size="sm"
                              className="mt-2"
                              onClick={() => openApply(propDetail, unit)}
                            >
                              Apply Now
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* APPLICATION FORM DIALOG */}
      <Dialog open={showAppForm} onOpenChange={setShowAppForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="display text-xl">Rental Application</DialogTitle>
            <DialogDescription>
              {selectedProp && selectedUnit
                ? `Applying for ${selectedProp.name} — Unit ${selectedUnit.unit_number} (${formatPrice(selectedUnit.monthly_rent)}/month)`
                : "Complete the form below to start your application."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitApp} className="space-y-6">
            <div>
              <div className="mb-3 border-b pb-2"><h3 className="text-sm font-semibold">Personal Information</h3></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Full Name *</Label><Input value={appForm.full_name} onChange={(e) => setAppForm({ ...appForm, full_name: e.target.value })} placeholder="e.g. John Kamau" required /></div>
                <div><Label>Phone</Label><Input value={appForm.phone} onChange={(e) => setAppForm({ ...appForm, phone: e.target.value })} placeholder="+256 700 000 000" /></div>
                <div><Label>Email</Label><Input type="email" value={appForm.email} onChange={(e) => setAppForm({ ...appForm, email: e.target.value })} placeholder="you@example.com" /></div>
              </div>
            </div>

            <div>
              <div className="mb-3 border-b pb-2"><h3 className="text-sm font-semibold">Identification</h3></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>ID Type</Label>
                  <SearchableSelect
                    value={appForm.id_type}
                    onValueChange={(v) => setAppForm({ ...appForm, id_type: v })}
                    placeholder="Select ID type"
                    options={ID_TYPE_OPTIONS}
                  />
                </div>
                <div><Label>ID Number</Label><Input value={appForm.id_number} onChange={(e) => setAppForm({ ...appForm, id_number: e.target.value })} placeholder="e.g. CM12345678" /></div>
              </div>
            </div>

            <div>
              <div className="mb-3 border-b pb-2"><h3 className="text-sm font-semibold">Employment &amp; Income</h3></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Occupation</Label><Input value={appForm.occupation} onChange={(e) => setAppForm({ ...appForm, occupation: e.target.value })} placeholder="e.g. Software Engineer" /></div>
                <div><Label>Employer</Label><Input value={appForm.employer} onChange={(e) => setAppForm({ ...appForm, employer: e.target.value })} placeholder="e.g. Tech Corp Ltd" /></div>
                <div className="col-span-2"><Label>Monthly Income (UGX)</Label><Input type="number" value={appForm.monthly_income} onChange={(e) => setAppForm({ ...appForm, monthly_income: e.target.value })} placeholder="e.g. 5000000" /></div>
              </div>
            </div>

            <div>
              <div className="mb-3 border-b pb-2"><h3 className="text-sm font-semibold">Emergency Contact</h3></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Full Name</Label><Input value={appForm.emergency_contact_name} onChange={(e) => setAppForm({ ...appForm, emergency_contact_name: e.target.value })} placeholder="Next of kin" /></div>
                <div><Label>Phone</Label><Input value={appForm.emergency_contact_phone} onChange={(e) => setAppForm({ ...appForm, emergency_contact_phone: e.target.value })} placeholder="+256 700 000 000" /></div>
              </div>
            </div>

            <div>
              <div className="mb-3 border-b pb-2"><h3 className="text-sm font-semibold">Additional Information</h3></div>
              <div className="grid gap-3">
                <div><Label>Previous Address</Label><Input value={appForm.previous_address} onChange={(e) => setAppForm({ ...appForm, previous_address: e.target.value })} placeholder="Where do you currently live?" /></div>
                <div><Label>Notes / Special Requests</Label><Textarea value={appForm.notes} onChange={(e) => setAppForm({ ...appForm, notes: e.target.value })} placeholder="Any questions or special requirements..." rows={3} /></div>
              </div>
            </div>

            <Button type="submit" disabled={submitting || !appForm.full_name} className="w-full">
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : "Submit Application"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <SiteFooter />
    </div>
  );
}
