import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const orderItemSchema = z.object({
  productId: z.string(),
  name: z.string(),
  qty: z.number().int().positive(),
  price: z.number().nonnegative(),
  cost: z.number().nonnegative(),
});

const paymentSchema = z.enum(["pix", "cartao", "dinheiro"]);

const submitSchema = z.object({
  slug: z.string().min(1).max(120),
  order: z.object({
    customer: z.string().min(1).max(200),
    phone: z.string().min(1).max(40),
    address: z.string().max(400).optional().default(""),
    district: z.string().max(200).optional().default(""),
    city: z.string().max(200).optional().default(""),
    items: z.array(orderItemSchema).min(1),
    total: z.number().nonnegative(),
    payment: paymentSchema,
    notes: z.string().max(2000).optional().default(""),
  }),
});

export const submitPublicOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const slug = data.slug.toLowerCase().trim();
    const { data: settingsRow, error: sErr } = await supabaseAdmin
      .from("settings")
      .select("user_id")
      .ilike("slug", slug)
      .maybeSingle();

    if (sErr) throw new Error("Falha ao localizar loja");
    if (!settingsRow?.user_id) throw new Error("Loja não encontrada");

    const o = data.order;

    // Re-fetch authoritative product cost/price server-side so clients can't tamper with margin.
    const productIds = o.items.map((i) => i.productId);
    const { data: prodRows } = await supabaseAdmin
      .from("products")
      .select("id, name, price, cost")
      .in("id", productIds)
      .eq("user_id", settingsRow.user_id);
    const byId = new Map((prodRows ?? []).map((p: any) => [p.id, p]));
    const items = o.items.map((i) => {
      const p = byId.get(i.productId);
      return {
        productId: i.productId,
        name: p?.name ?? i.name,
        qty: i.qty,
        price: p ? Number(p.price) : i.price,
        cost: p ? Number(p.cost) : 0,
      };
    });

    const { data: inserted, error: iErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: settingsRow.user_id,
        customer: o.customer,
        phone: o.phone,
        address: o.address ?? "",
        district: o.district ?? "",
        city: o.city ?? "",
        items: items as unknown as never,
        total: o.total,
        payment: o.payment,
        status: "aguardando",
        notes: o.notes ?? null,
        date: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (iErr || !inserted) throw new Error("Falha ao registrar pedido");
    return { id: inserted.id };
  });
