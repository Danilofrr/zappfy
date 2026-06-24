import { createFileRoute } from "@tanstack/react-router";

/**
 * Kiwify webhook endpoint.
 *
 * URL para configurar na Kiwify:
 *   https://zappfy.lovable.app/api/public/kiwify-webhook?token=<KIWIFY_WEBHOOK_TOKEN>
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
    payload?.product_id ??
    payload?.product?.id ??
    payload?.Subscription?.plan?.id ??
    null
  );
}

function getCustomer(payload: any): {
  email: string;
  name: string;
  cpf: string;
  phone: string;
} {
  const c = payload?.Customer ?? payload?.customer ?? payload?.buyer ?? {};
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
      payload?.id ??
      null,
    subId:
      payload?.Subscription?.id ??
      payload?.subscription_id ??
      payload?.subscription?.id ??
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

        const eventType = getEventType(payload);
        const productId = getProductId(payload);
        const { email, name, cpf, phone } = getCustomer(payload);
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
            const password = cpf && cpf.length >= 6 ? cpf : `zappfy${Date.now()}`;
            const { data: created, error: createErr } =
              await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { name, phone, source: "kiwify" },
              });
            if (createErr || !created.user) {
              await log("error", `Falha ao criar usuário: ${createErr?.message}`);
              return json(500, { error: "Falha ao criar usuário" });
            }
            userId = created.user.id;

            // cria profile básico
            await supabaseAdmin
              .from("profiles")
              .upsert({ id: userId, full_name: name }, { onConflict: "id" });
          }

          if (!userId) {
            // cancelamento de cliente que nunca existiu — apenas loga
            await log("ignored", "Usuário não encontrado e evento não é aprovação");
            return json(200, { ok: true, ignored: true });
          }

          // 2) Resolve plano + ciclo pelo product_id
          let plan: any = null;
          let cycle: Cycle | null = null;

          if (productId) {
            // 1) Tenta o novo modelo: 1 plano = 1 ciclo + 1 kiwify_product_id
            const { data: directPlan } = await supabaseAdmin
              .from("plans")
              .select("*")
              .eq("kiwify_product_id", productId)
              .maybeSingle();
            if (directPlan) {
              plan = directPlan;
              cycle = (directPlan.billing_cycle as Cycle) ?? "mensal";
            } else {
              // 2) Fallback: modelo antigo (3 IDs em um único plano)
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
                `Plano não mapeado para product_id ${productId}. Configure em Admin → Planos.`,
              );
              return json(200, {
                ok: false,
                warning: "Plano Kiwify não mapeado",
              });
            }

            const days = daysFor(plan, cycle);
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
