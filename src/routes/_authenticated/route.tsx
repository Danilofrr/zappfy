import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getEntregasStandaloneRedirectSlug } from "@/lib/entregas-pwa";
import { ActiveStoreProvider } from "@/lib/active-store";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const entregasSlug = location.pathname === "/" ? getEntregasStandaloneRedirectSlug() : null;
    if (entregasSlug) {
      throw redirect({
        to: "/entregas-zappfy/$storeSlug/login",
        params: { storeSlug: entregasSlug },
      });
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Verifica role e status da assinatura
    const userId = data.user.id;
    const [{ data: roles }, { data: sub }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("subscriptions")
        .select("status, expires_at, trial_ends_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");

    // Admin nunca acessa telas de cliente — sempre redireciona para o painel admin
    // Exceções: páginas de personalização que o admin master também precisa acessar
    const adminWhitelist = ["/personalizar-rastreamento"];
    const isWhitelisted = adminWhitelist.some((p) => location.pathname.startsWith(p));
    if (isAdmin && !location.pathname.startsWith("/admin") && !isWhitelisted) {
      throw redirect({ to: "/admin" });
    }

    // Cliente com assinatura vencida/bloqueada ou trial expirado → tela de bloqueio
    if (!isAdmin && sub) {
      const trialExpired =
        sub.status === "teste" &&
        sub.expires_at != null &&
        new Date(sub.expires_at).getTime() < Date.now();
      const blocked = sub.status === "vencido" || sub.status === "bloqueado" || trialExpired;
      const clientWhitelist = ["/assinatura-bloqueada", "/minha-assinatura", "/planos", "/configuracoes"];
      const onWhitelist = clientWhitelist.some((p) => location.pathname.startsWith(p));
      if (blocked && !onWhitelist) {
        throw redirect({ to: "/assinatura-bloqueada" });
      }
    }

    return { user: data.user, isAdmin, subscriptionStatus: sub?.status ?? null };
  },
  head: () => ({ links: [{ rel: "manifest", href: "/manifest.webmanifest" }] }),
  component: () => (
    <ActiveStoreProvider>
      <Outlet />
    </ActiveStoreProvider>
  ),
});
