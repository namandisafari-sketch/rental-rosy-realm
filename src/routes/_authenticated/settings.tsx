import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Habico Portal" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, roles } = useAuth();
  const [profile, setProfile] = useState({ full_name: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
      if (data) setProfile({ full_name: data.full_name ?? "", phone: data.phone ?? "", email: data.email ?? user.email ?? "" });
    });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ full_name: profile.full_name, phone: profile.phone }).eq("id", user.id);
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-accent">Account</div>
        <h1 className="display text-3xl font-bold">Settings</h1>
      </div>
      <Card>
        <CardHeader><CardTitle className="display">Profile</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div><Label>Full name</Label><Input value={profile.full_name} onChange={(e)=>setProfile({...profile, full_name:e.target.value})} maxLength={100}/></div>
          <div><Label>Email</Label><Input value={profile.email} disabled/></div>
          <div><Label>Phone</Label><Input value={profile.phone} onChange={(e)=>setProfile({...profile, phone:e.target.value})} maxLength={30}/></div>
          <div><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="display">Roles</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {roles.length === 0 ? <span className="text-sm text-muted-foreground">No roles assigned.</span> :
              roles.map((r) => <span key={r} className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">{r}</span>)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">New accounts start as tenant. A Habico manager will upgrade your role to owner or staff as needed.</p>
        </CardContent>
      </Card>
    </div>
  );
}
