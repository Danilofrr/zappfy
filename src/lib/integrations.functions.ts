import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GRAPH_VERSION = "v21.0";

function normalizeAdAccountId(value: string) {
  const raw = String(value ?? "").trim();
  if (raw.startsWith("act_")) return raw;
  return `act_${raw.replace(/\D/g, "")}`;
}

// Chama a Graph API enviando o token no header Authorization (mais robusto;
// muitos proxies/WAFs bloqueiam URLs com `access_token=` na query string,
// retornando erros do tipo "Acesso à API bloqueado").
async function fbFetch(url: string, token: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const json: any = await res.json().catch(() => ({}));
  return { res, json };
}

async function getAdAccountName(token: string, adAccountId: string) {
  const acct = normalizeAdAccountId(adAccountId);
  const numericId = acct.replace(/^act_/, "");

  try {
    const direct = await fbFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${acct}?fields=name,account_name,account_id`,
      token,
    );
    if (direct.res.ok && !direct.json?.error) {
      const name = (direct.json?.name as string) || (direct.json?.account_name as string);
      if (name) return name;
    }
  } catch {}

  try {
    const list = await fbFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts?fields=name,account_name,account_id&limit=200`,
      token,
    );
    const match = (list.json?.data ?? []).find((a: any) => {
      const id = String(a?.account_id ?? a?.id ?? "").replace(/^act_/, "");
      return id === numericId;
    });
    const name = (match?.name as string) || (match?.account_name as string);
    if (name) return name;
  } catch {}

  return null;
}

function fbErrorMessage(json: any, status: number) {
  const e = json?.error;
  if (!e) return `Falha na Marketing API (${status})`;
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
  access_token: z.string().trim().min(20, "Access Token muito curto"),
  ad_account_id: z
    .string()
    .trim()
    .min(3)
    .transform(normalizeAdAccountId),
});

export const saveFacebookIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // sanity check: token reaches /me
    const test = await fbFetch(`https://graph.facebook.com/${GRAPH_VERSION}/me`, data.access_token);
    if (!test.res.ok || test.json?.error) {
      throw new Error(fbErrorMessage(test.json, test.res.status) || "Token inválido ou sem permissão");
    }
    const { error } = await supabase
      .from("settings")
      .update({
        fb_access_token: data.access_token,
        fb_ad_account_id: data.ad_account_id,
        fb_last_sync_error: null,
      })
      .eq("store_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectFacebookIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("settings")
      .update({
        fb_access_token: null,
        fb_ad_account_id: null,
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
    const { data, error } = await supabase
      .from("settings")
      .select("fb_ad_account_id, fb_last_sync_at, fb_last_sync_status, fb_last_sync_error, fb_access_token")
      .eq("store_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    let ad_account_name: string | null = null;
    if (data?.fb_access_token && data?.fb_ad_account_id) {
      ad_account_name = await getAdAccountName(data.fb_access_token, data.fb_ad_account_id);
    }

    return {
      connected: !!data?.fb_access_token && !!data?.fb_ad_account_id,
      ad_account_id: data?.fb_ad_account_id ?? null,
      ad_account_name,
      last_sync_at: data?.fb_last_sync_at ?? null,
      last_sync_status: data?.fb_last_sync_status ?? null,
      last_sync_error: data?.fb_last_sync_error ?? null,
    };
  });

const SyncSchema = z.object({ days: z.number().int().min(1).max(90).default(30) });

export const syncFacebookAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SyncSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: settings, error: setErr } = await supabase
      .from("settings")
      .select("fb_access_token, fb_ad_account_id, fb_last_sync_at")
      .eq("store_id", userId)
      .maybeSingle();
    if (setErr) throw new Error(setErr.message);
    if (!settings?.fb_access_token || !settings?.fb_ad_account_id) {
      throw new Error("Conecte sua conta do Facebook Ads antes de sincronizar.");
    }

    const adAccountId = normalizeAdAccountId(settings.fb_ad_account_id);
    const isFirstSync = !settings.fb_last_sync_at;
    const fields = "spend,actions,action_values,date_start";
    // Usamos o fuso de São Paulo para definir "hoje" do ponto de vista da conta,
    // pois a Meta interpreta time_range no fuso da conta de anúncios.
    const tzNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const todayStr = fmt(tzNow);
    const base = `https://graph.facebook.com/${GRAPH_VERSION}/${adAccountId}/insights?fields=${fields}&level=account`;
    const rows: Array<{ date_start: string; spend?: string; actions?: any[]; action_values?: any[] }> = [];

    if (isFirstSync) {
      const { res, json } = await fbFetch(`${base}&time_increment=1&date_preset=this_month`, settings.fb_access_token);
      if (!res.ok || json?.error) {
        const msg = fbErrorMessage(json, res.status);
        await supabase
          .from("settings")
          .update({ fb_last_sync_status: "error", fb_last_sync_error: msg, fb_last_sync_at: new Date().toISOString() })
          .eq("store_id", userId);
        throw new Error(msg);
      }
      rows.push(...(json?.data ?? []));
    }

    const { res: todayRes, json: todayJson } = await fbFetch(`${base}&date_preset=today`, settings.fb_access_token);
    if (!todayRes.ok || todayJson?.error) {
      const msg = fbErrorMessage(todayJson, todayRes.status);
      await supabase
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
      // Sem dados na Meta ainda: insere placeholder para o fallback de pedidos preencher.
      rows.push({ date_start: todayStr, spend: "0" });
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
      const date = r.date_start;
      const invested = Number(r.spend ?? 0) || 0;
      let purchases = sumByTypes(r.actions);
      let revenue = sumByTypes(r.action_values);

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


    await supabase
      .from("settings")
      .update({
        fb_last_sync_at: new Date().toISOString(),
        fb_last_sync_status: "ok",
        fb_last_sync_error: null,
      })
      .eq("store_id", userId);

    return { ok: true, imported };
  });
