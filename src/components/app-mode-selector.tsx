import { useNavigate } from "@tanstack/react-router";
import { Building2, HardHat, Search, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAppMode, type AppMode } from "@/hooks/app-mode";
import AppStoreBadges from "@/components/app-store-badges";

const options: { mode: AppMode; icon: typeof Building2; title: string; desc: string; action: string }[] = [
  { mode: "landlord", icon: Building2, title: "Landlord", desc: "Track your properties, income, and occupancy. Manage leases and view reports.", action: "Owner Portal" },
  { mode: "company", icon: HardHat, title: "Company", desc: "Full-access management hub for Habico staff — properties, tenants, finances, and more.", action: "Management" },
  { mode: "visitor", icon: Search, title: "Visitor", desc: "Browse available rentals, view details, and apply or contact Habico directly.", action: "Browse Rentals" },
];

export function AppModeSelector() {
  const nav = useNavigate();
  const { setMode } = useAppMode();

  function handleSelect(mode: AppMode) {
    setMode(mode);
    if (mode === "landlord") {
      nav({ to: "/auth", search: { mode: "signup" } });
    } else if (mode === "company") {
      nav({ to: "/auth", search: { mode: "signin" } });
    } else {
      nav({ to: "/rent" });
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-background to-secondary/30 px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Building2 className="h-8 w-8" />
        </div>
        <h1 className="display text-3xl font-bold">Habico</h1>
        <p className="mt-2 text-sm text-muted-foreground">How would you like to access?</p>
      </div>

      <div className="flex w-full max-w-md flex-col gap-4">
        {options.map((opt) => (
          <Card
            key={opt.mode}
            className="group cursor-pointer transition hover:-translate-y-0.5 hover:shadow-soft"
            onClick={() => handleSelect(opt.mode)}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <opt.icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="display text-lg font-bold">{opt.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{opt.desc}</div>
              </div>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground/40 transition group-hover:text-accent group-hover:translate-x-0.5" />
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-10 max-w-sm text-center text-xs text-muted-foreground">
        Choose how you'd like to use Habico. You can switch later from the menu.
      </p>

      <div className="mt-12 border-t border-border pt-8">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">Download the Habico app</p>
        <div className="mt-4 flex justify-center">
          <AppStoreBadges compact />
        </div>
      </div>
    </div>
  );
}
