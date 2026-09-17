import { createFileRoute } from "@tanstack/react-router";

const GRAPH_VERSION = "v21.0";
const META_INSIGHTS_FIELDS = "spend,impressions,clicks,date_start,date_stop";
const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

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

function safeMetaLog(label: string, params: { url: string; adAccountId?: string; token: string; status?: number }) {
  try {
    const parsed = new URL(params.url);
    const token = sanitizeAccessToken(params.token);
    console.log(label, {
      endpoint: parsed.pathname,
      fields: parsed.searchParams.get("fields") ?? null,
      timeRange: parsed.searchParams.get("time_range") ?? null,
      timeIncrement: parsed.searchParams.get("time_increment") ?? null,
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
  safeMetaLog("meta_ads_cron_graph_get", { url, adAccountId, token: cleanToken, status: res.status });
  return { res, json };
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

function brazilDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BRAZIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftDateKey(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function insightsUrl(base: string, since: string, until: string) {
  const range = encodeURIComponent(JSON.stringify({ since, until }));
  return `${base}&time_range=${range}&time_increment=1`;
}

type InsightRow = {
  date_start?: string;
  date_stop?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
};

async function syncStore(
  supabaseAdmin: any,
  store: { store_id: string; fb_access_token: string; fb_ad_account_id: string; fb_last_sync_at: string | null },
) {
  const isFirstSync = !store.fb_last_sync_at;
  const todayStr = brazilDateKey();
  const yesterdayStr = shiftDateKey(todayStr, -1);
  const monthStartStr = `${todayStr.slice(0, 8)}01`;
  const adAccountId = normalizeAdAccountId(store.fb_ad_account_id);
  const base = `https://graph.facebook.com/${GRAPH_VERSION}/${adAccountId}/insights?fields=${META_INSIGHTS_FIELDS}`;

  // No primeiro sync importamos o mês atual por dia. Nos próximos, sempre
  // revisamos HOJE + ONTEM. Assim o cron das 00:15 corrige qualquer ajuste
  // tardio da Meta referente ao fechamento do dia anterior.
  const since = isFirstSync ? monthStartStr : yesterdayStr;
  const until = todayStr;
  const { res, json } = await fbFetch(insightsUrl(base, since, until), store.fb_access_token);

  if (!res.ok || json?.error) {
    const msg = fbErrorMessage(json, res.status);
    await supabaseAdmin
      .from("settings")
      .update({
        fb_last_sync_status: "error",
        fb_last_sync_error: msg,
        fb_last_sync_at: new Date().toISOString(),
      })
      .eq("store_id", store.store_id);
    return { store_id: store.store_id, ok: false, error: msg };
  }

  const rows: InsightRow[] = Array.isArray(json?.data) ? [...json.data] : [];

  // A Meta normalmente omite dias sem gasto. Mantemos hoje e ontem explícitos
  // para que o dashboard não carregue valor antigo quando o gasto for zero.
  for (const requiredDate of [yesterdayStr, todayStr]) {
    if (!rows.some((row) => (row.date_start || row.date_stop) === requiredDate)) {
      rows.push({ date_start: requiredDate, date_stop: requiredDate, spend: "0", impressions: "0", clicks: "0" });
    }
  }

  rows.sort((a, b) => String(a.date_start || a.date_stop || "").localeCompare(String(b.date_start || b.date_stop || "")));

  let imported = 0;
  const syncedDates: string[] = [];

  for (const row of rows) {
    const date = row.date_start || row.date_stop;
    if (!date) continue;

    const invested = Number(row.spend ?? 0) || 0;
    let purchases = 0;
    let revenue = 0;

    // Quando o Pixel não fornece compras/faturamento, usamos os pedidos reais
    // da loja para manter ROAS e CPA do Zappfy consistentes.
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59.999`;
    const { data: dayOrders } = await supabaseAdmin
      .from("orders")
      .select("total,status,date,created_at")
      .eq("store_id", store.store_id)
      .or(`and(date.gte.${dayStart},date.lte.${dayEnd}),and(date.is.null,created_at.gte.${dayStart},created_at.lte.${dayEnd})`);

    const valid = (dayOrders ?? []).filter(
      (o: any) => !["cancelado", "cancelada"].includes(String(o.status ?? "").toLowerCase()),
    );
    revenue = valid.reduce((acc: number, o: any) => acc + (Number(o.total) || 0), 0);
    purchases = valid.length;

    const { data: existing } = await supabaseAdmin
      .from("ads")
      .select("id")
      .eq("user_id", store.store_id)
      .eq("date", date)
      .maybeSingle();

    if (existing?.id) {
      await supabaseAdmin.from("ads").update({ invested, purchases, revenue }).eq("id", existing.id);
    } else {
      await supabaseAdmin.from("ads").insert({
        user_id: store.store_id,
        date,
        invested,
        purchases,
        revenue,
      });
    }

    imported += 1;
    syncedDates.push(date);
  }

  await supabaseAdmin
    .from("settings")
    .update({
      fb_last_sync_at: new Date().toISOString(),
      fb_last_sync_status: "ok",
      fb_last_sync_error: null,
    })
    .eq("store_id", store.store_id);

  return {
    store_id: store.store_id,
    ok: true,
    imported,
    mode: isFirstSync ? "month_daily_backfill" : "today_and_yesterday",
    synced_dates: syncedDates,
  };
}

export const Route = createFileRoute("/api/public/hooks/sync-facebook-ads")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: stores, error } = await supabaseAdmin
          .from("settings")
          .select("store_id, fb_access_token, fb_ad_account_id, fb_last_sync_at")
          .not("fb_access_token", "is", null)
          .not("fb_ad_account_id", "is", null);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: any[] = [];
        for (const store of stores ?? []) {
          try {
            results.push(await syncStore(supabaseAdmin, store as any));
          } catch (e: any) {
            results.push({ store_id: (store as any).store_id, ok: false, error: e?.message });
          }
        }

        const failed = results.filter((result) => !result.ok).length;
        return new Response(
          JSON.stringify({
            ok: failed === 0,
            count: results.length,
            failed,
            synced_at: new Date().toISOString(),
            results,
          }),
          {
            status: failed === results.length && results.length > 0 ? 502 : 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          },
        );
      },
      GET: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            service: "meta-ads-nightly-sync",
            schedule_brazil: ["23:59", "00:15"],
            time_zone: BRAZIL_TIME_ZONE,
          }),
          { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        ),
    },
  },
});
