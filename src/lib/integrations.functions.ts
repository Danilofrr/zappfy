import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GRAPH_VERSION = "v21.0";
const META_ACCOUNT_FIELDS = "name,account_id,account_status,currency,timezone_name";
const META_INSIGHTS_FIELDS = "spend,impressions,clicks,date_start,date_stop";

function normalizeAdAccountId(value: string) {
  const raw = String(value ?? "").trim().replace(/^['"]|['"]$/g, "");
  const withoutPrefix = raw.replace(/^act_/i, "");
  const digits = withoutPrefix.replace(/\D/g, "");
  return digits ? `act_${digits}` : "";
}

function sanitizeAccessToken(value: string | null | undefined) {
  let token = String(value ?? "").trim();
  token = token.replace(/^['"]|['"]$/g, "").trim();
  token = token.replace(/^Bearer\s+/i, "").trim();
  token = token.replace(/[\r\n\t ]+/g, "");
  token = token.replace(/^['"]|['"]$/g, "").trim();
  return token;
}

function isMaskedToken(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return false;
  if (/^(•|\*|x|X|\.){4,}$/u.test(raw.replace(/\s+/g, ""))) return true;
  return raw.toLowerCase().includes("token já cadastrado") || raw.toLowerCase().includes("token salvo");
}

function safeMetaLog(label: string, params: { url: string; adAccountId?: string; token: string; status?: number }) {
  try {
    const parsed = new URL(params.url);
    const token = sanitizeAccessToken(params.token);
    console.log(label, {
      endpoint: parsed.pathname,
      fields: parsed.searchParams.get("fields") ?? null,
      datePreset: parsed.searchParams.get("date_preset") ?? null,
      adAccountId: params.adAccountId ?? null,
      tokenExists: token.length > 0,
      tokenLength: token.length,
      tokenLast4: token ? token.slice(-4) : null,
      metaStatus: params.status ?? null,
    });
  } catch {
    console.log(label, { endpoint: "unknown", adAccountId: params.adAccountId ?? null, metaStatus: params.status ?? null });
  }
}

// Chama a Graph API enviando o token no corpo (POST form) com method=GET.
// Esse formato é o mais compatível: evita "API access blocked" de WAF que
// filtra `access_token=` na URL e também o erro "Access token could not be
// decrypted" que ocorre quando a Meta recebe Authorization: Bearer em
// alguns tokens de Usuário do Sistema.
async function fbFetch(url: string, token: string) {
  const cleanToken = sanitizeAccessToken(token);
  const body = new URLSearchParams();
  body.set("access_token", cleanToken);
  body.set("method", "GET");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  const json: any = await res.json().catch(() => ({}));
  const adAccountId = new URL(url).pathname.split("/").find((part) => part.startsWith("act_"));
  safeMetaLog("meta_ads_graph_get", { url, adAccountId, token: cleanToken, status: res.status });
  return { res, json };
}

async function getAdAccountName(token: string, adAccountId: string) {
  const acct = normalizeAdAccountId(adAccountId);
  if (!acct) return null;

  try {
    const direct = await fbFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${acct}?fields=${META_ACCOUNT_FIELDS}`,
      token,
    );
    if (direct.res.ok && !direct.json?.error) {
      const name = direct.json?.name as string;
      if (name) return name;
    }
  } catch {}

  return null;
}

async function validateAdAccountAccess(token: string, adAccountId: string) {
  const acct = normalizeAdAccountId(adAccountId);
  if (!acct) throw new Error("ID da conta de anúncio inválido.");
  const account = await fbFetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${acct}?fields=${META_ACCOUNT_FIELDS}`,
    token,
  );

  if (!account.res.ok || account.json?.error) {
    throw new Error(fbErrorMessage(account.json, account.res.status));
  }

  return {
    adAccountId: acct,
    accountId: (account.json?.account_id as string | undefined) ?? acct.replace(/^act_/, ""),
    name: (account.json?.name as string | undefined) ?? null,
    currency: (account.json?.currency as string | undefined) ?? null,
    timezoneName: (account.json?.timezone_name as string | undefined) ?? null,
  };
}

function fbErrorMessage(json: any, status: number) {
  const e = json?.error;
  if (!e) return `Falha na Marketing API (${status})`;
  const rawMessage = String(e.message ?? "");
  if (Number(e.code) === 100 && rawMessage.toLowerCase().includes("account_name")) {
    return "Erro interno na integração: o campo account_name é inválido. A integração foi ajustada para usar o campo name.";
  }
  if (Number(e.code) === 190) {
    return "Token inválido, expirado ou copiado incorretamente. Gere um novo token de usuário do sistema com permissão ads_read.";
  }
  if (String(e.message ?? "").toLowerCase().includes("api access blocked")) {
    return "Acesso à API da Meta bloqueado para este token/app. Gere um novo token de Usuário do Sistema com ads_read, confirme que a conta de anúncios foi atribuída a esse usuário e que o app tem acesso à Marketing API.";
  }
  const parts: string[] = [];
  if (e.message) parts.push(String(e.message));
  if (e.code) parts.push(`code ${e.code}`);
  if (e.error_subcode) parts.push(`subcode ${e.error_subcode}`);
  if (e.error_user_msg) parts.push(String(e.error_user_msg));
  return parts.join(" — ");
}

const SaveSchema = z.object({
  access_token: z.string().optional().default("").transform(sanitizeAccessToken),
  ad_account_id: z
    .string()
    .trim()
    .min(3)
    .transform(normalizeAdAccountId)
    .refine((value) => /^act_\d+$/.test(value), "ID da conta de anúncio inválido"),
});

export const saveFacebookIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const settingsTable = supabase.from("settings") as any;
    const { data: existing, error: existingError } = await settingsTable
      .select("fb_access_token")
      .eq("store_id", userId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    const token = data.access_token && !isMaskedToken(data.access_token) ? data.access_token : existing?.fb_access_token;
    if (!token || sanitizeAccessToken(token).length < 20 || isMaskedToken(token)) {
      throw new Error("Informe um Access Token real da Meta. O placeholder visual não pode ser usado para conectar.");
    }
    // Valida o token diretamente na conta de anúncios. Tokens de Usuário do
    // Sistema com apenas ads_read podem falhar no /me, mesmo quando conseguem
    // ler métricas da conta corretamente.
    const account = await validateAdAccountAccess(token, data.ad_account_id);
    const { error } = await settingsTable
      .from("settings")
      .update({
        fb_access_token: sanitizeAccessToken(token),
        fb_ad_account_id: account.adAccountId,
        fb_account_id: account.accountId,
        fb_ad_account_name: account.name,
        fb_currency: account.currency,
        fb_timezone_name: account.timezoneName,
        fb_connection_status: "connected",
        fb_last_sync_error: null,
      })
      .eq("store_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, ad_account_id: account.adAccountId, ad_account_name: account.name };
  });

export const disconnectFacebookIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase.from("settings") as any)
      .from("settings")
      .update({
        fb_access_token: null,
        fb_ad_account_id: null,
        fb_account_id: null,
        fb_ad_account_name: null,
        fb_currency: null,
        fb_timezone_name: null,
        fb_connection_status: null,
        fb_last_sync_at: null,
        fb_last_sync_status: null,
        fb_last_sync_error: null,
      })
      .eq("store_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getFacebookIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase.from("settings") as any)
      .from("settings")
      .select("fb_ad_account_id, fb_account_id, fb_ad_account_name, fb_currency, fb_timezone_name, fb_connection_status, fb_last_sync_at, fb_last_sync_status, fb_last_sync_error, fb_access_token")
      .eq("store_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    let ad_account_name: string | null = data?.fb_ad_account_name ?? null;
    if (!ad_account_name && data?.fb_access_token && data?.fb_ad_account_id) {
      ad_account_name = await getAdAccountName(data.fb_access_token, data.fb_ad_account_id);
    }

    return {
      connected: !!data?.fb_access_token && !!data?.fb_ad_account_id,
      ad_account_id: data?.fb_ad_account_id ?? null,
      account_id: data?.fb_account_id ?? null,
      ad_account_name,
      currency: data?.fb_currency ?? null,
      timezone_name: data?.fb_timezone_name ?? null,
      connection_status: data?.fb_connection_status ?? null,
      last_sync_at: data?.fb_last_sync_at ?? null,
      last_sync_status: data?.fb_last_sync_status ?? null,
      last_sync_error: data?.fb_last_sync_error ?? null,
    };
  });

const SyncSchema = z.object({
  days: z.number().int().min(1).max(90).default(30).optional(),
  range: z.enum(["today", "this_month"]).default("today"),
});

export const syncFacebookAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SyncSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: settings, error: setErr } = await (supabase.from("settings") as any)
      .from("settings")
      .select("fb_access_token, fb_ad_account_id, fb_last_sync_at")
      .eq("store_id", userId)
      .maybeSingle();
    if (setErr) throw new Error(setErr.message);
    if (!settings?.fb_access_token || !settings?.fb_ad_account_id) {
      throw new Error("Conecte sua conta do Facebook Ads antes de sincronizar.");
    }

    const adAccountId = normalizeAdAccountId(settings.fb_ad_account_id);
    const shouldSyncMonth = data.range === "this_month" || !settings.fb_last_sync_at;
    const fields = META_INSIGHTS_FIELDS;
    // Usamos o fuso de São Paulo para definir "hoje" do ponto de vista da conta,
    // pois a Meta interpreta time_range no fuso da conta de anúncios.
    const tzNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const todayStr = fmt(tzNow);
    const base = `https://graph.facebook.com/${GRAPH_VERSION}/${adAccountId}/insights?fields=${fields}`;
    const rows: Array<{ date_start?: string; date_stop?: string; spend?: string; impressions?: string; clicks?: string }> = [];

    if (shouldSyncMonth) {
      const { res, json } = await fbFetch(`${base}&date_preset=this_month`, settings.fb_access_token);
      if (!res.ok || json?.error) {
        const msg = fbErrorMessage(json, res.status);
        await (supabase.from("settings") as any)
          .from("settings")
          .update({ fb_last_sync_status: "error", fb_last_sync_error: msg, fb_last_sync_at: new Date().toISOString() })
          .eq("store_id", userId);
        throw new Error(msg);
      }
      rows.push(...(json?.data ?? []));
    }

    if (data.range === "today" || !settings.fb_last_sync_at) {
      const { res: todayRes, json: todayJson } = await fbFetch(`${base}&date_preset=today`, settings.fb_access_token);
      if (!todayRes.ok || todayJson?.error) {
        const msg = fbErrorMessage(todayJson, todayRes.status);
        await (supabase.from("settings") as any)
          .from("settings")
          .update({ fb_last_sync_status: "error", fb_last_sync_error: msg, fb_last_sync_at: new Date().toISOString() })
          .eq("store_id", userId);
        throw new Error(msg);
      }
      const todayRow = (todayJson?.data ?? [])[0];
      if (todayRow) {
        const normalized = { ...todayRow, date_start: todayRow.date_start || todayStr };
        const idx = rows.findIndex((r) => r.date_start === normalized.date_start);
        if (idx >= 0) rows[idx] = normalized; else rows.push(normalized);
      } else if (!rows.find((r) => r.date_start === todayStr)) {
        rows.push({ date_start: todayStr, date_stop: todayStr, spend: "0", impressions: "0", clicks: "0" });
      }
    }


    const PURCHASE_TYPES = [
      "purchase",
      "omni_purchase",
      "offsite_conversion.fb_pixel_purchase",
      "onsite_web_purchase",
      "onsite_web_app_purchase",
      "web_in_store_purchase",
    ];
    const sumByTypes = (arr: any[] | undefined) =>
      (arr ?? [])
        .filter((a: any) => PURCHASE_TYPES.includes(a.action_type))
        .reduce((acc: number, a: any) => acc + (Number(a.value) || 0), 0);

    let imported = 0;
    for (const r of rows) {
      const date = r.date_start || r.date_stop || todayStr;
      const invested = Number(r.spend ?? 0) || 0;
      let purchases = 0;
      let revenue = 0;

      // Fallback: se o Pixel não envia valor/compras, usa os pedidos reais do dia
      // (ignorando cancelados) para que o ROAS seja calculado corretamente.
      if (revenue <= 0 || purchases <= 0) {
        const dayStart = `${date}T00:00:00`;
        const dayEnd = `${date}T23:59:59.999`;
        const { data: dayOrders } = await supabase
          .from("orders")
          .select("total,status,date,created_at")
          .eq("user_id", userId)
          .or(`and(date.gte.${dayStart},date.lte.${dayEnd}),and(date.is.null,created_at.gte.${dayStart},created_at.lte.${dayEnd})`);
        const valid = (dayOrders ?? []).filter(
          (o: any) => !["cancelado", "cancelada"].includes(String(o.status ?? "").toLowerCase()),
        );
        if (revenue <= 0) revenue = valid.reduce((acc: number, o: any) => acc + (Number(o.total) || 0), 0);
        if (purchases <= 0) purchases = valid.length;
      }

      const { data: existing } = await supabase
        .from("ads")
        .select("id")
        .eq("user_id", userId)
        .eq("date", date)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from("ads").update({ invested, purchases, revenue }).eq("id", existing.id);
      } else {
        await supabase.from("ads").insert({ user_id: userId, date, invested, purchases, revenue });
      }
      imported += 1;
    }


    await (supabase.from("settings") as any)
      .from("settings")
      .update({
        fb_last_sync_at: new Date().toISOString(),
        fb_last_sync_status: "ok",
        fb_last_sync_error: null,
      })
      .eq("store_id", userId);

    return { ok: true, imported };
  });
