import { Link } from "@tanstack/react-router";
import { Mail, Phone, MapPin, Building2 } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="display text-xl font-bold">HABICO</div>
          </div>
          <p className="mt-4 max-w-md text-sm text-primary-foreground/75">
            Elevating the value of your residences. Full-service property management for landlords and tenants across Uganda.
          </p>
        </div>
        <div>
          <h4 className="display text-sm font-bold uppercase tracking-widest text-accent">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-primary-foreground/75">
            <li><Link to="/services">Services</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/contact">Contact</Link></li>
            <li><Link to="/auth">Portal sign in</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="display text-sm font-bold uppercase tracking-widest text-accent">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm text-primary-foreground/75">
            <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> Basiima Buildings, 2nd Floor Room C03, Kampala</li>
            <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> 0702 239 607 / 0756 742 220</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> habicopropertymanagers@gmail.com</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 py-4 text-center text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} Habico Property Managers Limited. All rights reserved.
      </div>
    </footer>
  );
}
