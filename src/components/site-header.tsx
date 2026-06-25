import { Link } from "@tanstack/react-router";
import { Building2, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const nav = [
    { label: "Home", to: "/" as const },
    { label: "Services", to: "/services" as const },
    { label: "About", to: "/about" as const },
    { label: "Contact", to: "/contact" as const },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="display text-base font-bold text-primary">HABICO</div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-accent">Property Managers</div>
          </div>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Button asChild><Link to="/dashboard">Dashboard</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
              <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Get started</Link></Button>
            </>
          )}
        </div>
        <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu"><Menu /></button>
      </div>
      {open && (
        <div className="border-t border-border bg-background md:hidden">
          <div className="flex flex-col p-4">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="py-2 text-sm font-medium">{n.label}</Link>
            ))}
            {user ? (
              <Button asChild className="mt-2"><Link to="/dashboard">Dashboard</Link></Button>
            ) : (
              <Button asChild className="mt-2"><Link to="/auth">Sign in</Link></Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
