import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Aceita IDs alfanuméricos da Kiwify; bloqueia caracteres que poderiam
// quebrar o filtro PostgREST `.or(...)` mais abaixo (vírgula, parêntese, etc).
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const kiwifyPayloadSchema = z
  .object({
    webhook_event_type: z.string().max(80).optional(),
    event: z.string().max(80).optional(),
    order_status: z.string().max(80).optional(),
    order_id: z.string().max(120).optional().nullable(),
    subscription_id: z.string().max(120).optional().nullable(),
    id: z.string().max(120).optional().nullable(),
    Product: z
      .object({ product_id: z.string().max(64).optional() })
      .passthrough()
      .optional(),
    product_id: z.string().max(64).optional().nullable(),
    product: z.object({ id: z.string().max(64).optional() }).passthrough().optional(),
    Subscription: z
      .object({
        id: z.string().max(120).optional(),
        status: z.string().max(80).optional(),
        plan: z.object({ id: z.string().max(64).optional() }).passthrough().optional(),
      })
      .passthrough()
      .optional(),
    subscription: z.object({ id: z.string().max(120).optional() }).passthrough().optional(),
    Order: z.object({ id: z.string().max(120).optional() }).passthrough().optional(),
    Customer: z
      .object({
        email: z.string().max(255).optional(),
        full_name: z.string().max(200).optional(),
        name: z.string().max(200).optional(),
        first_name: z.string().max(200).optional(),
        CPF: z.string().max(32).optional(),
        cpf: z.string().max(32).optional(),
        document: z.string().max(32).optional(),
        mobile: z.string().max(40).optional(),
        phone: z.string().max(40).optional(),
      })
      .passthrough()
      .optional(),
    customer: z.record(z.string(), z.any()).optional(),
    buyer: z.record(z.string(), z.any()).optional(),
    data: z.record(z.string(), z.any()).optional(),
  })
  .passthrough();

/**
 * Kiwify webhook endpoint.
 *
 * URL para configurar na Kiwify:
 *   https://app.zappfy.shop/api/public/kiwify-webhook?token=<KIWIFY_WEBHOOK_TOKEN>
 *
 * Eventos tratados:
 *  - order_approved / pedido_aprovado          → libera/renova acesso
 *  - subscription_renewed / assinatura_renovada → estende validade
 *  - subscription_canceled / assinatura_cancelada → marca como cancelado
 *      (acesso mantido até expires_at)
 *  - order_refunded / chargeback / pedido_reembolsado → bloqueia
 *  - subscription_late / assinatura_atrasada    → marca como vencido
 */

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function onlyDigits(s: string | undefined | null): string {
  return (s ?? "").replace(/\D+/g, "");
}

function getEventType(payload: any): string {
  return String(
    payload?.webhook_event_type ??
      payload?.event ??
      payload?.order_status ??
      payload?.Subscription?.status ??
      "",
  ).toLowerCase();
}

function getProductId(payload: any): string | null {
  return (
    payload?.Product?.product_id ??
    payload?.Product?.id ??
    payload?.product_id ??
    payload?.product?.id ??
    payload?.product?.product_id ??
    payload?.Subscription?.plan?.id ??
    payload?.data?.Product?.product_id ??
    payload?.data?.product_id ??
    payload?.data?.product?.id ??
    null
  );
}

function getProductName(payload: any): string {
  return String(
    payload?.Product?.product_name ??
      payload?.Product?.name ??
      payload?.product?.name ??
      payload?.product_name ??
      payload?.data?.Product?.product_name ??
      payload?.data?.product?.name ??
      "",
  ).toLowerCase();
}

function getCheckoutCode(payload: any): string | null {
  const raw = String(
    payload?.checkout_url ??
      payload?.checkout_link ??
      payload?.checkout?.url ??
      payload?.Product?.checkout_url ??
      payload?.data?.checkout_url ??
      payload?.data?.checkout_link ??
      "",
  ).trim();
  if (!raw) return null;
  const match = raw.match(/pay\.kiwify\.com\.br\/([A-Za-z0-9_-]{3,64})/i);
  if (match?.[1]) return match[1];
  // Kiwify também envia o código curto direto em `checkout_link` (ex.: "GBDQRTd")
  if (SAFE_ID_RE.test(raw)) return raw;
  return null;
}

function getSubscriptionFrequency(payload: any): Cycle | null {
  const freq = String(
    payload?.Subscription?.plan?.frequency ??
      payload?.subscription?.plan?.frequency ??
      payload?.data?.Subscription?.plan?.frequency ??
      "",
  ).toLowerCase();
  if (!freq) return null;
  if (/year|annual|anual/.test(freq)) return "anual";
  if (/quarter|trimestr|3.?month/.test(freq)) return "trimestral";
  if (/month|mensal/.test(freq)) return "mensal";
  return null;
}


function getPaidAmountCents(payload: any): number | null {
  const candidates = [
    payload?.Commissions?.charge_amount,
    payload?.Commissions?.product_base_price,
    payload?.order?.amount,
    payload?.order_amount,
    payload?.amount,
    payload?.price,
    payload?.data?.Commissions?.charge_amount,
    payload?.data?.amount,
  ];
  for (const value of candidates) {
    if (value === undefined || value === null || value === "") continue;
    const n = Number(String(value).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) continue;
    return n > 1000 ? Math.round(n) : Math.round(n * 100);
  }
  return null;
}

function getCustomer(payload: any): {
  email: string;
  name: string;
  cpf: string;
  phone: string;
} {
  const c =
    payload?.Customer ??
    payload?.customer ??
    payload?.buyer ??
    payload?.data?.Customer ??
    payload?.data?.customer ??
    payload?.data?.buyer ??
    {};
  return {
    email: String(c.email ?? "").trim().toLowerCase(),
    name: String(c.full_name ?? c.name ?? c.first_name ?? "Cliente Zappfy"),
    cpf: onlyDigits(c.CPF ?? c.cpf ?? c.document ?? ""),
    phone: String(c.mobile ?? c.phone ?? ""),
  };
}

function getOrderIds(payload: any): { orderId: string | null; subId: string | null } {
  return {
    orderId:
      payload?.order_id ??
      payload?.Order?.id ??
      payload?.order?.id ??
      payload?.id ??
      payload?.data?.order_id ??
      payload?.data?.Order?.id ??
      payload?.data?.id ??
      null,
    subId:
      payload?.Subscription?.id ??
      payload?.subscription_id ??
      payload?.subscription?.id ??
      payload?.data?.Subscription?.id ??
      payload?.data?.subscription_id ??
      null,
  };
}

type Cycle = "mensal" | "trimestral" | "anual" | "monthly" | "quarterly" | "yearly";

function legacyCycleFor(plan: any, productId: string): Cycle | null {
  if (plan.kiwify_product_id_monthly === productId) return "monthly";
  if (plan.kiwify_product_id_quarterly === productId) return "quarterly";
  if (plan.kiwify_product_id_yearly === productId) return "yearly";
  return null;
}

function legacyDaysFor(plan: any, cycle: Cycle): number {
  if (cycle === "monthly") return plan.duration_days_monthly ?? 30;
  if (cycle === "quarterly") return plan.duration_days_quarterly ?? 90;
  return plan.duration_days_yearly ?? 365;
}

function centsFromPlanValue(value: unknown): number | null {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
}

function cycleFromText(text: string): Cycle | null {
  if (/anual|annual|year|ano/.test(text)) return "anual";
  if (/trimestral|quarter|trimestre|3\s*mes/.test(text)) return "trimestral";
  if (/mensal|monthly|m[eê]s/.test(text)) return "mensal";
  return null;
}

async function ensureClientScaffold(supabaseAdmin: any, userId: string, name: string, phone: string) {
  await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, full_name: name }, { onConflict: "id" });

  await supabaseAdmin
    .from("settings")
    .upsert(
      { user_id: userId, store_name: name ? `Loja ${name}` : "Minha Loja", whatsapp: phone || "" },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "cliente" }, { onConflict: "user_id,role" });

  await supabaseAdmin.rpc("apply_tracking_default_for_user", { _user_id: userId });
}

export const Route = createFileRoute("/api/public/kiwify-webhook")({
  server: {
    handlers: {
      GET: async () =>
        json(200, { ok: true, message: "Kiwify webhook endpoint ativo" }),

      POST: async ({ request }) => {
        const url = new URL(request.url);
        const tokenParam =
          url.searchParams.get("token") ??
          request.headers.get("x-kiwify-token") ??
          "";
        const expected = process.env.KIWIFY_WEBHOOK_TOKEN ?? "";

        if (!expected || tokenParam !== expected) {
          console.warn("[kiwify-webhook] token inválido");
          return json(401, { error: "Token inválido" });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return json(400, { error: "JSON inválido" });
        }

        const parsedPayload = kiwifyPayloadSchema.safeParse(payload);
        if (!parsedPayload.success) {
          console.warn("[kiwify-webhook] payload inválido", parsedPayload.error.flatten());
          return json(400, { error: "Payload inválido" });
        }
        payload = parsedPayload.data;

        const eventType = getEventType(payload);
        const rawProductId = getProductId(payload);
        const productId = rawProductId && SAFE_ID_RE.test(rawProductId) ? rawProductId : null;
        const checkoutCode = getCheckoutCode(payload);
        const productName = getProductName(payload);
        const paidAmountCents = getPaidAmountCents(payload);
        const { email: rawEmail, name: rawName, cpf, phone: rawPhone } = getCustomer(payload);
        const emailParsed = z.string().email().max(255).safeParse(rawEmail);
        const email = emailParsed.success ? emailParsed.data.toLowerCase() : "";
        const name = rawName.slice(0, 200);
        const phone = rawPhone.slice(0, 40);
        const { orderId, subId } = getOrderIds(payload);

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const logBase = {
          event_type: eventType,
          order_id: orderId,
          subscription_id: subId,
          customer_email: email,
          product_id: productId,
          payload,
        };

        async function log(status: string, error_message?: string) {
          try {
            await supabaseAdmin
              .from("kiwify_webhook_logs")
              .insert({ ...logBase, status, error_message: error_message ?? null });
          } catch (e) {
            console.error("[kiwify-webhook] falha ao gravar log", e);
          }
        }

        try {
          if (!email) {
            await log("error", "Sem e-mail no payload");
            return json(400, { error: "E-mail do cliente ausente" });
          }

          // Eventos de aprovação/renovação
          const isApproval =
            /approved|paid|aprovad|renew|renovad|completed|active/.test(eventType);
          // Eventos de cancelamento (acesso mantido até expirar)
          const isCancel = /cancel|cancelad/.test(eventType);
          // Eventos que bloqueiam imediatamente
          const isBlock = /refund|chargeback|reembols|estornad/.test(eventType);
          // Atraso
          const isLate = /late|atras|overdue/.test(eventType);

          // 1) Localiza/cria usuário pelo e-mail
          let userId: string | null = null;
          {
            const { data: list } = await supabaseAdmin.auth.admin.listUsers({
              page: 1,
              perPage: 200,
            });
            const found = list.users.find(
              (u) => (u.email ?? "").toLowerCase() === email,
            );
            if (found) userId = found.id;
          }

          if (!userId && isApproval) {
            // Senha inicial = CPF (somente dígitos). Se não vier CPF, gera senha aleatória forte.
            let password: string;
            if (cpf && cpf.length >= 8) {
              password = cpf;
            } else {
              const randomBytes = new Uint8Array(24);
              crypto.getRandomValues(randomBytes);
              password = btoa(String.fromCharCode(...randomBytes))
                .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") + "Aa1!";
            }
            const { data: created, error: createErr } =
              await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { name, phone, cpf, source: "kiwify" },
              });

            if (createErr || !created.user) {
              await log("error", `Falha ao criar usuário: ${createErr?.message}`);
              return json(500, { error: "Falha ao criar usuário" });
            }
            userId = created.user.id;
          }

          if (!userId) {
            // cancelamento de cliente que nunca existiu — apenas loga
            await log("ignored", "Usuário não encontrado e evento não é aprovação");
            return json(200, { ok: true, ignored: true });
          }

          await ensureClientScaffold(supabaseAdmin, userId, name, phone);

          // 2) Resolve plano + ciclo
          //    Ordem de prioridade (mais confiável → menos confiável):
          //    a) Subscription.plan.frequency  (Kiwify diz exatamente o ciclo)
          //    b) checkout_link / código curto do checkout
          //    c) kiwify_product_id direto
          //    d) nome do produto
          //    e) valor pago
          let plan: any = null;
          let cycle: Cycle | null = null;

          const subFrequency = getSubscriptionFrequency(payload);
          if (subFrequency) {
            const { data: freqPlan } = await supabaseAdmin
              .from("plans")
              .select("*")
              .eq("billing_cycle", subFrequency)
              .eq("is_active", true)
              .order("sort_order", { ascending: true })
              .limit(1)
              .maybeSingle();
            if (freqPlan) {
              plan = freqPlan;
              cycle = subFrequency;
            }
          }

          if (!plan && checkoutCode) {
            const { data: checkoutPlan } = await supabaseAdmin
              .from("plans")
              .select("*")
              .eq("kiwify_product_id", checkoutCode)
              .maybeSingle();
            if (checkoutPlan) {
              plan = checkoutPlan;
              cycle = (checkoutPlan.billing_cycle as Cycle) ?? "mensal";
            }
          }

          if (!plan && productId) {
            const { data: directPlan } = await supabaseAdmin
              .from("plans")
              .select("*")
              .eq("kiwify_product_id", productId)
              .maybeSingle();
            if (directPlan) {
              plan = directPlan;
              cycle = (directPlan.billing_cycle as Cycle) ?? "mensal";
            } else {
              const { data: plans } = await supabaseAdmin
                .from("plans")
                .select("*")
                .or(
                  `kiwify_product_id_monthly.eq.${productId},kiwify_product_id_quarterly.eq.${productId},kiwify_product_id_yearly.eq.${productId}`,
                );
              for (const p of plans ?? []) {
                const c = legacyCycleFor(p, productId);
                if (c) {
                  plan = p;
                  cycle = c;
                  break;
                }
              }
            }
          }



          if (!plan) {
            const inferredCycle = cycleFromText(productName);
            if (inferredCycle) {
              const { data: cyclePlan } = await supabaseAdmin
                .from("plans")
                .select("*")
                .eq("billing_cycle", inferredCycle)
                .eq("is_active", true)
                .order("sort_order", { ascending: true })
                .limit(1)
                .maybeSingle();
              if (cyclePlan) {
                plan = cyclePlan;
                cycle = inferredCycle;
              }
            }
          }

          if (!plan && paidAmountCents) {
            const { data: plansByPrice } = await supabaseAdmin
              .from("plans")
              .select("*")
              .eq("is_active", true)
              .order("sort_order", { ascending: true });
            const pricePlan = (plansByPrice ?? []).find((p: any) => {
              const values = [p.price, p.price_monthly, p.price_quarterly, p.price_yearly]
                .map(centsFromPlanValue)
                .filter((v: number | null): v is number => v !== null);
              return values.some((v: number) => Math.abs(v - paidAmountCents) <= 2);
            });
            if (pricePlan) {
              plan = pricePlan;
              cycle = (pricePlan.billing_cycle as Cycle) ?? "mensal";
            }
          }

          // 3) Busca assinatura existente do usuário
          const { data: existingSub } = await supabaseAdmin
            .from("subscriptions")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // ===== APROVAÇÃO / RENOVAÇÃO =====
          if (isApproval) {
            if (!plan || !cycle) {
              await log(
                "error",
                `Plano não mapeado. product_id=${productId ?? "—"}; checkout=${checkoutCode ?? "—"}; produto=${productName || "—"}; valor_centavos=${paidAmountCents ?? "—"}. Configure em Admin → Planos.`,
              );
              return json(200, {
                ok: false,
                warning: "Plano Kiwify não mapeado",
              });
            }

            const days = plan.duration_days ?? legacyDaysFor(plan, cycle!);
            const now = new Date();
            // Renovação estende a partir do maior entre hoje e expires_at atual
            const base =
              existingSub?.expires_at && new Date(existingSub.expires_at) > now
                ? new Date(existingSub.expires_at)
                : now;
            const newExpires = new Date(base.getTime() + days * 86400_000);

            const payloadSub = {
              user_id: userId,
              plan_id: plan.id,
              status: "ativo" as const,
              billing_cycle: cycle,
              started_at: existingSub?.started_at ?? now.toISOString(),
              expires_at: newExpires.toISOString(),
              last_payment_at: now.toISOString(),
              kiwify_subscription_id: subId,
              kiwify_order_id: orderId,
              kiwify_customer_email: email,
            };

            if (existingSub) {
              await supabaseAdmin
                .from("subscriptions")
                .update(payloadSub)
                .eq("id", existingSub.id);
            } else {
              await supabaseAdmin.from("subscriptions").insert(payloadSub);
            }

            await supabaseAdmin.from("access_logs").insert({
              user_id: userId,
              event: "kiwify_access_granted",
              metadata: { event: eventType, days, cycle, order_id: orderId },
            });

            await log("processed");
            return json(200, { ok: true, action: "granted", expires_at: newExpires });
          }

          // ===== CANCELAMENTO (mantém acesso até expirar) =====
          if (isCancel && existingSub) {
            // Mantém status "ativo" até expires_at — a gate bloqueia automaticamente
            // quando vencer. Marcamos no campo notes para rastreio.
            await supabaseAdmin
              .from("subscriptions")
              .update({
                notes: `[kiwify] assinatura cancelada em ${new Date().toISOString()} — acesso mantido até ${existingSub.expires_at ?? "—"}`,
              })
              .eq("id", existingSub.id);
            await supabaseAdmin.from("access_logs").insert({
              user_id: userId,
              event: "kiwify_canceled",
              metadata: { event: eventType, order_id: orderId },
            });
            await log("processed");
            return json(200, { ok: true, action: "canceled" });
          }

          // ===== BLOQUEIO IMEDIATO =====
          if (isBlock && existingSub) {
            await supabaseAdmin
              .from("subscriptions")
              .update({ status: "bloqueado", expires_at: new Date().toISOString() })
              .eq("id", existingSub.id);
            await supabaseAdmin.from("access_logs").insert({
              user_id: userId,
              event: "kiwify_blocked",
              metadata: { event: eventType, order_id: orderId },
            });
            await log("processed");
            return json(200, { ok: true, action: "blocked" });
          }

          // ===== ATRASADO =====
          if (isLate && existingSub) {
            await supabaseAdmin
              .from("subscriptions")
              .update({ status: "vencido" })
              .eq("id", existingSub.id);
            await log("processed");
            return json(200, { ok: true, action: "late" });
          }

          await log("ignored", `Evento não tratado: ${eventType}`);
          return json(200, { ok: true, ignored: true, event: eventType });
        } catch (e: any) {
          console.error("[kiwify-webhook] erro", e);
          await log("error", e?.message ?? String(e));
          return json(500, { error: e?.message ?? "Erro interno" });
        }
      },
    },
  },
});
