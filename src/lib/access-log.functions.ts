import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ALLOWED_EVENTS = [
  "signed_in",
  "signed_out",
  "user_updated",
  "password_recovery",
] as const;

const schema = z.object({
  event: z.enum(ALLOWED_EVENTS),
  email: z.string().email().max(255).optional(),
  user_id: z.string().uuid().optional(),
});

/**
 * Registra eventos de autenticação na tabela access_logs.
 * Usa supabaseAdmin pq a tabela só permite INSERT via service_role.
 * Não loga senhas, tokens ou payloads — apenas o evento + identificadores mínimos.
 */
export const logAuthEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("access_logs").insert({
        event: data.event,
        email: data.email ?? null,
        user_id: data.user_id ?? null,
        metadata: { source: "client_auth_listener" },
      });
    } catch (e) {
      // Logging failure must NEVER break the user flow.
      console.error("[access-log] insert failed", { message: (e as Error)?.message });
    }
    return { ok: true };
  });
