import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import {
  addCalendarDays,
  buildInventoryForecast,
  clampPlanningNumber,
  DEFAULT_INVENTORY_PLANNING,
  localDayKey,
  type InventoryPlanningSettings,
  type PendingPurchase,
  type SalesDay,
} from "@/lib/inventory-forecast";

type AdvisorData = {
  sales: SalesDay[];
  pending: PendingPurchase[];
  settings: InventoryPlanningSettings;
};

export const INVENTORY_ADVISOR_QUERY_KEY = "inventory-advisor";

export function notifyInventoryPurchasesChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("zappfy:purchase-orders-changed"));
  }
}

/**
 * Dados de compras/fornecedores e vendas agregadas isolados por store_id.
 * Nao consulta ou envia dados sensiveis de clientes a nenhum provedor de IA.
 */
export function useInventoryAdvisor() {
  const { state, access } = useStore();
  const queryClient = useQueryClient();
  const storeId = access?.isOwner ? access.storeId : null;

  const query = useQuery<AdvisorData>({
    queryKey: [INVENTORY_ADVISOR_QUERY_KEY, storeId],
    enabled: Boolean(storeId),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!storeId) throw new Error("Loja indisponivel");
      const since = localDayKey(addCalendarDays(new Date(), -125));
      const [sales, pending, saved] = await Promise.all([
        (supabase as any).rpc("inventory_sales_daily", {
          _store_id: storeId,
          _since: since,
        }),
        (supabase.from("purchase_orders" as any) as any)
          .select("product_id,product_name,quantity,order_date")
          .eq("store_id", storeId)
          .eq("status", "pendente"),
        (supabase.from("inventory_planning_settings" as any) as any)
          .select("lead_days,review_days,safety_days")
          .eq("store_id", storeId)
          .maybeSingle(),
      ]);

      if (sales.error) throw sales.error;
      if (pending.error) throw pending.error;
      if (saved.error) throw saved.error;

      return {
        sales: Array.isArray(sales.data) ? sales.data as SalesDay[] : [],
        pending: Array.isArray(pending.data) ? pending.data as PendingPurchase[] : [],
        settings: {
          leadDays: clampPlanningNumber(saved.data?.lead_days, DEFAULT_INVENTORY_PLANNING.leadDays, 1, 30),
          reviewDays: clampPlanningNumber(saved.data?.review_days, DEFAULT_INVENTORY_PLANNING.reviewDays, 1, 60),
          safetyDays: clampPlanningNumber(saved.data?.safety_days, DEFAULT_INVENTORY_PLANNING.safetyDays, 0, 30),
        },
      };
    },
  });

  const forecast = useMemo(() => {
    if (!query.data || !storeId) return null;
    return buildInventoryForecast(
      state.products,
      query.data.sales,
      query.data.pending,
      query.data.settings,
    );
  }, [state.products, query.data, storeId]);

  useEffect(() => {
    if (!storeId) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: [INVENTORY_ADVISOR_QUERY_KEY, storeId] });
    };
    window.addEventListener("zappfy:purchase-orders-changed", refresh);
    return () => window.removeEventListener("zappfy:purchase-orders-changed", refresh);
  }, [queryClient, storeId]);

  const saveSettings = useCallback(async (values: InventoryPlanningSettings) => {
    if (!storeId || !access?.isOwner) throw new Error("Apenas o proprietario pode configurar o planejamento.");
    const settings = {
      lead_days: clampPlanningNumber(values.leadDays, 7, 1, 30),
      review_days: clampPlanningNumber(values.reviewDays, 15, 1, 60),
      safety_days: clampPlanningNumber(values.safetyDays, 3, 0, 30),
    };
    const { error } = await (supabase.from("inventory_planning_settings" as any) as any)
      .upsert({
        store_id: storeId,
        owner_id: access.ownerId,
        ...settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: "store_id" });
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: [INVENTORY_ADVISOR_QUERY_KEY, storeId] });
  }, [storeId, access?.isOwner, access?.ownerId, queryClient]);

  return {
    enabled: Boolean(storeId),
    forecast,
    settings: query.data?.settings ?? DEFAULT_INVENTORY_PLANNING,
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: query.error,
    saveSettings,
    refresh: query.refetch,
  };
}
