// Server-only push helpers. Edge/Worker compatible (Web Crypto, no Node Buffer).
import { buildPushPayload } from "@block65/webcrypto-web-push";

const VAPID_PUBLIC_KEY =
  "BEMaUchwsmaAILommuH7nAnp6zu8PO0un7R7xRAuKvvjLiXCGQ77YW99WoC8npUAbJ3sOZe1x6nuMj8J_Ne8F8o";
const VAPID_PRIVATE_KEY = "MiamKcFmqrxF5ds8tpYEsc3Vr5c_o1hp1WG5W98r8e4";
const VAPID_SUBJECT = "mailto:contato@zappfy.app";

export type PushPayload = {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
};

/**
 * Send a web-push notification to every active subscription of a user.
 * Removes subscriptions that respond with 404/410 (Gone).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: subs, error } = await supabaseAdmin
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

  const vapid = {
    subject: VAPID_SUBJECT,
    publicKey: VAPID_PUBLIC_KEY,
    privateKey: VAPID_PRIVATE_KEY,
  };

  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
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
    await supabaseAdmin.from("notification_subscriptions").delete().in("id", stale);
  }

  console.log("[push] result", { userId, sent, removed: stale.length, total: subs.length });
  return { sent, removed: stale.length };
}
