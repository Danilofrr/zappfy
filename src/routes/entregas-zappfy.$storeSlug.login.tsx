import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  MapPinned,
  Moon,
  Navigation,
  Phone,
  Route as RouteIcon,
  ShieldCheck,
  Sun,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { getCourierSession, setCourierSession, clearCourierSession } from "@/lib/courier-session";
import {
  ENTREGAS_APPLE_ICON_URL,
  ENTREGAS_COLOR_MODE_KEY,
  ENTREGAS_FAVICON_URL,
  ENTREGAS_ICON_192_URL,
  rememberEntregasPwa,
} from "@/lib/entregas-pwa";

const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
};

const logCourierLoginDebug = (debug: any) => {
  if (!debug) return;
  console.log("[Zappfy Courier Login Debug]", {
    whatsapp_normalizado_digitado: debug.input_phone_normalized ?? null,
    whatsapp_encontrado_no_banco: debug.matched_phone ?? null,
    store_id_usado_na_busca: debug.store_id ?? null,
    motoboy_encontrado: Boolean(debug.courier_found),
    senha_bateu: Boolean(debug.password_match),
    motoboy_ativo: debug.active ?? null,
    pertence_a_loja: debug.belongs_to_store ?? null,
  });
};

type ColorMode = "light" | "dark";

export const Route = createFileRoute("/entregas-zappfy/$storeSlug/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Zappfy Entregas" },
      { name: "theme-color", content: "#18c56e" },
    ],
    links: [
      { rel: "icon", type: "image/x-icon", href: ENTREGAS_FAVICON_URL },
      { rel: "icon", type: "image/png", sizes: "192x192", href: ENTREGAS_ICON_192_URL },
      { rel: "apple-touch-icon", sizes: "180x180", href: ENTREGAS_APPLE_ICON_URL },
    ],
  }),
  component: LoginPage,
});

function BrandMark({ accent, surface }: { accent: string; surface: string }) {
  return (
    <div
      className="relative grid h-[68px] w-[68px] place-items-center rounded-[22px] border"
      style={{
        background: `linear-gradient(145deg, ${accent}, color-mix(in oklab, ${accent} 68%, #052e16))`,
        borderColor: `${accent}70`,
        color: "#04140b",
        boxShadow: `0 18px 45px -18px ${accent}`,
      }}
    >
      <MapPinned className="h-8 w-8" strokeWidth={2.35} />
      <span
        className="absolute -bottom-1.5 -right-1.5 grid h-7 w-7 place-items-center rounded-full border-[3px] bg-white text-[#07120d] shadow-lg"
        style={{ borderColor: surface }}
      >
        <Navigation className="h-3.5 w-3.5" fill="currentColor" />
      </span>
    </div>
  );
}

function LoginPage() {
  const { storeSlug } = Route.useParams();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<any>(null);
  const [store, setStore] = useState<any>(null);
  const [storeStatus, setStoreStatus] = useState<"loading" | "ok" | "not_found" | "error">("loading");
  const [form, setForm] = useState({ phone: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [colorMode, setColorMode] = useState<ColorMode>(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const saved = localStorage.getItem(ENTREGAS_COLOR_MODE_KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  useEffect(() => {
    try {
      localStorage.setItem(ENTREGAS_COLOR_MODE_KEY, colorMode);
    } catch {}
  }, [colorMode]);

  useEffect(() => {
    let cancelled = false;
    rememberEntregasPwa(storeSlug);

    (async () => {
      const existing = getCourierSession(storeSlug);
      if (!existing) return;
      try {
        const { data, error } = await (supabase as any).rpc("courier_me", { _session: existing });
        if (cancelled) return;
        if (!error && data) {
          navigate({ to: "/entregas-zappfy/$storeSlug", params: { storeSlug }, replace: true });
        } else {
          clearCourierSession(storeSlug);
        }
      } catch {
        clearCourierSession(storeSlug);
      }
    })();

    (async () => {
      try {
        const { data } = await (supabase as any).rpc("get_zappfy_central_settings");
        if (!cancelled) setTheme(data || {});
      } catch {
        if (!cancelled) setTheme({});
      }
    })();

    const timeoutId = setTimeout(() => {
      if (!cancelled) setStoreStatus((status) => (status === "loading" ? "error" : status));
    }, 8000);

    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc("get_store_by_slug", { _slug: storeSlug });
        if (cancelled) return;
        clearTimeout(timeoutId);
        if (error) {
          setStoreStatus("error");
          return;
        }
        if (!data) {
          setStoreStatus("not_found");
          return;
        }
        setStore(data);
        setStoreStatus("ok");
      } catch {
        if (cancelled) return;
        clearTimeout(timeoutId);
        setStoreStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [storeSlug, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone.trim() || !form.password) {
      toast.error("Informe WhatsApp e senha");
      return;
    }

    const normalizedPhone = normalizePhone(form.phone);
    setLoading(true);
    try {
      const { data: result, error: loginError } = await (supabase as any).rpc("courier_login", {
        _slug: storeSlug,
        _phone: normalizedPhone,
        _password: form.password,
      });

      logCourierLoginDebug(result?.debug);

      if (loginError) {
        toast.error(loginError.message || "WhatsApp ou senha inválidos");
        return;
      }
      if (result?.ok === false) {
        toast.error(result.error || "WhatsApp ou senha inválidos");
        return;
      }
      if (!result?.session_token) {
        toast.error("WhatsApp ou senha inválidos");
        return;
      }

      setCourierSession(storeSlug, result.session_token);
      rememberEntregasPwa(storeSlug);
      toast.success(`Olá, ${result.name}!`);
      navigate({ to: "/entregas-zappfy/$storeSlug", params: { storeSlug } });
    } catch (error: any) {
      toast.error(error?.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  if (!theme) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#08110d] text-white">
        <div className="flex flex-col items-center gap-3">
          <BrandMark accent="#18c56e" surface="#08110d" />
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
        </div>
      </div>
    );
  }

  const accent = theme?.login_button_color || theme?.button_color || "#18c56e";
  const isLight = colorMode === "light";
  const palette = isLight
    ? {
        bg: "#f2f7f4",
        surface: "#ffffff",
        surfaceSoft: "#f7faf8",
        border: "#dbe7df",
        text: "#405248",
        title: "#12251a",
        muted: "#728278",
        input: "#f8fbf9",
      }
    : {
        bg: "#07100c",
        surface: "#0d1711",
        surfaceSoft: "#101d15",
        border: "#223229",
        text: "#d4e0d8",
        title: "#ffffff",
        muted: "#829188",
        input: "#09100c",
      };

  const storeName = store?.store_name || store?.name || "Loja vinculada";
  const titleText = theme?.login_title_text || "Entrar na Central";
  const subtitleText = theme?.login_subtitle_text || "Acesse suas entregas com segurança";
  const footerText = theme?.login_footer_text || "Zappfy Entregas · © 2026";

  return (
    <div
      className="relative min-h-screen overflow-hidden transition-colors duration-300"
      style={{ background: palette.bg, color: palette.text, colorScheme: colorMode }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage: "radial-gradient(ellipse at 50% 35%, black 20%, transparent 76%)",
        }}
      />
      <div
        className="pointer-events-none absolute -left-24 -top-36 h-[480px] w-[480px] rounded-full blur-[120px]"
        style={{ background: `${accent}${isLight ? "18" : "22"}` }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-[-120px] h-[420px] w-[420px] rounded-full blur-[130px]"
        style={{ background: `${accent}${isLight ? "12" : "18"}` }}
      />

      <header className="relative z-10 mx-auto flex h-20 w-full max-w-[1180px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <div
            className="grid h-9 w-9 place-items-center rounded-xl border"
            style={{ background: accent, borderColor: `${accent}66`, color: "#04140b" }}
          >
            <MapPinned className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-black tracking-tight" style={{ color: palette.title }}>
              Zappfy
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: palette.muted }}>
              Central de Entregas
            </div>
          </div>
        </div>

        <div
          className="flex items-center rounded-xl border p-1"
          style={{ background: palette.surfaceSoft, borderColor: palette.border }}
        >
          <button
            type="button"
            onClick={() => setColorMode("light")}
            aria-label="Usar modo claro"
            aria-pressed={isLight}
            className="grid h-8 w-8 place-items-center rounded-lg transition"
            style={isLight ? { background: palette.surface, color: "#173622", boxShadow: "0 2px 10px -7px #173622" } : { color: palette.muted }}
          >
            <Sun className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setColorMode("dark")}
            aria-label="Usar modo escuro"
            aria-pressed={!isLight}
            className="grid h-8 w-8 place-items-center rounded-lg transition"
            style={!isLight ? { background: "#24342a", color: "#ffffff" } : { color: palette.muted }}
          >
            <Moon className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-128px)] w-full max-w-[1080px] items-center gap-10 px-4 pb-12 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:px-8">
        <section className="hidden max-w-xl lg:block">
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold"
            style={{ borderColor: `${accent}45`, background: `${accent}10`, color: accent }}
          >
            <Zap className="h-3.5 w-3.5" /> Operação mais rápida, do pedido à entrega
          </div>
          <h1 className="max-w-[560px] text-5xl font-black leading-[1.02] tracking-[-0.05em]" style={{ color: palette.title }}>
            Sua rota começa em uma Central mais simples.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed" style={{ color: palette.muted }}>
            Entre para acompanhar pedidos, rotas, produtos em posse e atualizações da loja em um só lugar.
          </p>

          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            {[
              { icon: RouteIcon, title: "Rotas", text: "Acesso rápido" },
              { icon: CheckCircle2, title: "Pedidos", text: "Status em tempo real" },
              { icon: ShieldCheck, title: "Seguro", text: "Acesso individual" },
            ].map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border p-4"
                style={{ background: `${palette.surface}cc`, borderColor: palette.border }}
              >
                <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${accent}12`, color: accent }}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm font-bold" style={{ color: palette.title }}>{title}</div>
                <div className="mt-0.5 text-[11px]" style={{ color: palette.muted }}>{text}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-[440px]">
          <div
            className="relative overflow-hidden rounded-[28px] border p-5 shadow-2xl sm:p-7"
            style={{
              background: `${palette.surface}f5`,
              borderColor: palette.border,
              boxShadow: isLight
                ? "0 32px 90px -54px #315b45"
                : `0 36px 100px -46px #000000, 0 20px 65px -50px ${accent}`,
            }}
          >
            <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full blur-3xl" style={{ background: `${accent}18` }} />

            <div className="relative flex flex-col items-center text-center">
              <BrandMark accent={accent} surface={palette.surface} />
              <div className="mt-5 text-xl font-black tracking-[-0.035em]" style={{ color: palette.title }}>
                Zappfy Entregas
              </div>
              <div className="mt-5">
                <h2 className="text-2xl font-black tracking-[-0.035em]" style={{ color: palette.title }}>
                  {titleText}
                </h2>
                <p className="mt-1 text-sm" style={{ color: palette.muted }}>{subtitleText}</p>
              </div>

              {storeStatus === "ok" && store && (
                <div
                  className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold"
                  style={{ background: `${accent}0f`, borderColor: `${accent}35`, color: accent }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
                  <span className="truncate">{storeName}</span>
                </div>
              )}
              {storeStatus === "loading" && (
                <div className="mt-3 flex items-center gap-1.5 text-[11px]" style={{ color: palette.muted }}>
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando loja…
                </div>
              )}
            </div>

            {storeStatus === "not_found" && (
              <div className="relative mt-5 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-center text-sm text-red-500">
                Loja não encontrada. Verifique o link de acesso.
              </div>
            )}
            {storeStatus === "error" && (
              <div className="relative mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-center text-sm text-amber-500">
                Não foi possível carregar os dados da loja agora.
              </div>
            )}

            <form onSubmit={submit} className="relative mt-7 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-extrabold uppercase tracking-[0.1em]" style={{ color: palette.muted }}>
                  WhatsApp
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: palette.muted }} />
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="username"
                    value={form.phone}
                    onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                    placeholder="(81) 99999-0000"
                    className="h-12 rounded-xl pl-10 text-sm"
                    style={{ background: palette.input, borderColor: palette.border, color: palette.title }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-extrabold uppercase tracking-[0.1em]" style={{ color: palette.muted }}>
                  Senha
                </Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: palette.muted }} />
                  <Input
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
                    placeholder="Sua senha"
                    className="h-12 rounded-xl px-10 text-sm"
                    style={{ background: palette.input, borderColor: palette.border, color: palette.title }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((value) => !value)}
                    className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg transition"
                    style={{ color: palette.muted }}
                    aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || storeStatus === "not_found"}
                className="h-12 w-full rounded-xl text-sm font-extrabold shadow-lg transition hover:-translate-y-0.5"
                style={{ background: accent, color: "#04140b", boxShadow: `0 16px 32px -18px ${accent}` }}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                {loading ? "Entrando…" : "Entrar na Central"}
              </Button>
            </form>

            <div className="relative mt-5 flex items-center justify-center gap-1.5 text-center text-[11px]" style={{ color: palette.muted }}>
              <ShieldCheck className="h-3.5 w-3.5" /> Acesso exclusivo para motoboys autorizados
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 pb-6 text-center text-[10px] font-medium uppercase tracking-[0.12em]" style={{ color: palette.muted }}>
        {footerText}
      </footer>
    </div>
  );
}
