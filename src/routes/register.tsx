import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Check, Copy, ExternalLink, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createRegistrationIntent, completeRegistration } from "@/lib/register.server";
import AppStoreBadges from "@/components/app-store-badges";

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!STRIPE_KEY) return null;
  if (!stripePromise) stripePromise = loadStripe(STRIPE_KEY);
  return stripePromise;
}

export type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price: number;
};

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Register — Habico Portal" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ plan: typeof s.plan === "string" ? s.plan : undefined }),
  component: RegisterPage,
});

export function RegisterPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { plan?: string };

  useEffect(() => {
    if (typeof document !== "undefined") document.title = "Register — Habico Portal";
  }, []);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: plans = [] } = useQuery({
    queryKey: ["register-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscription_plans").select("*").eq("is_active", true).order("sort_order");
      if (error && !error.message?.includes("does not exist")) throw error;
      return (data ?? []) as Plan[];
    },
    retry: false,
  });

  // Preselect plan from ?plan=slug or ?plan=id
  const preselect = useMemo(() => search.plan, [search.plan]);
  useEffect(() => {
    if (!preselect || selectedPlan) return;
    const p = plans.find((x) => x.slug === preselect || x.id === preselect);
    if (p) setSelectedPlan(p);
  }, [preselect, plans, selectedPlan]);

  const createIntent = useMutation({
    mutationFn: async (plan: Plan) => {
      return createRegistrationIntent({ data: {
        planId: plan.id,
        amount: plan.monthly_price,
        companyName,
        adminEmail,
      }});
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret ?? "");
      setPaymentIntentId(data.paymentIntentId);
      setStep(3);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create payment"),
  });

  const finishFreeRegistration = useMutation({
    mutationFn: async () => completeRegistration({ data: {
      paymentIntentId: "",
      planId: selectedPlan?.id ?? "",
      companyName, companyEmail, companyPhone, companyAddress,
      adminName, adminEmail, adminPassword, adminPhone,
    }}),
    onSuccess: (result) => {
      if (!result.success) { toast.error(result.error); return; }
      setLicenseKey(result.licenseKey);
      setStep(4);
      toast.success("Registration complete!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to register"),
  });

  function handleContinueToPlan() {
    if (!companyName || !adminName || !adminEmail || !adminPassword) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (adminPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setStep(2);
    // Auto-advance if a plan is preselected
    if (selectedPlan) handleSelectPlan(selectedPlan);
  }

  function handleSelectPlan(plan: Plan) {
    setSelectedPlan(plan);
    if (Number(plan.monthly_price) <= 0) {
      // Free plan — skip payment
      finishFreeRegistration.mutate();
      return;
    }
    if (!STRIPE_KEY) {
      toast.error("Online payment isn't configured yet. Please contact sales to activate this plan.");
      return;
    }
    createIntent.mutate(plan);
  }

  function handleComplete(licenseKey: string) {
    setLicenseKey(licenseKey);
    setStep(4);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/pricing"><ArrowLeft className="mr-1 h-4 w-4" /> Back to pricing</Link>
          </Button>
        </div>
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Building2 className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Habico Portal</h1>
          </div>
          <p className="text-muted-foreground">Register your company to get started{selectedPlan ? ` — ${selectedPlan.name}` : ""}</p>
        </div>

        {/* Steps indicator */}
        <div className="mb-8 flex items-center justify-center gap-2 text-sm">
          {["Details", "Plan", "Payment", "Done"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                step >= i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>{i + 1}</div>
              <span className={step >= i + 1 ? "font-medium" : "text-muted-foreground"}>{label}</span>
              {i < 3 && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader><CardTitle>Company & Admin Details</CardTitle><CardDescription>Tell us about your company and the admin account</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground">Company Information</h3>
                <div>
                  <Label>Company Name *</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your property management company" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="company@example.com" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="+256..." />
                  </div>
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="Physical address" />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground">Admin Account</h3>
                <div>
                  <Label>Full Name *</Label>
                  <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Your full name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@example.com" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} placeholder="+256..." />
                  </div>
                </div>
                <div>
                  <Label>Password *</Label>
                  <Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="Min 8 characters" />
                </div>
              </div>

              <Button className="w-full" onClick={handleContinueToPlan}>Continue to Plan Selection</Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Choose Your Plan</CardTitle><CardDescription>Select the subscription package that fits your needs</CardDescription></CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handleSelectPlan(plan)}
                      disabled={createIntent.isPending}
                      className={`flex items-center gap-4 rounded-lg border p-4 text-left transition-all hover:border-primary ${
                        selectedPlan?.id === plan.id ? "border-primary ring-2 ring-primary" : ""
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        plan.slug === "full-suite" ? "bg-amber-100 text-amber-700" :
                        plan.slug === "construction" ? "bg-blue-100 text-blue-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">{plan.name}</div>
                        {plan.description && <div className="text-sm text-muted-foreground">{plan.description}</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">UGX {Number(plan.monthly_price).toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">/month</div>
                      </div>
                    </button>
                  ))}
                </div>

                {createIntent.isPending && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Preparing payment...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {step === 3 && clientSecret && (
          <Card>
            <CardHeader><CardTitle>Payment</CardTitle><CardDescription>Complete your payment to activate your subscription</CardDescription></CardHeader>
            <CardContent>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm
                  onSuccess={handleComplete}
                  companyName={companyName}
                  companyEmail={companyEmail}
                  companyPhone={companyPhone}
                  companyAddress={companyAddress}
                  adminName={adminName}
                  adminEmail={adminEmail}
                  adminPhone={adminPhone}
                  adminPassword={adminPassword}
                  planId={selectedPlan?.id ?? ""}
                  paymentIntentId={paymentIntentId}
                />
              </Elements>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                  <Check className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle>Registration Complete!</CardTitle>
                  <CardDescription>Your company has been registered successfully</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-amber-50 p-4">
                <Label className="text-amber-800 font-semibold">Your License Key</Label>
                <div className="mt-2 flex gap-2">
                  <code className="flex-1 rounded bg-amber-100 px-3 py-2 text-sm font-mono break-all">{licenseKey}</code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => { navigator.clipboard.writeText(licenseKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-amber-700">Save this key — you'll need it to activate your company's access</p>
              </div>

              <div className="space-y-2 text-sm">
                <p><strong>Email:</strong> {adminEmail}</p>
                <p><strong>Company:</strong> {companyName}</p>
                <p><strong>Plan:</strong> {selectedPlan?.name}</p>
              </div>

              <div className="rounded-lg border p-4 text-sm">
                <p className="font-medium mb-1">What's next?</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Check your email for login credentials</li>
                  <li>Log in at <a href="https://www.habico.ug" className="text-primary underline">habico.ug</a></li>
                  <li>Configure your company branding in Settings</li>
                  <li>Invite your team members</li>
                </ol>
              </div>

              <Button className="w-full" onClick={() => navigate({ to: "/auth", search: { mode: "signin" } })}>
                Go to Login <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      <div className="mx-auto max-w-2xl px-4 pb-8">
        <div className="border-t border-border pt-6">
          <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">Download the Habico app</p>
          <div className="flex justify-center">
            <AppStoreBadges compact />
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentForm({
  onSuccess,
  companyName, companyEmail, companyPhone, companyAddress,
  adminName, adminEmail, adminPhone, adminPassword, planId, paymentIntentId,
}: {
  onSuccess: (licenseKey: string) => void;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  planId: string;
  paymentIntentId: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (submitError) {
      toast.error(submitError.message ?? "Payment failed");
      setLoading(false);
      return;
    }

    const result = await completeRegistration({ data: {
      paymentIntentId,
      planId,
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      adminName,
      adminEmail,
      adminPassword,
      adminPhone,
    }});

    if (!result.success) {
      toast.error(result.error);
      setLoading(false);
      return;
    }

    onSuccess(result.licenseKey);
    toast.success("Registration complete!");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || loading} className="w-full">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {loading ? "Processing..." : `Pay Now — UGX 0`}
      </Button>
    </form>
  );
}
