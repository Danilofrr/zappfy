import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bike, MapPin, Phone, Loader2, RefreshCw, Package, ArrowRight, Store, LogOut } from "lucide-react";
import { toast } from "sonner";
import { formatRelative, orderShortNumber } from "@/lib/tracking";
import { getCourierSession, clearCourierSession } from "@/lib/courier-session";

export const Route = createFileRoute("/entregas-zappfy/$storeSlug/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entregas Zappfy — Central de Entregas" }] }),
  component: CentralPage,
});

type CentralTheme = {
  id: string;
  logo_url: string | null;
  logo_size: number;
  header_color: string;
  header_text_color: string;
  background_color: string;
  card_color: string;
  card_border_color: string;
  card_shadow_color: string;
  card_radius: number;
  text_color: string;
  title_color: string;
  button_color: string;
  button_text_color: string;
  icon_color: string;
  footer_text: string;
  brand_name: string;
};

type Delivery = {
  tracking_code: string;
  status: string;
  created_at: string;
  notes: string | null;
  order: {
    id: string; customer: string; phone: string; address: string;
    district: string; city: string; total: number; date: string; notes: string | null;
  };
};

type ActiveDelivery = {
  tracking_code: string;
  courier_token: string;
  status: string;
  accepted_at: string | null;
  order: { id: string; customer: string; address: string };
};

type Me = { courier_id: string; name: string; phone: string; store_id: string; store_name: string; slug: string };

const DEFAULT_THEME: CentralTheme = {
  id: "", logo_url: null, logo_size: 48,
  header_color: "#0f172a", header_text_color: "#ffffff",
  background_color: "#0b1220", card_color: "#0f172a",
  card_border_color: "#1e293b", card_shadow_color: "#000000", card_radius: 16,
  text_color: "#e5e7eb", title_color: "#ffffff",
  button_color: "#10b981", button_text_color: "#ffffff",
  icon_color: "#10b981",
  footer_text: "Powered by Zappfy", brand_name: "Entregas Zappfy",
};

function CentralPage() {
  const { storeSlug } = Route.useParams();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<CentralTheme>(DEFAULT_THEME);
  const [me, setMe] = useState<Me | null>(null);
  const [available, setAvailable] = useState<Delivery[]>([]);
  const [active, setActive] = useState<ActiveDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  // Bootstrap: theme + verify session
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const session = getCourierSession(storeSlug);
      if (!session) {
        navigate({ to: "/entregas-zappfy/$storeSlug/login", params: { storeSlug }, replace: true });
        return;
      }
      const [{ data: themeRes }, { data: meRes, error: meErr }] = await Promise.all([
        (supabase as any).rpc("get_zappfy_central_settings"),
        (supabase as any).rpc("courier_me", { _session: session }),
      ]);
      if (!alive) return;
      if (themeRes) setTheme({ ...DEFAULT_THEME, ...(themeRes as CentralTheme) });
      if (meErr || !meRes) {
        clearCourierSession(storeSlug);
        navigate({ to: "/entregas-zappfy/$storeSlug/login", params: { storeSlug }, replace: true });
        return;
      }
      setMe(meRes as Me);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [storeSlug, navigate]);

  async function loadDeliveries() {
    const session = getCourierSession(storeSlug);
    if (!session) return;
    const [{ data: avail }, { data: act }] = await Promise.all([
      (supabase as any).rpc("list_available_deliveries_v2", { _session: session }),
      (supabase as any).rpc("list_my_active_deliveries", { _session: session }),
    ]);
    if (Array.isArray(avail)) setAvailable(avail as Delivery[]);
    if (Array.isArray(act)) setActive(act as ActiveDelivery[]);
  }

  useEffect(() => {
    if (!me) return;
    loadDeliveries();
    const interval = setInterval(loadDeliveries, 15000);
    const channel = supabase
      .channel(`central_${me.store_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_tracking", filter: `store_id=eq.${me.store_id}` },
        () => loadDeliveries(),
      )
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.store_id]);

  async function accept(d: Delivery) {
    const session = getCourierSession(storeSlug);
    if (!session) return;
    setAccepting(d.tracking_code);
    const { data, error } = await (supabase as any).rpc("accept_delivery_v2", { _session: session, _code: d.tracking_code });
    setAccepting(null);
    if (error) { toast.error(error.message); return; }
    const result = data as { courier_token: string };
    toast.success("Entrega aceita! Boa rota 🛵");
    navigate({ to: "/entrega/$courierToken", params: { courierToken: result.courier_token } });
  }

  function logout() {
    const session = getCourierSession(storeSlug);
    if (session) (supabase as any).rpc("courier_logout", { _session: session });
    clearCourierSession(storeSlug);
    navigate({ to: "/entregas-zappfy/$storeSlug/login", params: { storeSlug }, replace: true });
  }

  const cardStyle: React.CSSProperties = {
    background: theme.card_color,
    border: `1px solid ${theme.card_border_color}`,
    boxShadow: `0 10px 26px -12px ${theme.card_shadow_color}88`,
    borderRadius: theme.card_radius,
    color: theme.text_color,
  };

  if (loading || !me) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: theme.background_color, color: theme.text_color }}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-16" style={{ background: theme.background_color, color: theme.text_color }}>
      <header
        className="w-full px-5 py-5 flex items-center gap-3"
        style={{ background: theme.header_color, color: theme.header_text_color }}
      >
        {theme.logo_url ? (
          <img src={theme.logo_url} alt={theme.brand_name} style={{ height: theme.logo_size, width: "auto" }} className="object-contain" />
        ) : (
          <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: theme.button_color, color: theme.button_text_color }}>
            <Bike className="h-5 w-5" />
          </div>
        )}
        <div className="leading-tight min-w-0">
          <div className="text-lg font-extrabold truncate">{theme.brand_name}</div>
          <div className="text-xs opacity-80 truncate">Olá, {me.name}</div>
        </div>
        <button
          onClick={loadDeliveries}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border"
          style={{ borderColor: `${theme.header_text_color}33`, color: theme.header_text_color }}
          aria-label="Atualizar"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border"
          style={{ borderColor: `${theme.header_text_color}33`, color: theme.header_text_color }}
          aria-label="Sair"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-5 space-y-5">
        <section className="flex items-center gap-2 text-sm">
          <Store className="h-4 w-4" style={{ color: theme.icon_color }} />
          <span className="opacity-70">Loja:</span>
          <strong style={{ color: theme.title_color }}>{me.store_name}</strong>
        </section>

        {active.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold mb-2 opacity-80">Minhas entregas em andamento</h2>
            <div className="space-y-2">
              {active.map((a) => (
                <button
                  key={a.tracking_code}
                  onClick={() => navigate({ to: "/entrega/$courierToken", params: { courierToken: a.courier_token } })}
                  className="w-full flex items-center justify-between p-3 text-left transition hover:opacity-90"
                  style={cardStyle}
                >
                  <div className="text-xs">
                    <div className="opacity-70">
                      {a.accepted_at ? `Aceita ${formatRelative(a.accepted_at)}` : "Em andamento"}
                    </div>
                    <div className="font-semibold" style={{ color: theme.title_color }}>{a.order.customer}</div>
                    <div className="opacity-70 truncate">{a.order.address}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0" style={{ color: theme.icon_color }} />
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-semibold mb-2 opacity-80">
            Entregas disponíveis {available.length > 0 && <span className="opacity-60">({available.length})</span>}
          </h2>

          {available.length === 0 ? (
            <div className="p-6 text-center" style={cardStyle}>
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" style={{ color: theme.icon_color }} />
              <div className="text-sm font-medium" style={{ color: theme.title_color }}>Nenhuma entrega disponível</div>
              <div className="text-xs opacity-70 mt-1">Assim que a loja liberar uma entrega, ela aparece aqui automaticamente.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {available.map((d) => {
                const addr = [d.order.address, d.order.district, d.order.city].filter(Boolean).join(", ");
                const isAccepting = accepting === d.tracking_code;
                return (
                  <div key={d.tracking_code} className="p-4 space-y-3" style={cardStyle}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs opacity-70">Pedido #{orderShortNumber(d.order.id)}</div>
                        <div className="font-semibold" style={{ color: theme.title_color }}>{d.order.customer}</div>
                      </div>
                      <div className="text-[11px] opacity-70 text-right">{formatRelative(d.created_at)}</div>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 mt-0.5 shrink-0" style={{ color: theme.icon_color }} />
                      <div className="flex-1">{addr || "Endereço não informado"}</div>
                    </div>
                    {d.order.phone && (
                      <div className="flex items-center gap-2 text-xs opacity-80">
                        <Phone className="h-3.5 w-3.5" style={{ color: theme.icon_color }} />
                        {d.order.phone}
                      </div>
                    )}
                    {d.notes && (
                      <div className="text-xs italic opacity-80 pt-1 border-t" style={{ borderColor: theme.card_border_color }}>
                        Obs: {d.notes}
                      </div>
                    )}
                    <Button
                      onClick={() => accept(d)}
                      disabled={isAccepting}
                      className="w-full h-11 font-semibold"
                      style={{ background: theme.button_color, color: theme.button_text_color }}
                    >
                      {isAccepting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Bike className="h-4 w-4 mr-2" />}
                      Aceitar Entrega
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="text-center text-[11px] opacity-50 mt-10">{theme.footer_text}</footer>
    </div>
  );
}
