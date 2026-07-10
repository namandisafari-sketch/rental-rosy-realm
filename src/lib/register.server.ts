import { createServerFn } from "@tanstack/react-start";
import Stripe from "stripe";
import { sendLicenseKeyEmail } from "./email.server";

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY env var");
  return new Stripe(key);
};

export const createRegistrationIntent = createServerFn({ method: "POST" })
  .inputValidator((input: { planId: string; amount: number; companyName: string; adminEmail: string }) => input)
  .handler(async ({ data }) => {
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(data.amount * 100),
      currency: "ugx",
      metadata: {
        type: "company_registration",
        plan_id: data.planId,
        company_name: data.companyName,
        admin_email: data.adminEmail,
      },
    });
    return { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id };
  });

export const completeRegistration = createServerFn({ method: "POST" })
  .inputValidator((input: {
    paymentIntentId: string;
    planId: string;
    companyName: string;
    companyEmail: string;
    companyPhone: string;
    companyAddress: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    adminPhone: string;
  }) => input)
  .handler(async ({ data }) => {
    const stripe = getStripe();
    const pi = await stripe.paymentIntents.retrieve(data.paymentIntentId);
    if (pi.status !== "succeeded") {
      return { success: false as const, error: "Payment not completed" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Create the company
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const licenseKey = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: data.companyName,
        email: data.companyEmail || null,
        phone: data.companyPhone || null,
        address: data.companyAddress || null,
        license_key: licenseKey,
        plan_id: data.planId || null,
        is_active: true,
      })
      .select("id")
      .single();

    if (companyError) return { success: false as const, error: companyError.message };
    if (!company) return { success: false as const, error: "Failed to create company" };

    // 2. Create the auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.adminEmail,
      password: data.adminPassword,
      email_confirm: true,
      user_metadata: { full_name: data.adminName },
    });

    if (authError) {
      await supabaseAdmin.from("companies").delete().eq("id", company.id);
      return { success: false as const, error: authError.message };
    }

    const userId = authUser.user.id;

    // 3. Update profile with company_id and full_name
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ company_id: company.id, full_name: data.adminName })
      .eq("id", userId);

    if (profileError) {
      await supabaseAdmin.from("companies").delete().eq("id", company.id);
      return { success: false as const, error: profileError.message };
    }

    // 4. Assign admin + manager roles
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert([
        { user_id: userId, role: "admin" },
        { user_id: userId, role: "manager" },
      ]);

    if (roleError) {
      return { success: false as const, error: roleError.message };
    }

    // 5. Record the payment
    const { error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        amount: pi.amount_received ? pi.amount_received / 100 : 0,
        method: "stripe",
        payment_type: "registration",
        stripe_payment_intent_id: data.paymentIntentId,
        stripe_payment_status: pi.status,
        payment_date: new Date().toISOString().slice(0, 10),
      });

    if (paymentError) console.error("Failed to record registration payment", paymentError);

    // 6. Send license key email
    const { data: plan } = await supabaseAdmin
      .from("subscription_plans")
      .select("name")
      .eq("id", data.planId)
      .single();

    sendLicenseKeyEmail({
      to: data.adminEmail,
      companyName: data.companyName,
      licenseKey,
      adminName: data.adminName,
      adminEmail: data.adminEmail,
      planName: plan?.name ?? "Unknown",
    }).catch((e) => console.error("Failed to send license email", e));

    return {
      success: true,
      licenseKey,
      companyId: company.id,
      userId,
    };
  });
