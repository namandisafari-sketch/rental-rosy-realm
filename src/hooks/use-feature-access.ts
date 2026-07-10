import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useFeatureAccess(featureKey: string) {
  const { data: hasAccess } = useQuery({
    queryKey: ["feature-access", featureKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("company_has_feature", { p_feature_key: featureKey })
        .single();
      if (error) throw error;
      return (data ?? false) as boolean;
    },
    staleTime: 1000 * 60 * 5,
  });
  return hasAccess ?? false;
}

export function useAllFeatureAccess() {
  const { data: features } = useQuery({
    queryKey: ["all-feature-access"],
    queryFn: async () => {
      const keys = ["rental", "construction", "construction_financial", "sop", "reports", "companies", "branding"];
      const results = await Promise.all(
        keys.map(async (key) => {
          const { data } = await supabase
            .rpc("company_has_feature", { p_feature_key: key })
            .single();
          return [key, data ?? false] as const;
        })
      );
      return Object.fromEntries(results) as Record<string, boolean>;
    },
    staleTime: 1000 * 60 * 5,
  });
  return features ?? {};
}
