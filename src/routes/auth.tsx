import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Building2, HardHat, Users, UserCog, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional(), redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Habico Portal" }, { name: "description", content: "Access your Habico owner or tenant portal." }] }),
  component: AuthPage,
});

const roles = [
  { icon: Users, title: "Renter / Tenant", desc: "Pay rent, submit maintenance requests, view lease documents." },
  { icon: Building2, title: "Property Owner", desc: "Track income, occupancy, and property performance." },
  { icon: HardHat, title: "Worker / Staff", desc: "Log timesheets, update project tasks, submit daily reports." },
  { icon: ShieldCheck, title: "Admin / Manager", desc: "Full access to all modules, users, and system settings." },
];

function AuthPage() {
  const search = Route.useSearch();
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: search.redirect ?? "/dashboard" });
  }, [loading, user, nav, search.redirect]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Account created. Welcome to Habico.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden bg-gradient-hero p-12 text-primary-foreground md:flex md:flex-col md:justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground"><Building2 className="h-5 w-5"/></div>
          <div className="display text-xl font-bold">HABICO</div>
        </Link>
        <div>
          <h1 className="display text-4xl font-bold leading-tight">Your property,<br/>operating beautifully.</h1>
          <p className="mt-4 max-w-md text-primary-foreground/80">Owners track ROI in real time. Tenants pay and request repairs in seconds. Habico runs the rest.</p>
          <div className="mt-10 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-primary-foreground/70">Who uses Habico?</h3>
            <div className="grid grid-cols-2 gap-3">
              {roles.map((r) => (
                <Card key={r.title} className="border-primary-foreground/20 bg-primary-foreground/10">
                  <CardContent className="flex items-start gap-3 p-4">
                    <r.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary-foreground/80" />
                    <div>
                      <div className="text-sm font-medium">{r.title}</div>
                      <div className="mt-0.5 text-xs text-primary-foreground/70">{r.desc}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
        <div className="text-xs uppercase tracking-widest text-primary-foreground/60">Habico Property Managers · Kampala</div>
      </div>
      <div className="flex items-center justify-center bg-background p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <h2 className="display text-3xl font-bold">{mode === "signup" ? "Create account" : "Welcome back"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "signup" ? "Sign up to access your Habico portal." : "Sign in to your Habico portal."}</p>
          <div className="mt-6 space-y-4">
            {mode === "signup" && (
              <div><Label htmlFor="name">Full name</Label><Input id="name" value={name} onChange={(e)=>setName(e.target.value)} required maxLength={100} className="mt-1.5"/></div>
            )}
            <div><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required maxLength={255} className="mt-1.5"/></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required minLength={8} className="mt-1.5"/></div>
            <Button type="submit" disabled={busy} className="w-full">{busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}</Button>
            <p className="text-center text-sm text-muted-foreground">
              {mode === "signup" ? "Already have an account?" : "New to Habico?"}{" "}
              <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={()=>setMode(mode==="signup"?"signin":"signup")}>
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
