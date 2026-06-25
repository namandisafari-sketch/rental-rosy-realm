import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Users, Receipt, Wrench, ShieldCheck, Building2, FileText } from "lucide-react";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — Habico Property Managers" },
      { name: "description", content: "Tenant management, rent collection, maintenance, legal compliance, marketing, and administrative services for property owners in Uganda." },
      { property: "og:title", content: "Services — Habico" },
      { property: "og:description", content: "Full-service property management in Uganda." },
    ],
  }),
  component: ServicesPage,
});

const groups = [
  { icon: Users, title: "Tenant Management", items: ["Marketing & advertising vacancies", "Screening prospective tenants", "Lease agreements and renewals", "Move-ins and move-outs", "Complaints and disputes", "Lease term enforcement"] },
  { icon: Receipt, title: "Rent Collection & Finance", items: ["Setting and collecting rent", "Late fees and notices", "Monthly financial statements", "Budgeting and forecasting", "Tax and regulatory filings"] },
  { icon: Wrench, title: "Maintenance & Repairs", items: ["Routine maintenance scheduling", "Emergency repair handling", "Vendor & contractor management", "Property inspections"] },
  { icon: ShieldCheck, title: "Legal & Compliance", items: ["Local, state, federal compliance", "Lawful eviction handling", "Safety inspections & certifications"] },
  { icon: Building2, title: "Property Marketing & Leasing", items: ["Professional photography & listings", "Online & offline marketing", "Hosting property showings", "Negotiating lease terms"] },
  { icon: FileText, title: "Administrative Duties", items: ["Accurate records & documentation", "Owner & tenant communication", "Insurance and property docs"] },
];

function ServicesPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="bg-gradient-hero py-20 text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-xs font-bold uppercase tracking-widest text-accent">Our Services</div>
          <h1 className="mt-3 display text-5xl font-bold md:text-6xl">Every service your property needs — under one roof.</h1>
          <p className="mt-4 max-w-2xl text-lg text-primary-foreground/85">From sourcing tenants to delivering monthly landlord reports, Habico operates your property end-to-end.</p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.title} className="rounded-2xl border border-border bg-card p-8 shadow-card">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"><g.icon className="h-6 w-6"/></div>
                <h2 className="display text-2xl font-bold">{g.title}</h2>
              </div>
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {g.items.map((it) => (<li key={it} className="flex items-start gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"/> {it}</li>))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
