// Server-only push helpers. Edge/Worker compatible (Web Crypto, no Node Buffer).
import { buildPushPayload } from "@block65/webcrypto-web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const VAPID_PUBLIC_KEY =
  "BFzD-WlMTpM6BV5Jkd2g_8GxTK8Bg_b_zwADApU-MWUuvx1xZsa0gHqUAIn5XUEb4GUiHW9Noyyg-DBaw4A8KJ4";
const VAPID_SUBJECT = "mailto:contato@zappfy.app";

export type PushPayload = {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

type AnySupabase = SupabaseClient<Database> | SupabaseClient<any, any, any>;

/**
 * Send a web-push notification to every active subscription of a user.
 * Pass an authenticated supabase client (RLS) when sending to the current user,
 * or supabaseAdmin when sending to another user (e.g. store owner from a public endpoint).
 */
export async function sendPushToUser(
  client: AnySupabase,
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  console.log("[push] sendPushToUser start", { userId, title: payload.title });

  const { data: subs, error } = await (client as any)
    .from("notification_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    console.error("[push] failed to load subscriptions", error);
    return { sent: 0, removed: 0 };
  }
  if (!subs || subs.length === 0) {
    console.log("[push] no subscriptions for user", userId);
    return { sent: 0, removed: 0 };
  }

  console.log("[push] subscriptions found", subs.length);

  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) {
    console.error("[push] VAPID_PRIVATE_KEY não configurada — push desabilitado");
    return { sent: 0, removed: 0 };
  }
  const vapid = {
    subject: VAPID_SUBJECT,
    publicKey: VAPID_PUBLIC_KEY,
    privateKey,
  };

  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      const subscription = {
        endpoint: s.endpoint,
        expirationTime: null,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        const message = { data: payload as never, options: { ttl: 60 } };
        const { headers, body, method } = await buildPushPayload(message, subscription, vapid);
        const res = await fetch(s.endpoint, { method, headers, body: body as BodyInit });
        if (res.ok) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          stale.push(s.id);
        } else {
          const text = await res.text().catch(() => "");
          console.error("[push] send failed", { status: res.status, text, endpoint: s.endpoint });
        }
      } catch (err) {
        console.error("[push] exception sending", err, { endpoint: s.endpoint });
      }
    }),
  );

  if (stale.length) {
    await (client as any).from("notification_subscriptions").delete().in("id", stale);
  }

  console.log("[push] result", { userId, sent, removed: stale.length, total: subs.length });
  return { sent, removed: stale.length };
}
