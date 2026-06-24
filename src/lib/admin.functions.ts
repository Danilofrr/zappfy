import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getOfficialPublicBaseUrl } from "@/lib/public-url";

async function ensureAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Falha ao verificar permissões");
  if (!data) throw new Error("Acesso negado");
}

// ===== Acesso do usuário (role + status) =====
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context as any;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, expires_at, plan_id, plans(name)")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      userId,
      email: (claims?.email as string) ?? null,
      isAdmin,
      subscription: sub
        ? {
            status: sub.status as string,
            expiresAt: sub.expires_at as string | null,
            planName: (sub as any).plans?.name ?? null,
          }
        : null,
    };
  });

// ===== Dashboard admin =====
// Usa a MESMA fonte de dados da página de Clientes (RPC admin_list_clients)
// para garantir que os números batam com a lista exibida.
export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const t0 = Date.now();
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);

    const { data, error } = await supabase.rpc("admin_list_clients");
    if (error) throw new Error(error.message);
    const rows: any[] = data ?? [];

    const now = new Date();
    const in7 = new Date();
    in7.setDate(in7.getDate() + 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const norm = (s: any) => String(s ?? "").trim().toLowerCase();
    const ATIVO = new Set(["ativo", "active"]);
    const TESTE = new Set(["teste", "teste grátis", "teste gratis", "trial", "free_trial"]);
    const PENDENTE = new Set(["pendente", "pending"]);
    const BLOQUEADO = new Set(["bloqueado", "blocked"]);

    let total = 0,
      ativos = 0,
      teste = 0,
      pendentes = 0,
      vencidos = 0,
      bloqueados = 0,
      novosMes = 0,
      proximosVencer = 0,
      mrr = 0;

    for (const r of rows) {
      total++;
      const status = norm(r.sub_status);
      const exp = r.sub_expires_at ? new Date(r.sub_expires_at) : null;
      const created = r.created_at ? new Date(r.created_at) : null;
      const isBlocked = BLOQUEADO.has(status);
      const hasFutureExp = exp && exp.getTime() >= now.getTime();
      const isActive =
        ATIVO.has(status) || (!isBlocked && hasFutureExp && (r.plan_id || r.plan_name));

      if (isActive) ativos++;
      if (TESTE.has(status)) teste++;
      if (PENDENTE.has(status)) pendentes++;
      if (isBlocked) bloqueados++;
      if (exp && exp.getTime() < now.getTime() && !isBlocked) vencidos++;
      if (created && created >= startOfMonth) novosMes++;
      if (exp && exp >= now && exp <= in7) proximosVencer++;
      if (isActive) mrr += Number(r.price_monthly ?? 0);
    }

    const arr = mrr * 12;
    // eslint-disable-next-line no-console
    console.log(`[admin-dashboard] ${rows.length} clientes em ${Date.now() - t0}ms — ativos=${ativos} vencidos=${vencidos} MRR=${mrr}`);

    return { total, ativos, teste, vencidos, bloqueados, pendentes, mrr, arr, novosMes, proximosVencer };
  });

// ===== Clientes =====
export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { data, error } = await supabase.rpc("admin_list_clients");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name ?? "",
      storeName: r.store_name ?? "",
      whatsapp: r.whatsapp ?? "",
      createdAt: r.created_at,
      lastSignInAt: r.last_sign_in_at,
      roles: r.roles ?? [],
      subscription: r.sub_status
        ? {
            status: r.sub_status,
            expiresAt: r.sub_expires_at,
            startedAt: r.sub_started_at,
            planId: r.plan_id,
            planName: r.plan_name ?? null,
            priceMonthly: Number(r.price_monthly ?? 0),
          }
        : null,
    }));
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; fullName: string; storeName: string; whatsapp: string; planId?: string; trialDays?: number }) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().min(1),
        storeName: z.string().min(1),
        whatsapp: z.string().default(""),
        planId: z.string().uuid().optional(),
        trialDays: z.number().int().min(0).max(365).default(7),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, store_name: data.storeName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");
    const newUserId = created.user.id;
    await supabaseAdmin.from("settings").upsert({ user_id: newUserId, store_name: data.storeName, whatsapp: data.whatsapp });
    await supabaseAdmin.from("user_roles").upsert({ user_id: newUserId, role: "cliente" });
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + (data.trialDays ?? 7));
    await supabaseAdmin.from("subscriptions").upsert({
      user_id: newUserId,
      plan_id: data.planId ?? null,
      status: "teste",
      trial_ends_at: trialEnd.toISOString(),
      expires_at: trialEnd.toISOString(),
    });
    // Gerar token de ativação
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenExpire = new Date();
    tokenExpire.setDate(tokenExpire.getDate() + 7);
    await supabaseAdmin.from("activation_tokens").insert({
      user_id: newUserId,
      token,
      expires_at: tokenExpire.toISOString(),
    });
    return { id: newUserId, activationToken: token };
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; fullName?: string; storeName?: string; whatsapp?: string }) =>
    z.object({ userId: z.string().uuid(), fullName: z.string().optional(), storeName: z.string().optional(), whatsapp: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.fullName !== undefined) await supabaseAdmin.from("profiles").update({ full_name: data.fullName }).eq("id", data.userId);
    if (data.storeName !== undefined || data.whatsapp !== undefined) {
      const patch: any = {};
      if (data.storeName !== undefined) patch.store_name = data.storeName;
      if (data.whatsapp !== undefined) patch.whatsapp = data.whatsapp;
      await supabaseAdmin.from("settings").update(patch).eq("user_id", data.userId);
    }
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    if (data.userId === userId) throw new Error("Você não pode excluir a si mesmo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setSubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; status: string }) =>
    z.object({ userId: z.string().uuid(), status: z.enum(["ativo", "teste", "pendente", "vencido", "bloqueado"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("subscriptions").update({ status: data.status }).eq("user_id", data.userId);
    return { ok: true };
  });

export const renewSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; days: number }) =>
    z.object({ userId: z.string().uuid(), days: z.number().int().min(1).max(3650) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("subscriptions").select("expires_at").eq("user_id", data.userId).maybeSingle();
    const base = cur?.expires_at && new Date(cur.expires_at) > new Date() ? new Date(cur.expires_at) : new Date();
    base.setDate(base.getDate() + data.days);
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "ativo", expires_at: base.toISOString(), last_payment_at: new Date().toISOString() })
      .eq("user_id", data.userId);
    return { ok: true };
  });

export const changeClientPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; planId: string }) =>
    z.object({ userId: z.string().uuid(), planId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("subscriptions").update({ plan_id: data.planId }).eq("user_id", data.userId);
    return { ok: true };
  });

export const addTrialDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; days: number }) =>
    z.object({ userId: z.string().uuid(), days: z.number().int().min(1).max(365) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cur } = await supabaseAdmin.from("subscriptions").select("expires_at, trial_ends_at").eq("user_id", data.userId).maybeSingle();
    const base = cur?.expires_at && new Date(cur.expires_at) > new Date() ? new Date(cur.expires_at) : new Date();
    base.setDate(base.getDate() + data.days);
    await supabaseAdmin
      .from("subscriptions")
      .update({ expires_at: base.toISOString(), trial_ends_at: base.toISOString(), status: "teste" })
      .eq("user_id", data.userId);
    return { ok: true };
  });

export const generateActivationToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const exp = new Date();
    exp.setDate(exp.getDate() + 7);
    await supabaseAdmin.from("activation_tokens").insert({ user_id: data.userId, token, expires_at: exp.toISOString() });
    return { token };
  });

// ===== Senha do cliente =====
const ALLOWED_REDIRECT_HOSTS = new Set([
  "zappfy.lovable.app",
  "localhost",
  "127.0.0.1",
]);
function assertSafeRedirect(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const ok =
      ALLOWED_REDIRECT_HOSTS.has(host) ||
      host.endsWith(".lovable.app") ||
      host.endsWith(".lovable.dev");
    if (!ok) throw new Error("Redirect não permitido");
    return u.toString();
  } catch {
    throw new Error("Redirect inválido");
  }
}

export const setClientPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; password: string }) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendClientPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; redirectTo?: string }) =>
    z.object({ userId: z.string().uuid(), redirectTo: z.string().url().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: ue } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (ue || !u?.user?.email) throw new Error(ue?.message ?? "Cliente sem e-mail");
    const safeRedirect = assertSafeRedirect(data.redirectTo);
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: u.user.email,
      options: { redirectTo: safeRedirect },
    });
    if (error) throw new Error(error.message);
    return { email: u.user.email, link: link?.properties?.action_link ?? null };
  });

// ===== Planos =====
export const listPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data } = await supabase.from("plans").select("*").order("sort_order");
    return data ?? [];
  });

export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        description: z.string().default(""),
        billing_cycle: z.enum(["mensal", "trimestral", "anual"]).default("mensal"),
        price: z.number().min(0).default(0),
        duration_days: z.number().int().min(1).default(30),
        kiwify_product_id: z.string().trim().optional().nullable(),
        // legacy fields kept optional for backward compat
        price_monthly: z.number().min(0).optional(),
        price_quarterly: z.number().min(0).optional(),
        price_yearly: z.number().min(0).optional(),
        kiwify_product_id_monthly: z.string().trim().optional().nullable(),
        kiwify_product_id_quarterly: z.string().trim().optional().nullable(),
        kiwify_product_id_yearly: z.string().trim().optional().nullable(),
        features: z.array(z.string()).default([]),
        is_active: z.boolean().default(true),
        sort_order: z.number().int().default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) {
      await supabaseAdmin.from("plans").update(data).eq("id", data.id);
    } else {
      await supabaseAdmin.from("plans").insert(data);
    }
    return { ok: true };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("plans").delete().eq("id", data.id);
    return { ok: true };
  });

// ===== Pagamentos =====
export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const t0 = Date.now();
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);

    const { data: payments, error: payErr } = await supabase
      .from("subscription_payments")
      .select("id, subscription_id, user_id, amount, method, status, due_at, paid_at, notes, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (payErr) {
      console.error("[listPayments] subscription_payments error", payErr);
      throw new Error(payErr.message);
    }
    const rows = payments ?? [];
    if (rows.length === 0) {
      console.log("[listPayments] empty in", Date.now() - t0, "ms");
      return [];
    }

    const subIds = Array.from(new Set(rows.map((p: any) => p.subscription_id).filter(Boolean)));
    const [clientsRes, subsRes] = await Promise.all([
      supabase.rpc("admin_list_clients"),
      subIds.length
        ? supabase.from("subscriptions").select("id, plan_id, expires_at, plans(name)").in("id", subIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const nameMap = new Map<string, string>();
    const storeMap = new Map<string, string>();
    for (const c of (clientsRes.data ?? []) as any[]) {
      nameMap.set(c.id, c.full_name ?? "");
      storeMap.set(c.id, c.store_name ?? "");
    }
    const subMap = new Map((subsRes.data ?? []).map((s: any) => [s.id, s]));

    const out = rows.map((p: any) => {
      const sub = subMap.get(p.subscription_id) as any;
      return {
        ...p,
        fullName: nameMap.get(p.user_id) ?? "",
        storeName: storeMap.get(p.user_id) ?? "",
        planName: sub?.plans?.name ?? "",
        expiresAt: sub?.expires_at ?? null,
      };
    });
    console.log("[listPayments]", out.length, "rows in", Date.now() - t0, "ms");
    return out;
  });

export const registerPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    z
      .object({
        userId: z.string().uuid(),
        amount: z.number().min(0),
        method: z.string().default("manual"),
        status: z.enum(["pago", "pendente", "vencido", "cancelado"]).default("pago"),
        notes: z.string().default(""),
        renewDays: z.number().int().min(0).default(30),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { data: sub, error: subErr } = await supabase
      .from("subscriptions")
      .select("id, expires_at")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (subErr) throw new Error(subErr.message);
    if (!sub) throw new Error("Cliente sem assinatura");
    const { error: insErr } = await supabase.from("subscription_payments").insert({
      subscription_id: sub.id,
      user_id: data.userId,
      amount: data.amount,
      method: data.method,
      status: data.status,
      paid_at: data.status === "pago" ? new Date().toISOString() : null,
      notes: data.notes,
    });
    if (insErr) throw new Error(insErr.message);
    if (data.status === "pago" && data.renewDays > 0) {
      const base = sub.expires_at && new Date(sub.expires_at) > new Date() ? new Date(sub.expires_at) : new Date();
      base.setDate(base.getDate() + data.renewDays);
      const { error: updErr } = await supabase
        .from("subscriptions")
        .update({ status: "ativo", expires_at: base.toISOString(), last_payment_at: new Date().toISOString() })
        .eq("id", sub.id);
      if (updErr) throw new Error(updErr.message);
    }
    return { ok: true };
  });


// ===== Cupons =====
export const listCoupons = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

export const saveCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) =>
    z
      .object({
        id: z.string().uuid().optional(),
        code: z.string().min(1),
        discount_type: z.enum(["percent", "fixed"]).default("percent"),
        discount_value: z.number().min(0),
        max_uses: z.number().int().min(0).optional().nullable(),
        valid_until: z.string().optional().nullable(),
        is_active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.id) await supabaseAdmin.from("coupons").update(data).eq("id", data.id);
    else await supabaseAdmin.from("coupons").insert(data);
    return { ok: true };
  });

export const deleteCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("coupons").delete().eq("id", data.id);
    return { ok: true };
  });

// ===== Logs =====
export const listAccessLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { data } = await supabase.from("access_logs").select("*").order("created_at", { ascending: false }).limit(200);
    return data ?? [];
  });

// ===== Minha assinatura (cliente) =====
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*, plans(name, description, price_monthly)")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: payments } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { subscription: sub, payments: payments ?? [] };
  });

// ===== Configurações do sistema =====
export const getSystemSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const { data } = await supabase.from("admin_settings").select("value").eq("key", "system").maybeSingle();
    return (data?.value as Record<string, any>) ?? {};
  });

export const saveSystemSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => z.object({ value: z.record(z.string(), z.any()) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await ensureAdmin(supabase, userId);
    const value = {
      ...data.value,
      platform: {
        ...(data.value.platform ?? {}),
        url: getOfficialPublicBaseUrl((data.value.platform as any)?.url),
      },
    };
    const { error } = await supabase
      .from("admin_settings")
      .upsert({ key: "system", value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ===== Suporte público (sem auth) — usado na tela de login =====
export const getPublicSupport = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const supabasePublic = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data } = await supabasePublic
    .from("admin_settings")
    .select("value")
    .eq("key", "system")
    .maybeSingle();
  const v = (data?.value as any) ?? {};
  return {
    whats: (v?.platform?.supportWhats as string | undefined) ?? null,
    email: (v?.platform?.supportEmail as string | undefined) ?? null,
    officialUrl: getOfficialPublicBaseUrl(v?.platform?.url as string | undefined),
    enabled: v?.platform?.supportWhatsEnabled !== false,
    dashboardEnabled: v?.platform?.supportWhatsDashboardEnabled === true,
  };
});

// ===== Favicons públicas (sem auth) — usadas pelos PWAs =====
export const getPublicFavicons = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const supabasePublic = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data } = await supabasePublic
    .from("admin_settings")
    .select("value")
    .eq("key", "system")
    .maybeSingle();
  const a = ((data?.value as any) ?? {})?.appearance ?? {};
  return {
    dashboard: (a?.dashboardFaviconUrl as string | undefined) ?? null,
    entregas: (a?.entregasFaviconUrl as string | undefined) ?? null,
  };
});

// ===== Marca pública (sem auth) — logo da plataforma =====
export const getPublicPlatformBrand = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const supabasePublic = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data } = await supabasePublic
    .from("admin_settings")
    .select("value")
    .eq("key", "system")
    .maybeSingle();
  const v = (data?.value as any) ?? {};
  return {
    logoUrl: (v?.platform?.logoUrl as string | undefined) ?? null,
    sidebarLogo: (v?.appearance?.sidebarLogo as string | undefined) ?? null,
    brandName: (v?.appearance?.brandName as string | undefined) ?? "ZappFy",
  };
});
