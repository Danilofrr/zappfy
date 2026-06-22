import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bike, Loader2, Lock, Phone, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { getCourierSession, setCourierSession, clearCourierSession } from "@/lib/courier-session";
import { rememberEntregasPwa } from "@/lib/entregas-pwa";
import bcrypt from "bcryptjs";

export const Route = createFileRoute("/entregas-zappfy/$storeSlug/login")({
  ssr: false,
  head: () => ({ meta: [{ title: "Login Motoboy — Entregas Zappfy" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { storeSlug } = Route.useParams();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<any>(null);
  const [store, setStore] = useState<any>(null);
  const [storeStatus, setStoreStatus] = useState<"loading" | "ok" | "not_found" | "error">("loading");
  const [form, setForm] = useState({ phone: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    rememberEntregasPwa(storeSlug);
    (async () => {
      const existing = getCourierSession(storeSlug);
      if (!existing) return;
      try {
        const { data, error } = await (supabase as any).rpc("courier_me", { _session: existing });
        if (cancelled) return;
        if (!error && data) navigate({ to: "/entregas-zappfy/$storeSlug", params: { storeSlug } });
        else clearCourierSession(storeSlug);
      } catch { clearCourierSession(storeSlug); }
    })();

    (async () => {
      try {
        const { data } = await (supabase as any).rpc("get_zappfy_central_settings");
        if (!cancelled) setTheme(data || {});
      } catch { if (!cancelled) setTheme({}); }
    })();

    const timeoutId = setTimeout(() => {
      if (!cancelled) setStoreStatus((s) => (s === "loading" ? "error" : s));
    }, 8000);

    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc("get_store_by_slug", { _slug: storeSlug });
        if (cancelled) return;
        clearTimeout(timeoutId);
        if (error) { setStoreStatus("error"); return; }
        if (!data) { setStoreStatus("not_found"); return; }
        setStore(data);
        setStoreStatus("ok");
      } catch {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setStoreStatus("error");
      }
    })();

    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [storeSlug, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone.trim() || !form.password) { toast.error("Informe WhatsApp e senha"); return; }
    setLoading(true);
    try {
      const { data: lookup, error: lookupError } = await (supabase as any).rpc("courier_lookup_for_login", {
        _slug: storeSlug, _phone: form.phone.trim(),
      });
      if (lookupError) throw lookupError;
      if (!lookup) { toast.error("WhatsApp ou senha inválidos"); return; }
      const ok = await bcrypt.compare(form.password, (lookup as any).password_hash || "");
      if (!ok) { toast.error("WhatsApp ou senha inválidos"); return; }
      if (!(lookup as any).active) { toast.error("Acesso desativado. Fale com a loja."); return; }
      const token =
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2)) + "-" + Date.now().toString(36);
      const { error: sessionError } = await (supabase as any).rpc("courier_create_session", {
        _courier_id: (lookup as any).courier_id, _token: token,
      });
      if (sessionError) throw sessionError;
      setCourierSession(storeSlug, token);
      toast.success(`Olá, ${(lookup as any).name}!`);
      navigate({ to: "/entregas-zappfy/$storeSlug", params: { storeSlug } });
    } catch (e: any) {
      toast.error(e?.message || "Falha no login");
    } finally { setLoading(false); }
  }

  if (!theme) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#05070d" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#6b7280" }} />
      </div>
    );
  }

  const bg = theme?.login_bg_color || "#05070d";
  const card = theme?.login_card_color || "#0b1220";
  const border = theme?.login_border_color || "#1f2937";
  const text = theme?.login_text_color || "#e5e7eb";
  const title = theme?.login_title_color || "#ffffff";
  const btn = theme?.login_button_color || "#10b981";
  const btnText = theme?.login_button_text_color || "#04140b";
  const glow = theme?.login_glow_color || "#10b981";
  const titleText = theme?.login_title_text || "Entrar na sua conta";
  const subtitleText = theme?.login_subtitle_text || "Acesse a Central de Entregas";
  const footerText = theme?.login_footer_text || "Zappfy Entregas · © 2026";
  const loginLogo = theme?.login_logo_url || theme?.logo_url || null;
  const loginIcon = theme?.login_icon_url || null;
  const showLogo = theme?.login_show_logo !== false;
  const iconSize = theme?.login_icon_size || 64;
  const glowEnabled = theme?.login_glow_enabled !== false;
  const brand = theme?.brand_name || "Zappfy Entregas";

  return (
    <div
      className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center gap-6 px-4 py-8"
      style={{
        background: `radial-gradient(120% 80% at 50% -10%, color-mix(in oklab, ${glow} 22%, transparent), transparent 60%), radial-gradient(80% 60% at 0% 100%, color-mix(in oklab, ${glow} 12%, transparent), transparent 60%), ${bg}`,
        color: text,
      }}
    >
      {/* subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at 50% 30%, black 40%, transparent 80%)",
        }}
      />

      {/* Top brand */}
      {showLogo && (
        <header className="entregas-mobile-header relative z-10 w-full max-w-sm flex items-center justify-center pt-2 pb-4">
          {loginLogo ? (
            <img src={loginLogo} alt={brand} style={{ height: theme?.logo_size || 36 }} className="object-contain" />
          ) : (
            <div className="flex items-center gap-2 font-bold tracking-tight" style={{ color: title }}>
              <span
                className="grid h-7 w-7 place-items-center rounded-lg"
                style={{ background: btn, color: btnText }}
              >
                <Bike className="h-4 w-4" />
              </span>
              <span>{brand}</span>
            </div>
          )}
        </header>
      )}

      {/* Card */}
      <main className="relative z-10 w-full max-w-sm">
        <div
          className="relative rounded-2xl p-6 sm:p-7 space-y-6 border backdrop-blur-xl shadow-2xl"
          style={{
            background: card,
            borderColor: border,
            boxShadow: `0 30px 80px -30px color-mix(in oklab, ${glow} 40%, transparent), 0 2px 0 0 color-mix(in oklab, #ffffff 4%, transparent) inset`,
          }}
        >
          {/* Icon with glow */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="relative" style={{ width: iconSize, height: iconSize }}>
              {glowEnabled && (
                <div
                  className="absolute inset-0 rounded-2xl blur-2xl opacity-70"
                  style={{ background: glow }}
                />
              )}
              {loginIcon ? (
                <img
                  src={loginIcon}
                  alt=""
                  className="relative object-contain"
                  style={{ width: iconSize, height: iconSize }}
                />
              ) : (
                <div
                  className="relative grid place-items-center rounded-2xl"
                  style={{
                    width: iconSize,
                    height: iconSize,
                    background: `linear-gradient(135deg, ${btn}, color-mix(in oklab, ${glow} 70%, #ffffff))`,
                    color: btnText,
                    boxShadow: glowEnabled ? `0 10px 30px -8px ${glow}` : undefined,
                  }}
                >
                  <Bike style={{ width: iconSize * 0.5, height: iconSize * 0.5 }} />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: title }}>{titleText}</h1>
              <p className="text-sm opacity-70">{subtitleText}</p>
              {storeStatus === "ok" && store && (
                <p className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
                  style={{ background: `color-mix(in oklab, ${glow} 14%, transparent)`, color: glow }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: glow }} />
                  {store.store_name}
                </p>
              )}
              {storeStatus === "loading" && (
                <p className="text-[11px] opacity-50 flex items-center justify-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando loja…
                </p>
              )}
            </div>
          </div>

          {storeStatus === "not_found" && (
            <div className="rounded-lg p-3 text-sm text-center" style={{ background: "rgba(239,68,68,0.12)", color: "#fecaca" }}>
              Loja não encontrada. Verifique o link.
            </div>
          )}
          {storeStatus === "error" && (
            <div className="rounded-lg p-3 text-sm text-center" style={{ background: "rgba(234,179,8,0.12)", color: "#fde68a" }}>
              Não foi possível carregar os dados da loja.
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide opacity-70">WhatsApp</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                <Input
                  inputMode="numeric"
                  autoComplete="username"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="5581999990000"
                  className="h-11 pl-9 border-0"
                  style={{
                    background: `color-mix(in oklab, ${bg} 60%, #ffffff 6%)`,
                    color: title,
                    boxShadow: `0 0 0 1px ${border} inset`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wide opacity-70">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
                <Input
                  type={showPwd ? "text" : "password"}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="h-11 pl-9 pr-10 border-0"
                  style={{
                    background: `color-mix(in oklab, ${bg} 60%, #ffffff 6%)`,
                    color: title,
                    boxShadow: `0 0 0 1px ${border} inset`,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-60 hover:opacity-100"
                  aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || storeStatus !== "ok"}
              className="w-full h-12 font-bold text-base rounded-xl transition-all hover:brightness-110 hover:scale-[1.01]"
              style={{
                background: `linear-gradient(135deg, ${btn}, color-mix(in oklab, ${glow} 65%, #ffffff))`,
                color: btnText,
                boxShadow: `0 12px 30px -10px ${glow}`,
              }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="text-center">
            <Link
              to="/entregas-zappfy/$storeSlug"
              params={{ storeSlug }}
              className="text-xs opacity-60 hover:opacity-100 underline-offset-4 hover:underline"
            >
              Voltar para a Central
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 pt-6 text-[11px] opacity-50 text-center">
        {footerText}
      </footer>
    </div>
  );
}
