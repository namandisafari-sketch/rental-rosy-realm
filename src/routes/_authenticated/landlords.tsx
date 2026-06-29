import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHighestRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Building2, Mail, Phone, User, Plus, Trash2, Landmark, KeyRound, Copy } from "lucide-react";
import { toast } from "sonner";
import { createLandlord, resetLandlordPassword } from "@/lib/landlord.server";

export const Route = createFileRoute("/_authenticated/landlords")({
  head: () => ({ meta: [{ title: "Landlords — Habico Portal" }] }),
  component: LandlordsPage,
});

interface OwnerWithProfile {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  propertyCount: number;
}

function LandlordsPage() {
  const role = useHighestRole();
  const isStaff = role === "admin" || role === "manager";
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", phone: "", password: "" });

  const { data: landlords = [], isLoading } = useQuery({
    queryKey: ["landlords"],
    queryFn: async () => {
      const { data: ownerRoles } = await supabase.from("user_roles").select("user_id").eq("role", "owner");
      const ids = (ownerRoles ?? []).map((r: any) => r.user_id).filter(Boolean);
      if (ids.length === 0) return [];

      const [profilesRes, propsRes] = await Promise.all([
        supabase.from("profiles").select("*").in("id", ids),
        supabase.from("properties").select("id,owner_id").in("owner_id", ids),
      ]);

      const profiles = (profilesRes.data as any[]) ?? [];
      const allProps = (propsRes.data as any[]) ?? [];

      return profiles.map((p: any) => ({
        user_id: p.id,
        full_name: p.full_name ?? "",
        email: p.email ?? "",
        phone: p.phone ?? "",
        propertyCount: allProps.filter((pr: any) => pr.owner_id === p.id).length,
      })) as OwnerWithProfile[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      try {
        const result = await createLandlord({
          data: {
            email: form.email,
            full_name: form.full_name,
            phone: form.phone || undefined,
            password: form.password || undefined,
          },
        });
        if (!result.success) throw new Error(result.error);
        return result;
      } catch (err: any) {
        if (err?.message?.includes("SUPABASE_SERVICE_ROLE_KEY") || err?.message?.includes("Supabase environment variable")) {
          throw new Error("Server not configured: missing Supabase service role key. Set SUPABASE_SERVICE_ROLE_KEY in your Vercel project environment variables.");
        }
        throw err;
      }
    },
    onSuccess: () => {
      toast.success("Landlord created successfully");
      setAddOpen(false);
      setForm({ email: "", full_name: "", phone: "", password: "" });
      qc.invalidateQueries({ queryKey: ["landlords"] });
      qc.invalidateQueries({ queryKey: ["properties"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to create landlord. Check server configuration."),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "owner");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Landlord role removed");
      qc.invalidateQueries({ queryKey: ["landlords"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [resetFor, setResetFor] = useState<OwnerWithProfile | null>(null);
  const [newPw, setNewPw] = useState("");
  const [issuedPw, setIssuedPw] = useState<string | null>(null);

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!resetFor) throw new Error("No landlord selected");
      const res = await resetLandlordPassword({
        data: { user_id: resetFor.user_id, password: newPw || undefined },
      });
      if (!res.success) throw new Error(res.error);
      return res.password;
    },
    onSuccess: (pw) => {
      setIssuedPw(pw);
      setNewPw("");
      toast.success("Password updated");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Property Owners</div>
          <h1 className="display text-3xl font-bold">Landlords</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {landlords.length} registered landlord{landlords.length === 1 ? "" : "s"}
          </p>
        </div>
        {isStaff && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="mr-2 h-4 w-4" />Add Landlord
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Register a new landlord</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Full Name *</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. John Mugisha" />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. landlord@email.com" />
                  <p className="mt-1 text-xs text-muted-foreground">This will be the landlord's login email.</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +256 700 000 000" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to auto-generate" />
                  <p className="mt-1 text-xs text-muted-foreground">If left blank, a random password will be generated.</p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => addMutation.mutate()} disabled={!form.full_name || !form.email || addMutation.isPending}>
                  {addMutation.isPending ? "Creating..." : "Create Landlord Account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading landlords...</div>
      ) : landlords.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Landmark className="h-10 w-10 text-muted-foreground" />
            <div className="font-medium">No landlords registered yet</div>
            <div className="text-sm text-muted-foreground">Add your first landlord to link them to properties.</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {landlords.map((l) => (
            <Card key={l.user_id} className="shadow-card">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{l.full_name || "Unnamed"}</h3>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />{l.email}
                      </div>
                      {l.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />{l.phone}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
                      {l.propertyCount} property{l.propertyCount === 1 ? "" : "ies"}
                    </div>
                    {isStaff && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Remove landlord?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This removes the <strong>owner</strong> role from {l.full_name || l.email}. Their profile and linked properties will not be deleted.
                          </AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => removeMutation.mutate(l.user_id)} className="bg-destructive text-destructive-foreground">
                              Remove Role
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {landlords.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="display text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              How it works
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>Each landlord has an <strong>owner</strong> role account. They can log in and see their own properties, tenants, and financial reports.</p>
            <p>To link a property to a landlord, go to <strong>Properties</strong> and edit the property to select the landlord from the dropdown.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
