import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { QRCodeSVG } from "qrcode.react";
import { Building2, CreditCard, User, MapPin, CalendarDays, CheckCircle, Send, Mail } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({ c: z.string().optional() });

export const Route = createFileRoute("/card")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Card Verification — Habico Portal" }] }),
  component: CardPage,
});

function CardPage() {
  const { c: cardNumber } = Route.useSearch();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const { data: cardData, isLoading } = useQuery({
    queryKey: ["card-lookup", cardNumber],
    enabled: !!cardNumber,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rental_id_cards")
        .select("*, units!inner(id, unit_number, floor_number, monthly_rent, properties!inner(id, name, location)), tenants!left(id, full_name, phone, email, auth_user_id)")
        .eq("card_number", cardNumber)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  async function sendLoginLink() {
    if (!cardData?.tenants?.email) return;
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cardData.tenants.email,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      setSent(true);
      toast.success("Login link sent to your email");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
          {!cardNumber ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <CreditCard className="h-10 w-10 text-muted-foreground" />
                <div>
                  <h1 className="text-xl font-bold">Scan Your ID Card</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Enter your card number to verify your identity or sign in.
                  </p>
                </div>
                <CardNumberInput />
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Looking up card…</div>
          ) : !cardData ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <CreditCard className="h-10 w-10 text-destructive" />
                <div>
                  <h1 className="text-xl font-bold">Card Not Found</h1>
                  <p className="text-sm text-muted-foreground">
                    No card matches <span className="font-mono">{cardNumber}</span>.
                  </p>
                </div>
                <Link to="/card" className="text-sm text-primary underline">Try another card</Link>
              </CardContent>
            </Card>
          ) : cardData.status !== "active" ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <CreditCard className="h-10 w-10 text-amber-500" />
                <div>
                  <h1 className="text-xl font-bold">Card {cardData.status}</h1>
                  <p className="text-sm text-muted-foreground">
                    This card has been marked as <strong>{cardData.status}</strong>.
                  </p>
                </div>
                <Link to="/" className="text-sm text-primary underline">Back to home</Link>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
                  <User className="h-8 w-8 text-accent" />
                </div>
                <h1 className="mt-4 text-2xl font-bold">
                  {cardData.tenants?.full_name || "Card Holder"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {cardData.units?.properties?.name} · Unit {cardData.units?.unit_number}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Card Number</p>
                  <p className="mt-1 font-mono text-sm font-semibold">{cardData.card_number}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-1 text-sm font-semibold capitalize text-green-600">{cardData.status}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Property</p>
                  <p className="mt-1 text-sm font-medium">{cardData.units?.properties?.name}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="mt-1 text-sm font-medium">{cardData.units?.properties?.location || "—"}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Unit</p>
                  <p className="mt-1 text-sm font-medium">{cardData.units?.unit_number}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Monthly Rent</p>
                  <p className="mt-1 text-sm font-medium">
                    UGX {(cardData.units?.monthly_rent ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {cardData.tenants?.email ? (
                <Card>
                  <CardContent className="space-y-3 py-5">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{cardData.tenants.email}</span>
                    </div>
                    {!sent ? (
                      <Button
                        className="w-full"
                        onClick={sendLoginLink}
                        disabled={sending}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {sending ? "Sending…" : "Send Login Link"}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        Login link sent. Check your email.
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      A one-time login link will be sent to your email. No password needed.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-5 text-center text-sm text-muted-foreground">
                    No email on file. Contact your property manager to register your email.
                  </CardContent>
                </Card>
              )}

              <div className="flex flex-col items-center gap-2 rounded-lg border p-6">
                <p className="text-xs text-muted-foreground">Scan to pay rent via Mobile Money</p>
                <QRCodeSVG
                  value={`${window.location.origin}/card?c=${encodeURIComponent(cardData.card_number)}`}
                  size={160}
                  level="H"
                  bgColor="#FFFFFF"
                  fgColor="#0e3a3a"
                />
                <p className="font-mono text-xs text-muted-foreground">{cardData.card_number}</p>
              </div>

              <div className="text-center">
                <Link to="/auth" className="text-sm text-primary underline">
                  Sign in with email & password
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function CardNumberInput() {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex w-full max-w-sm gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) window.location.href = `/card?c=${encodeURIComponent(value.trim())}`;
      }}
    >
      <Input
        placeholder="e.g. HBC-PUUX-BCXT"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="font-mono"
      />
      <Button type="submit">Verify</Button>
    </form>
  );
}
