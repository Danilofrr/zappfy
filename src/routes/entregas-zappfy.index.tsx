import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MapPinned, Navigation, RefreshCw, Smartphone } from "lucide-react";
import {
  ENTREGAS_APPLE_ICON_URL,
  ENTREGAS_FAVICON_URL,
  getRememberedEntregasSlug,
  rememberEntregasPwa,
} from "@/lib/entregas-pwa";

export const Route = createFileRoute("/entregas-zappfy/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Zappfy Entregas — Central de Entregas" },
      { name: "theme-color", content: "#18c56e" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", sizes: "any", href: ENTREGAS_FAVICON_URL },
      { rel: "apple-touch-icon", href: ENTREGAS_APPLE_ICON_URL },
    ],
  }),
  component: EntregasRootPage,
});

function EntregasRootPage() {
  const navigate = useNavigate();
  const [resolving, setResolving] = useState(true);

  function resolveStore() {
    setResolving(true);
    let slug = getRememberedEntregasSlug();

    if (!slug && typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const querySlug = params.get("store")?.trim().toLowerCase();
        if (querySlug) {
          rememberEntregasPwa(querySlug);
          slug = querySlug;
        }
      } catch {}
    }

    if (!slug && typeof document !== "undefined" && document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin === window.location.origin) {
          const match = referrer.pathname.match(/^\/entregas-zappfy\/([^/]+)/);
          const referrerSlug = match?.[1] ? decodeURIComponent(match[1]).trim().toLowerCase() : "";
          if (referrerSlug && referrerSlug !== "login") {
            rememberEntregasPwa(referrerSlug);
            slug = referrerSlug;
          }
        }
      } catch {}
    }

    if (slug) {
      navigate({
        to: "/entregas-zappfy/$storeSlug/login",
        params: { storeSlug: slug },
        replace: true,
      });
      return;
    }

    setResolving(false);
  }

  useEffect(() => {
    resolveStore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07100c] text-[#d8e5dc]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage: "radial-gradient(ellipse at 50% 35%, black 20%, transparent 76%)",
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-[-160px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[130px]" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <div className="w-full rounded-[28px] border border-[#223229] bg-[#0d1711]/95 p-6 text-center shadow-2xl sm:p-8">
          <div className="relative mx-auto grid h-[72px] w-[72px] place-items-center rounded-[23px] border border-emerald-300/40 bg-gradient-to-br from-emerald-400 to-emerald-600 text-[#04140b] shadow-[0_18px_48px_-18px_rgba(24,197,110,.9)]">
            <MapPinned className="h-9 w-9" strokeWidth={2.35} />
            <span className="absolute -bottom-1.5 -right-1.5 grid h-7 w-7 place-items-center rounded-full border-[3px] border-[#0d1711] bg-white text-[#07120d] shadow-lg">
              <Navigation className="h-3.5 w-3.5" fill="currentColor" />
            </span>
          </div>

          <div className="mt-5 text-xl font-black tracking-tight text-white">Zappfy Entregas</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Central de Entregas</div>

          {resolving ? (
            <div className="mt-8 flex flex-col items-center gap-3 text-sm text-white/55">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
              Abrindo sua Central…
            </div>
          ) : (
            <div className="mt-8">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                <Smartphone className="h-5 w-5" />
              </div>
              <h1 className="mt-4 text-lg font-bold text-white">Vincule este aparelho à sua Central</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/55">
                Abra uma vez o link da Central enviado pela sua loja. Depois disso, o aplicativo abrirá direto na tela normal de login com WhatsApp e senha.
              </p>
              <button
                type="button"
                onClick={resolveStore}
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/15"
              >
                <RefreshCw className="h-4 w-4" /> Tentar novamente
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
