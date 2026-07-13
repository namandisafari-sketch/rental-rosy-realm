import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useHighestRole } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GridDataCards, type GridCardField } from "@/components/data-grid-cards";
import { Plus, Pencil, Search, Users, Phone, Mail, Eye, EyeOff, Copy, Key, ShieldAlert, Check, RefreshCw, Building2, Home, Layers, MapPin, CreditCard, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const ID_TYPE_OPTIONS = ["national_id", "passport", "drivers_license"].map((t) => ({ value: t, label: t === "drivers_license" ? "Driver's License" : t === "national_id" ? "National ID" : "Passport" }));
const STATUS_OPTIONS = ["active", "inactive", "blacklisted"].map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));

const emptyForm = {
  full_name: "",
  phone: "",
  email: "",
  id_type: "national_id",
  id_number: "",
  status: "active" as string,
  emergency_contact_name: "",
  emergency_contact_phone: "",
  previous_address: "",
  occupation: "",
  employer: "",
  monthly_income: 0,
  access_pin: "",
  notes: "",
  property_id: "",
  unit_id: "",
};

export const Route = createFileRoute("/_authenticated/tenants")({
  head: () => ({ meta: [{ title: "Tenants — Habico Portal" }] }),
  component: TenantsPage,
});

function TenantsPage() {
  const { user } = useAuth();
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [pinVisible, setPinVisible] = useState(false);
  const [formTab, setFormTab] = useState("basic");

  const { data: currentProfile } = useQuery({
    queryKey: ["current-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase.from("profiles").select("company_id").eq("id", user.id).single();
      return data ?? null;
    },
    enabled: !!user?.id,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["tenant-properties", currentProfile?.company_id],
    queryFn: async () => {
      let q = supabase.from("properties" as any).select("id, name, location").order("name");
      if (currentProfile?.company_id) q = q.eq("company_id", currentProfile.company_id);
      const { data }: any = await q;
      return data ?? [];
    },
    enabled: !!currentProfile,
  });

  const [formPropertyId, setFormPropertyId] = useState("");

  const { data: propertyUnits = [] } = useQuery({
    queryKey: ["tenant-property-units", formPropertyId],
    queryFn: async () => {
      if (!formPropertyId) return [];
      const { data } = await supabase
        .from("units")
        .select("id, unit_number, floor_number, monthly_rent, bedrooms, bathrooms, status")
        .eq("property_id", formPropertyId)
        .order("floor_number", { ascending: true, nullsFirst: false })
        .order("unit_number");
      return data ?? [];
    },
    enabled: !!formPropertyId,
  });

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["tenants", currentProfile?.company_id],
    queryFn: async () => {
      let q = supabase
        .from("tenants" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (currentProfile?.company_id) q = q.eq("company_id", currentProfile.company_id);
      const { data, error } = await q;
      if (error) throw error;
      let tenantList = (data ?? []) as any[];

      const authUserIds = tenantList.map((t: any) => t.auth_user_id).filter(Boolean);
      if (authUserIds.length > 0) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("user_id", authUserIds)
          .in("role", ["owner", "admin", "manager"]);
        const excludeIds = new Set((roles ?? []).map((r: any) => r.user_id));
        tenantList = tenantList.filter((t: any) => !t.auth_user_id || !excludeIds.has(t.auth_user_id));
      }

      if (tenantList.length === 0) return tenantList;
      const { data: leases } = await supabase
        .from("leases")
        .select("tenant_id, monthly_rent, outstanding_balance, unit_id, units!inner(unit_number, floor_number, property_id, properties!inner(name))")
        .eq("status", "active")
        .in("tenant_id", tenantList.map((t: any) => t.id));
      const leaseMap = new Map((leases ?? []).map((l: any) => [l.tenant_id, l]));
      return tenantList.map((t: any) => ({ ...t, lease: leaseMap.get(t.id) }));
    },
    enabled: !!currentProfile,
  });

  const total = tenants.length;
  const activeCount = tenants.filter((t: any) => t.status === "active").length;
  const inactiveCount = tenants.filter((t: any) => t.status === "inactive").length;
  const blacklistedCount = tenants.filter((t: any) => t.status === "blacklisted").length;

  const filtered = tenants.filter((t: any) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t.full_name?.toLowerCase().includes(q) ||
      t.phone?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const displayed = statusFilter === "all" ? filtered : filtered.filter((t: any) => t.status === statusFilter);

  function openEdit(t: any) {
    setSelectedTenant(t);
    const leaseUnitId = t.lease?.unit_id ?? "";
    const leasePropertyId = t.lease?.units?.property_id ?? "";
    setForm({
      full_name: t.full_name ?? "",
      phone: t.phone ?? "",
      email: t.email ?? "",
      id_type: t.id_type ?? "national_id",
      id_number: t.id_number ?? "",
      status: t.status ?? "active",
      emergency_contact_name: t.emergency_contact_name ?? "",
      emergency_contact_phone: t.emergency_contact_phone ?? "",
      previous_address: t.previous_address ?? "",
      occupation: t.occupation ?? "",
      employer: t.employer ?? "",
      monthly_income: t.monthly_income ?? 0,
      access_pin: t.access_pin ?? "",
      notes: t.notes ?? "",
      property_id: leasePropertyId,
      unit_id: leaseUnitId,
    });
    setFormPropertyId(leasePropertyId);
    setPinVisible(false);
    setFormTab("basic");
    setEditOpen(true);
  }

  function resetForm() {
    setForm({ ...emptyForm });
    setFormPropertyId("");
    setPinVisible(false);
    setFormTab("basic");
  }

  function generatePin() {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    setForm({ ...form, access_pin: pin });
  }

  async function copyPin() {
    try {
      await navigator.clipboard.writeText(form.access_pin);
      toast.success("PIN copied");
    } catch {
      toast.error("Failed to copy");
    }
  }

  const createMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { property_id, unit_id, ...tenantData } = values;
      const { data: newTenant, error } = await supabase.from("tenants").insert([tenantData]).select("id").single();
      if (error) throw error;
      if (unit_id && newTenant) {
        const unit = propertyUnits.find((u: any) => u.id === unit_id);
        const monthlyRent = unit?.monthly_rent ?? 0;
        const { error: le } = await supabase.from("leases").insert({
          tenant_id: newTenant.id,
          unit_id,
          monthly_rent: monthlyRent,
          deposit: monthlyRent,
          deposit_months: 1,
          start_date: new Date().toISOString().slice(0, 10),
          payment_due_day: 25,
          billing_period: "monthly",
          late_fee_amount: Math.round(monthlyRent * 0.05),
          late_fee_grace_days: 5,
          status: "active",
        });
        if (le) throw le;
        await supabase.from("units").update({ status: "occupied" }).eq("id", unit_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["leases"] });
      toast.success("Tenant created" + (form.unit_id ? " with lease" : ""));
      setCreateOpen(false);
      resetForm();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: typeof form & { id: string }) => {
      const { id, property_id, unit_id, ...rest } = values;
      const { error } = await supabase.from("tenants").update(rest).eq("id", id);
      if (error) throw error;
      if (unit_id) {
        const existingLease = tenants.find((t: any) => t.id === id)?.lease;
        if (existingLease) {
          if (existingLease.unit_id !== unit_id) {
            await supabase.from("units").update({ status: "vacant" }).eq("id", existingLease.unit_id);
            const unit = propertyUnits.find((u: any) => u.id === unit_id);
            const monthlyRent = unit?.monthly_rent ?? existingLease.monthly_rent;
            const { error: le } = await supabase.from("leases").update({
              unit_id,
              monthly_rent: monthlyRent,
              deposit: monthlyRent,
            }).eq("id", existingLease.id);
            if (le) throw le;
            await supabase.from("units").update({ status: "occupied" }).eq("id", unit_id);
          }
        } else {
          const unit = propertyUnits.find((u: any) => u.id === unit_id);
          const monthlyRent = unit?.monthly_rent ?? 0;
          const { error: le } = await supabase.from("leases").insert({
            tenant_id: id,
            unit_id,
            monthly_rent: monthlyRent,
            deposit: monthlyRent,
            deposit_months: 1,
            start_date: new Date().toISOString().slice(0, 10),
            payment_due_day: 25,
            billing_period: "monthly",
            late_fee_amount: Math.round(monthlyRent * 0.05),
            late_fee_grace_days: 5,
            status: "active",
          });
          if (le) throw le;
          await supabase.from("units").update({ status: "occupied" }).eq("id", unit_id);
        }
      } else {
        const existingLease = tenants.find((t: any) => t.id === id)?.lease;
        if (existingLease) {
          await supabase.from("leases").update({ status: "ended" }).eq("id", existingLease.id);
          await supabase.from("units").update({ status: "vacant" }).eq("id", existingLease.unit_id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      qc.invalidateQueries({ queryKey: ["leases"] });
      toast.success("Tenant updated");
      setEditOpen(false);
      setSelectedTenant(null);
      resetForm();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tenants").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Tenant status updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function handleCreate() {
    if (!form.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    createMutation.mutate(form);
  }

  function handleUpdate() {
    if (!form.full_name.trim()) {
      toast.error("Full name is required");
      return;
    }
    updateMutation.mutate({ ...form, id: selectedTenant.id });
  }

  function statusBadge(status: string) {
    const cls = {
      active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200 dark:border-green-800",
      inactive: "bg-secondary text-secondary-foreground",
      blacklisted: "bg-destructive/10 text-destructive border-destructive/20",
    }[status] ?? "bg-secondary text-secondary-foreground";
    return <Badge variant="outline" className={cls}>{status}</Badge>;
  }

  function formatIdType(t: string) {
    return t === "drivers_license" ? "Driver's License" : t === "national_id" ? "National ID" : "Passport";
  }

  if (!isStaff) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  const fields: GridCardField<any>[] = [
    {
      render: (t) => (
        <div className="flex items-start justify-between">
          <h3 className="text-base font-bold">{t.full_name || "—"}</h3>
          {statusBadge(t.status)}
        </div>
      ),
    },
    {
      label: "Contact",
      render: (t) => (
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            {t.phone || "—"}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            {t.email || "—"}
          </div>
        </div>
      ),
    },
    {
      label: "Property / Unit",
      render: (t) => t.lease ? (
        <div className="space-y-1 text-sm">
          <div className="font-medium">{t.lease.units?.properties?.name ?? "—"}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Home className="h-3 w-3" />
            Unit {t.lease.units?.unit_number ?? "—"}
            {t.lease.units?.floor_number != null && (
              <><Layers className="ml-1 h-3 w-3" /> Fl {t.lease.units?.floor_number}</>
            )}
          </div>
          <div className="text-xs">UGX {Number(t.lease.monthly_rent).toLocaleString()}/mo</div>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">No active lease</span>
      ),
    },
    {
      label: "Balance",
      render: (t) => t.lease && Number(t.lease.outstanding_balance) > 0 ? (
        <div className="flex items-center gap-1.5 text-sm font-medium text-red-500">
          <AlertTriangle className="h-3.5 w-3.5" />
          UGX {Number(t.lease.outstanding_balance).toLocaleString()}
        </div>
      ) : (
        <span className="text-sm text-green-600">—</span>
      ),
    },
  ];

  const dialogForm = (
    <Tabs value={formTab} onValueChange={setFormTab} className="w-full">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="lease">Property / Unit</TabsTrigger>
        <TabsTrigger value="emergency">Emergency</TabsTrigger>
        <TabsTrigger value="employment">Employment</TabsTrigger>
        <TabsTrigger value="portal">Portal Access</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input id="full_name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. John Mukasa" />
          <p className="mt-1 text-xs text-muted-foreground">Legal full name as it appears on identification documents.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number *</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +256 700 123456" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="tenant@example.com" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="id_type">ID Type *</Label>
            <SearchableSelect
              value={form.id_type}
              onValueChange={(v) => setForm({ ...form, id_type: v })}
              placeholder="Select ID type"
              options={ID_TYPE_OPTIONS}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="id_number">ID Number *</Label>
            <Input id="id_number" value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} placeholder="e.g. CM12345678" />
            <p className="mt-1 text-xs text-muted-foreground">Government-issued identification number.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <SearchableSelect
            value={form.status}
            onValueChange={(v) => setForm({ ...form, status: v })}
            placeholder="Select status"
            options={STATUS_OPTIONS}
          />
          <p className="mt-1 text-xs text-muted-foreground">Active tenants can be assigned leases. Blacklisted tenants cannot rent properties.</p>
        </div>
      </TabsContent>

      <TabsContent value="lease" className="space-y-4 pt-4">
        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          Select a property and unit to automatically create an active lease for this tenant.
          The tenant will be linked to the selected unit with standard payment terms.
        </div>
        <div className="space-y-2">
          <Label>Property</Label>
          <select
            className="w-full rounded-md border border-input bg-background p-2 text-sm"
            value={formPropertyId}
            onChange={(e) => {
              setFormPropertyId(e.target.value);
              setForm({ ...form, property_id: e.target.value, unit_id: "" });
            }}
          >
            <option value="">— Select property —</option>
            {properties.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.location ? `— ${p.location}` : ""}
              </option>
            ))}
          </select>
        </div>

        {formPropertyId && (
          <div className="space-y-2">
            <Label>Unit</Label>
            {propertyUnits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No units found for this property.</p>
            ) : (
              <div className="grid gap-2">
                {propertyUnits
                  .filter((u: any) => u.status === "vacant" || u.id === form.unit_id)
                  .map((u: any) => {
                    const isSelected = form.unit_id === u.id;
                    return (
                      <label
                        key={u.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition hover:bg-accent/10 ${
                          isSelected ? "border-accent bg-accent/5 ring-1 ring-accent" : "border-input"
                        } ${u.status !== "vacant" && !isSelected ? "cursor-not-allowed opacity-40" : ""}`}
                        onClick={() => {
                          if (u.status === "vacant" || isSelected) {
                            setForm({ ...form, property_id: formPropertyId, unit_id: isSelected ? "" : u.id });
                          }
                        }}
                      >
                        <input
                          type="radio"
                          name="unit"
                          className="h-4 w-4 accent-accent"
                          checked={isSelected}
                          readOnly
                        />
                        <div className="flex-1">
                          <div className="font-medium">
                            <Home className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                            Unit {u.unit_number}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {u.floor_number != null && (
                              <span className="flex items-center gap-1">
                                <Layers className="h-3 w-3" />
                                Floor {u.floor_number}
                              </span>
                            )}
                            {u.bedrooms != null && <span>{u.bedrooms} bed</span>}
                            {u.bathrooms != null && <span>{u.bathrooms} bath</span>}
                            <span>UGX {Number(u.monthly_rent).toLocaleString()}/mo</span>
                          </div>
                        </div>
                        <Badge variant={u.status === "vacant" ? "outline" : "default"} className="text-xs">
                          {u.status}
                        </Badge>
                      </label>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {form.unit_id && (
          <div className="rounded-md bg-green-50 dark:bg-green-950/20 p-3 text-xs text-green-800 dark:text-green-300">
            <Check className="mr-1 inline h-3.5 w-3.5" />
            A lease will be created with this unit. Start date: today, Deposit: 1 month, Due day: 25th.
          </div>
        )}
      </TabsContent>

      <TabsContent value="emergency" className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
            <Input id="emergency_contact_name" value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} placeholder="e.g. Sarah Mukasa" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
            <Input id="emergency_contact_phone" value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} placeholder="e.g. +256 700 654321" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="previous_address">Previous Address</Label>
          <Textarea id="previous_address" rows={3} value={form.previous_address} onChange={(e) => setForm({ ...form, previous_address: e.target.value })} placeholder="e.g. Plot 10, Kololo, Kampala" />
          <p className="mt-1 text-xs text-muted-foreground">Tenant's previous place of residence for reference.</p>
        </div>
      </TabsContent>

      <TabsContent value="employment" className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="occupation">Occupation</Label>
            <Input id="occupation" value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} placeholder="e.g. Software Engineer" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employer">Employer</Label>
            <Input id="employer" value={form.employer} onChange={(e) => setForm({ ...form, employer: e.target.value })} placeholder="e.g. ABC Company Ltd" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="monthly_income">Monthly Income (UGX)</Label>
          <Input id="monthly_income" type="number" min={0} value={form.monthly_income} onChange={(e) => setForm({ ...form, monthly_income: Number(e.target.value) })} placeholder="e.g. 3000000" />
          <p className="mt-1 text-xs text-muted-foreground">Used for affordability assessment. Should be at least 2.5× the monthly rent.</p>
        </div>
      </TabsContent>

      <TabsContent value="portal" className="space-y-4 pt-4">
        <div className="space-y-2">
          <Label htmlFor="access_pin">Access PIN (4-digit)</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="access_pin"
                type={pinVisible ? "text" : "password"}
                maxLength={4}
                value={form.access_pin}
                onChange={(e) => setForm({ ...form, access_pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="0000"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setPinVisible(!pinVisible)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {pinVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="button" variant="outline" onClick={generatePin}>
              <Key className="mr-2 h-4 w-4" /> Generate
            </Button>
            <Button type="button" variant="outline" onClick={copyPin} disabled={!form.access_pin}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Used for tenant portal login. Must be a 4-digit number. Share securely with the tenant.</p>
        </div>
      </TabsContent>

      <div className="mt-4 space-y-2">
        <Label htmlFor="notes">Internal Notes</Label>
        <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional remarks, special considerations, or details about the tenant…" />
        <p className="mt-1 text-xs text-muted-foreground">Notes visible only to staff. Not shared with the tenant.</p>
      </div>
    </Tabs>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">People</div>
          <h1 className="display text-3xl font-bold">Tenants</h1>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="mr-2 h-4 w-4" />Add Tenant
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Tenant</DialogTitle>
            </DialogHeader>
            {dialogForm}
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <div className="h-2 w-2 rounded-full bg-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{inactiveCount}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blacklisted</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{blacklistedCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All ({total})</TabsTrigger>
          <TabsTrigger value="active">Active ({activeCount})</TabsTrigger>
          <TabsTrigger value="inactive">Inactive ({inactiveCount})</TabsTrigger>
          <TabsTrigger value="blacklisted">Blacklisted ({blacklistedCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      <GridDataCards
        data={displayed}
        fields={fields}
        keyExtractor={(t) => t.id}
        isLoading={isLoading}
        emptyMessage={search || statusFilter !== "all" ? "No matching tenants" : "No tenants yet"}
        emptyIcon={<Users className="h-10 w-10 text-muted-foreground" />}
        actions={(t) => (
          <div className="flex w-full items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            {t.status === "blacklisted" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => statusMutation.mutate({ id: t.id, status: "active" })}
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Reactivate
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => statusMutation.mutate({ id: t.id, status: "blacklisted" })}
              >
                <ShieldAlert className="h-4 w-4 mr-1" /> Blacklist
              </Button>
            )}
          </div>
        )}
      />

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) { setSelectedTenant(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
          </DialogHeader>
          {dialogForm}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setEditOpen(false); setSelectedTenant(null); resetForm(); }}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
