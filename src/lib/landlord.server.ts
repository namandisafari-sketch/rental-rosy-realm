import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resetLandlordPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; password?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isManager } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "manager",
    });
    if (!isAdmin && !isManager) {
      return { success: false as const, error: "Forbidden" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const newPassword = data.password || Math.random().toString(36).slice(2, 10) + "A1!";
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: newPassword,
    });
    if (error) return { success: false as const, error: error.message };
    return { success: true as const, password: newPassword };
  });


export const createLandlord = createServerFn({ method: "POST" })
  .inputValidator((input: {
    email: string;
    password?: string;
    full_name: string;
    phone?: string;
  }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const pw = data.password || Math.random().toString(36).slice(2) + "A1!";

    const { data: userData, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: pw,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone ?? "" },
    });

    if (error) {
      return { success: false as const, error: error.message };
    }

    const userId = userData.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone ?? null,
    });

    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "owner",
    });

    return { success: true as const, userId };
  });
