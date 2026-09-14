import { useEffect, useState } from "react";
import { Download, WifiOff, RefreshCw, X } from "lucide-react";
import {
  ENTREGAS_APPLE_ICON_URL,
  ENTREGAS_FAVICON_URL,
  ENTREGAS_ICON_192_URL,
  ENTREGAS_ICON_512_URL,
  getEntregasManifestUrl,
  rememberEntregasPwa,
} from "@/lib/entregas-pwa";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "zappfy:entregas:install-dismissed";

type Props = { storeSlug?: string };

/**
 * Mounts on every Central Entregas page:
 *  - swaps the document manifest + theme-color to the store-specific Entregas PWA manifest
 *  - registers the service worker and surfaces update notifications
 *  - shows an install button when the browser allows it (Android/Chrome)
 *  - shows an offline banner when the device loses internet
 *  - remembers the last store slug so old installations also re-open on it
 */
export function EntregasPwaShell({ storeSlug }: Props) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [updateReady, setUpdateReady] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!storeSlug) return;
    rememberEntregasPwa(storeSlug);
  }, [storeSlug]);

  useEffect(() => {
    const head = document.head;
    let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const manifestCreated = !manifest;
    if (!manifest) {
      manifest = document.createElement("link");
      manifest.setAttribute("rel", "manifest");
      head.appendChild(manifest);
    }
    const prevHref = manifest.getAttribute("href");
    manifest.setAttribute("href", getEntregasManifestUrl(storeSlug));

    const prevTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const prevThemeContent = prevTheme?.getAttribute("content") ?? null;
    if (prevTheme) prevTheme.setAttribute("content", "#08110d");

    const ensureMeta = (name: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      let created = false;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        head.appendChild(el);
        created = true;
      }
      const prev = el.getAttribute("content");
      el.setAttribute("content", content);
      return { el, prev, created };
    };

    const appleTitle = ensureMeta("apple-mobile-web-app-title", "Zappfy Entregas");
    const appleCapable = ensureMeta("apple-mobile-web-app-capable", "yes");
    const mobileCapable = ensureMeta("mobile-web-app-capable", "yes");
    const appleStatus = ensureMeta("apple-mobile-web-app-status-bar-style", "black");

    let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    const appleCreated = !appleIcon;
    if (!appleIcon) {
      appleIcon = document.createElement("link");
      appleIcon.setAttribute("rel", "apple-touch-icon");
      head.appendChild(appleIcon);
    }
    const prevAppleHref = appleIcon.getAttribute("href");
    appleIcon.setAttribute("href", ENTREGAS_APPLE_ICON_URL);
    appleIcon.setAttribute("sizes", "512x512");
    appleIcon.setAttribute("type", "image/png");

    const faviconSwaps: { el: HTMLLinkElement; prev: string | null }[] = [];
    const existingFavicons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));

    if (existingFavicons.length === 0) {
      const favicon = document.createElement("link");
      favicon.setAttribute("rel", "icon");
      favicon.setAttribute("type", "image/png");
      favicon.setAttribute("sizes", "512x512");
      favicon.setAttribute("href", ENTREGAS_FAVICON_URL);
      head.appendChild(favicon);
      faviconSwaps.push({ el: favicon, prev: null });
    } else {
      existingFavicons.forEach((el) => {
        const prev = el.getAttribute("href");
        const sizes = el.getAttribute("sizes") || "";
        let href = ENTREGAS_FAVICON_URL;
        if (sizes.includes("192")) href = ENTREGAS_ICON_192_URL;
        else if (sizes.includes("512")) href = ENTREGAS_ICON_512_URL;
        else if (el.getAttribute("type") === "image/png") href = ENTREGAS_ICON_192_URL;
        el.setAttribute("type", "image/png");
        el.setAttribute("href", href);
        faviconSwaps.push({ el, prev });
      });
    }

    return () => {
      if (manifestCreated) manifest?.remove();
      else if (manifest && prevHref) manifest.setAttribute("href", prevHref);

      if (prevTheme && prevThemeContent) prevTheme.setAttribute("content", prevThemeContent);
      for (const m of [appleTitle, appleCapable, mobileCapable, appleStatus]) {
        if (m.created) m.el.remove();
        else if (m.prev !== null) m.el.setAttribute("content", m.prev);
      }

      if (appleCreated) appleIcon?.remove();
      else if (appleIcon && prevAppleHref) appleIcon.setAttribute("href", prevAppleHref);

      for (const f of faviconSwaps) {
        if (f.prev) f.el.setAttribute("href", f.prev);
        else f.el.remove();
      }
    };
  }, [storeSlug]);

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

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {}

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
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
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
        <div className="fixed left-1/2 top-2 z-[9999] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-amber-500/95 px-3 py-1.5 text-xs font-medium text-black shadow-lg">
          <WifiOff className="h-3.5 w-3.5" />
          Sem conexão. Aguardando internet para atualizar.
        </div>
      )}

      {showInstall && (
        <div className="fixed bottom-3 left-1/2 z-[9998] flex w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-emerald-500/40 bg-[#0b1220]/95 p-3 shadow-2xl backdrop-blur">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">Instalar Zappfy Entregas</div>
            <div className="text-[11px] text-white/60">Adicione a Central à tela inicial deste celular.</div>
          </div>
          <button
            onClick={install}
            className="h-9 rounded-lg bg-emerald-500 px-3 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Instalar
          </button>
          <button
            onClick={dismissInstall}
            aria-label="Dispensar"
            className="grid h-9 w-9 place-items-center rounded-lg text-white/50 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {updateReady && (
        <div className="fixed bottom-3 left-1/2 z-[9999] flex w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-emerald-500/40 bg-[#0b1220]/95 p-3 shadow-2xl backdrop-blur">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">Nova versão disponível</div>
            <div className="text-[11px] text-white/60">Atualize para receber as melhorias.</div>
          </div>
          <button
            onClick={applyUpdate}
            className="h-9 rounded-lg bg-emerald-500 px-3 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Atualizar
          </button>
        </div>
      )}
    </>
  );
}
