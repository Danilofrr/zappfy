import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const orderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  qty: z.number().int().positive(),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative(),
});

const submitSchema = z.object({
  slug: z.string().min(1).max(120),
  order: z.object({
    customer: z.string().min(1).max(200),
    phone: z.string().min(1).max(40),
    address: z.string().max(400).optional().default(""),
    district: z.string().max(200).optional().default(""),
    city: z.string().max(200).optional().default(""),
    items: z.array(orderItemSchema).min(1),
    total: z.number().nonnegative().optional(),
    payment: z.enum(["pix", "cartao", "dinheiro"]),
    notes: z.string().max(2000).optional().default(""),
  }),
});

function jsonError(status: number, message: string, detail?: unknown) {
  return new Response(
    JSON.stringify({ error: message, detail: detail ?? null }),
    { status, headers: { "content-type": "application/json" } },
  );
}

export const Route = createFileRoute("/api/public/submit-order")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return jsonError(400, "JSON inválido");
        }

        const parsed = submitSchema.safeParse(raw);
        if (!parsed.success) {
          console.error("[submit-order] validation failed", parsed.error.flatten());
          return jsonError(400, "Dados do pedido inválidos", parsed.error.flatten());
        }

        const { slug, order } = parsed.data;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: settingsRow, error: sErr } = await supabaseAdmin
          .from("settings")
          .select("user_id, delivery_fee")
          .ilike("slug", slug.toLowerCase().trim())
          .maybeSingle();

        if (sErr) {
          console.error("[submit-order] settings lookup error", sErr);
          return jsonError(500, "Falha ao localizar loja", sErr.message);
        }
        if (!settingsRow?.user_id) {
          return jsonError(404, "Loja não encontrada");
        }

        // Re-fetch authoritative product price/cost server-side.
        const productIds = order.items.map((i) => i.productId);
        const { data: prodRows, error: pErr } = await supabaseAdmin
          .from("products")
          .select("id, name, price, cost")
          .in("id", productIds)
          .eq("user_id", settingsRow.user_id);

        if (pErr) {
          console.error("[submit-order] products lookup error", pErr);
          return jsonError(500, "Falha ao validar produtos", pErr.message);
        }

        const byId = new Map((prodRows ?? []).map((p: any) => [p.id, p]));
        const items = order.items.map((i) => {
          const p = byId.get(i.productId);
          return {
            productId: i.productId,
            name: p?.name ?? i.name,
            qty: Number(i.qty),
            price: p ? Number(p.price) : Number(i.price),
            cost: p ? Number(p.cost) : 0,
          };
        });

        const itemsTotal = items.reduce((s, i) => s + i.price * i.qty, 0);
        const shipping = Number(settingsRow.delivery_fee ?? 0);
        const total = Math.round((itemsTotal + shipping) * 100) / 100;

        const { data: inserted, error: iErr } = await supabaseAdmin
          .from("orders")
          .insert({
            user_id: settingsRow.user_id,
            customer: order.customer,
            phone: order.phone,
            address: order.address ?? "",
            district: order.district ?? "",
            city: order.city ?? "",
            items: items as unknown as never,
            total,
            payment: order.payment,
            status: "aguardando",
            notes: order.notes ?? null,
            date: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (iErr || !inserted) {
          console.error("[submit-order] insert error", iErr);
          return jsonError(500, "Falha ao registrar pedido", iErr?.message);
        }

        return Response.json({ id: inserted.id });
      },
    },
  },
});
