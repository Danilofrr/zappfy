import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Fires a "Venda aprovada!" push to the order owner. Safe to call after the
 * store owner creates an order from the dashboard (Novo Pedido) — the public
 * checkout webhook already sends its own push via /api/public/submit-order.
 */
export const notifyOrderCreated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error } = await (supabase as any)
      .from("orders")
      .select("id, user_id, total")
      .eq("id", data.orderId)
      .maybeSingle();

    if (error) {
      console.error("[notify-order] load failed", error);
      return { sent: 0, removed: 0, skipped: "load-failed" };
    }
    if (!order) return { sent: 0, removed: 0, skipped: "not-found" };
    // Only send to the actual owner to avoid leaking notifications across tenants.
    if (order.user_id !== userId) return { sent: 0, removed: 0, skipped: "not-owner" };

    const total = Number(order.total ?? 0);
    const totalLabel = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const { sendPushToUser } = await import("@/lib/push.server");
    return sendPushToUser(supabase, userId, {
      title: "Venda aprovada!",
      body: `Valor: ${totalLabel}`,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: `order-${order.id}`,
      data: { url: "/pedidos", orderId: order.id, sound: "/cash-register.mp3" },
    });
  });
