import { useEffect, useState } from "react";
import { Download, WifiOff, RefreshCw, X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "zappfy:entregas:install-dismissed";
const LAST_SLUG_KEY = "zappfy:entregas:last-slug";

type Props = { storeSlug?: string };

/**
 * Mounts on every Central Entregas page:
 *  - swaps the document's manifest + theme-color to the Entregas PWA manifest
 *  - registers the service worker and surfaces update notifications
 *  - shows an install button when the browser allows it (Android/Chrome)
 *  - shows an offline banner when the device loses internet
 *  - remembers the last store slug so the installed app re-opens on it
 */
export function EntregasPwaShell({ storeSlug }: Props) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | null>(null);

  // Persist last slug so /entregas-zappfy can redirect on reopen.
  useEffect(() => {
    if (!storeSlug) return;
    try { localStorage.setItem(LAST_SLUG_KEY, storeSlug.toLowerCase()); } catch {}
  }, [storeSlug]);

  // Swap the manifest + theme-color in the live document head.
  useEffect(() => {
    const prevManifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prevHref = prevManifest?.getAttribute("href") ?? null;
    if (prevManifest) prevManifest.setAttribute("href", "/entregas-manifest.webmanifest");

    const prevTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevThemeContent = prevTheme?.getAttribute("content") ?? null;
    if (prevTheme) prevTheme.setAttribute("content", "#22c55e");

    const prevAppleTitle = document.querySelector<HTMLMetaElement>(
      'meta[name="apple-mobile-web-app-title"]',
    );
    const prevAppleTitleContent = prevAppleTitle?.getAttribute("content") ?? null;
    if (prevAppleTitle) prevAppleTitle.setAttribute("content", "Entregas");

    return () => {
      if (prevManifest && prevHref) prevManifest.setAttribute("href", prevHref);
      if (prevTheme && prevThemeContent) prevTheme.setAttribute("content", prevThemeContent);
      if (prevAppleTitle && prevAppleTitleContent)
        prevAppleTitle.setAttribute("content", prevAppleTitleContent);
    };
  }, []);

  // Online/offline indicator.
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // beforeinstallprompt (Chrome/Edge/Android). Safari iOS has no event.
  useEffect(() => {
    try { setDismissed(localStorage.getItem(DISMISS_KEY) === "1"); } catch {}
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
        // @ts-ignore iOS Safari
        window.navigator.standalone === true,
    );
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt as any);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt as any);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // SW registration + update detection.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | null = null;
    (async () => {
      try {
        reg = await navigator.serviceWorker.register("/sw.js");
        if (reg.waiting) setUpdateReady(reg);
        reg.addEventListener("updatefound", () => {
          const sw = reg!.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateReady(reg);
            }
          });
        });
      } catch {}
    })();
    const onCtrlChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onCtrlChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onCtrlChange);
  }, []);

  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {}
    setDeferred(null);
  }

  function dismissInstall() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  }

  function applyUpdate() {
    const sw = updateReady?.waiting;
    if (sw) sw.postMessage({ type: "SKIP_WAITING" });
    else window.location.reload();
  }

  const showInstall = !installed && !dismissed && !!deferred;

  return (
    <>
      {offline && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999] px-3 py-1.5 rounded-full text-xs font-medium shadow-lg bg-amber-500/95 text-black flex items-center gap-1.5">
          <WifiOff className="h-3.5 w-3.5" />
          Sem conexão. Aguardando internet para atualizar.
        </div>
      )}

      {showInstall && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[9998] w-[calc(100%-1.5rem)] max-w-sm rounded-2xl border border-emerald-500/40 bg-[#0b1220]/95 backdrop-blur shadow-2xl p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 grid place-items-center text-emerald-400 shrink-0">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white">Instalar Aplicativo</div>
            <div className="text-[11px] text-white/60">Adicione a Central Entregas à tela inicial.</div>
          </div>
          <button
            onClick={install}
            className="h-9 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold"
          >
            Instalar
          </button>
          <button
            onClick={dismissInstall}
            aria-label="Dispensar"
            className="h-9 w-9 grid place-items-center rounded-lg text-white/50 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {updateReady && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-1.5rem)] max-w-sm rounded-2xl border border-emerald-500/40 bg-[#0b1220]/95 backdrop-blur shadow-2xl p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 grid place-items-center text-emerald-400 shrink-0">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white">Nova versão disponível</div>
            <div className="text-[11px] text-white/60">Atualize para receber as melhorias.</div>
          </div>
          <button
            onClick={applyUpdate}
            className="h-9 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold"
          >
            Atualizar
          </button>
        </div>
      )}
    </>
  );
}
