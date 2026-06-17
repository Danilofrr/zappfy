import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const num = z.preprocess(
  (v) => (v === null || v === undefined || v === "" ? 0 : v),
  z.coerce.number(),
);

const itemSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().optional().default(""),
  qty: z.coerce.number().int().positive(),
  price: num.refine((n) => n >= 0, "Valor unitário inválido"),
  cost: num.refine((n) => n >= 0, "Custo inválido"),
});

const submitSchema = z.object({
  slug: z.string().min(1).max(120),
  order: z.object({
    customer: z.string().min(1, "Nome do cliente não preenchido").max(200),
    phone: z.string().min(1, "WhatsApp inválido").max(40),
    cep: z.string().max(20).optional().default(""),
    address: z.string().min(1, "Endereço não preenchido").max(400),
    reference: z.string().max(400).optional().default(""),
    district: z.string().max(200).optional().default(""),
    city: z.string().max(200).optional().default(""),
    items: z.array(itemSchema).min(1, "Produto inválido"),
    shipping: num.optional(),
    total: num.optional(),
    payment: z.enum(["pix", "cartao", "dinheiro"], {
      errorMap: () => ({ message: "Forma de pagamento não selecionada" }),
    }),
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
        } catch (e) {
          console.error("[submit-order] invalid JSON body", e);
          return jsonError(400, "JSON inválido no corpo da requisição");
        }

        console.log("[submit-order] payload recebido:", JSON.stringify(raw));

        const parsed = submitSchema.safeParse(raw);
        if (!parsed.success) {
          const first = parsed.error.issues[0];
          const fieldMap: Record<string, string> = {
            "order.customer": "Nome do cliente",
            "order.phone": "WhatsApp",
            "order.address": "Endereço",
            "order.cep": "CEP",
            "order.payment": "Forma de pagamento",
            "order.items": "Produto",
            "order.total": "Valor total",
            "order.shipping": "Valor de entrega",
            "slug": "Loja",
          };
          const path = first?.path.join(".") ?? "campo";
          const label = fieldMap[path] || path;
          const msg = `Campo inválido: ${label} — ${first?.message ?? "valor inválido"}`;
          console.error("[submit-order] validation failed", { path, message: first?.message, issues: parsed.error.issues });
          return jsonError(400, msg, parsed.error.flatten());
        }

        const { slug, order } = parsed.data;
        const item = order.items[0];

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          console.error("[submit-order] missing supabase env", {
            hasUrl: !!SUPABASE_URL,
            hasKey: !!SUPABASE_PUBLISHABLE_KEY,
          });
          return jsonError(500, "Servidor sem credenciais do Supabase configuradas");
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        const rpcArgs = {
          _slug: slug,
          _customer: order.customer,
          _phone: order.phone,
          _cep: order.cep ?? "",
          _address: order.address,
          _reference: order.reference ?? "",
          _district: order.district ?? "",
          _city: order.city ?? "",
          _product_id: item.productId,
          _quantity: Number(item.qty),
          _unit_price: Number(item.price),
          _shipping_value: Number(order.shipping ?? 0),
          _total: Number(order.total ?? 0),
          _payment: order.payment,
          _notes: order.notes ?? "",
        };

        console.log("[submit-order] chamando submit_public_order:", rpcArgs);

        const { data, error } = await (supabase as any).rpc("submit_public_order", rpcArgs);

        if (error) {
          console.error("[submit-order] supabase rpc error", error);
          return jsonError(400, error.message || "Falha ao registrar pedido", error);
        }

        console.log("[submit-order] pedido criado:", data);
        return Response.json({ id: data });
      },
    },
  },
});
