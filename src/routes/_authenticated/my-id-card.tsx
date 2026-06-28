import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { RentalCardFront, RentalCardBack, type RentalCardData } from "@/components/rental-id-card";
import { ScaledCard } from "./rental-id-cards";
import { exportCardSides } from "@/lib/export-id-card";

export const Route = createFileRoute("/_authenticated/my-id-card")({
  head: () => ({ meta: [{ title: "My ID Card — Habico Portal" }] }),
  component: MyIdCardPage,
});

function toCardData(c: any): RentalCardData {
  return {
    cardNumber: c.card_number,
    propertyName: c.units?.properties?.name ?? "Habico Property",
    unitNumber: c.units?.unit_number ?? "—",
    tenantName: c.tenants?.full_name ?? null,
    tenantPhone: c.tenants?.phone ?? null,
    issuedAt: c.issued_at,
    status: c.status,
  };
}

function MyIdCardPage() {
  const { user } = useAuth();
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["my-rental-id-cards", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_id_cards")
        .select("*, units!inner(id, unit_number, properties!inner(id, name)), tenants!inner(id, full_name, phone, auth_user_id)")
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  async function handleExport(card: any) {
    setExporting(card.id);
    await new Promise((r) => setTimeout(r, 100));
    try {
      await exportCardSides({
        frontNode: frontRef.current,
        backNode: backRef.current,
        cardNumber: card.card_number,
        tenantName: card.tenants?.full_name,
        unitNumber: card.units?.unit_number,
      });
      toast.success("Downloaded your ID card");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-accent">Tenant Portal</div>
        <h1 className="display text-3xl font-bold">My ID Card</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan the QR on your card with the Habico mobile app or your mobile money menu to pay rent instantly.
        </p>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : cards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No ID card issued yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Once your property manager issues your rental ID card, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {cards.map((c: any) => (
            <Card key={c.id}>
              <CardContent className="space-y-5 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-sm font-semibold">{c.card_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.units?.properties?.name} · Unit {c.units?.unit_number} · <span className="capitalize">{c.status}</span>
                    </div>
                  </div>
                  <Button onClick={() => handleExport(c)} disabled={exporting === c.id}>
                    <Download className="mr-2 h-4 w-4" />
                    {exporting === c.id ? "Preparing…" : "Download PNG (Front + Back)"}
                  </Button>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <ScaledCard scale={0.55}><RentalCardFront data={toCardData(c)} /></ScaledCard>
                  <ScaledCard scale={0.55}><RentalCardBack data={toCardData(c)} /></ScaledCard>
                </div>
                {exporting === c.id && (
                  <div style={{ position: "fixed", top: 0, left: -9999, opacity: 0 }} aria-hidden>
                    <RentalCardFront ref={frontRef} data={toCardData(c)} />
                    <div style={{ height: 20 }} />
                    <RentalCardBack ref={backRef} data={toCardData(c)} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
