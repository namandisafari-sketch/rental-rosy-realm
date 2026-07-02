import { createServerFn } from "@tanstack/react-start";

export const getRentalProperties = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("properties")
    .select("*, units(*)")
    .or("is_active.is.null,is_active.eq.true")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const filtered = (data ?? []).filter(
    (p: any) => !p.units?.length || p.units.some((u: any) => u.status?.toLowerCase() === "vacant")
  );
  return filtered;
});

export const deleteProperty = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("properties").delete().eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });
