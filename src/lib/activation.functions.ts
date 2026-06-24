import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Pública: precisa ler/atualizar sem auth do usuário (usuário ainda não tem senha)
export const getActivationInfo = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tok } = await supabaseAdmin
      .from("activation_tokens")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (!tok) throw new Error("Token inválido");
    if (tok.used_at) throw new Error("Token já utilizado");
    if (new Date(tok.expires_at) < new Date()) throw new Error("Token expirado");
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(tok.user_id);
    return { email: user.user?.email ?? "" };
  });

export const activateAccount = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; password: string }) =>
    z.object({ token: z.string().min(10).max(200), password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tok } = await supabaseAdmin
      .from("activation_tokens")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (!tok) throw new Error("Token inválido");
    if (tok.used_at) throw new Error("Token já utilizado");
    if (new Date(tok.expires_at) < new Date()) throw new Error("Token expirado");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(tok.user_id, {
      password: data.password,
      email_confirm: true,
    });
    if (updErr) throw new Error(updErr.message);

    // marca token como usado e ativa assinatura (sai do "teste" se admin já criou)
    await supabaseAdmin.from("activation_tokens").update({ used_at: new Date().toISOString() }).eq("id", tok.id);
    await supabaseAdmin.from("access_logs").insert({
      user_id: tok.user_id,
      event: "account_activated",
      metadata: { via: "activation_token" },
    });
    return { ok: true };
  });
