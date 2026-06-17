import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Share, Plus, X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "lt_pwa_install_dismissed_at";
const DISMISS_DAYS = 7;

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function isLovablePreview() {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return (
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h.endsWith(".lovableproject.com") ||
    h.endsWith(".lovableproject-dev.com") ||
    h.endsWith(".lovable.app") === false && h.endsWith(".lovable.dev") ||
    window.self !== window.top
  );
}

function isIOS() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

function isSafari() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
}

function recentlyDismissed() {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const days = (Date.now() - Number(v)) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || isLovablePreview() || recentlyDismissed()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // iOS Safari has no beforeinstallprompt — show manual instructions after a delay
    let t: ReturnType<typeof setTimeout> | undefined;
    if (isIOS() && isSafari()) {
      t = setTimeout(() => {
        setShowIOS(true);
        setVisible(true);
      }, 2500);
    }

    const onInstalled = () => {
      setVisible(false);
      setBip(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      if (t) clearTimeout(t);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setVisible(false);
  }

  async function install() {
    if (!bip) return;
    try {
      await bip.prompt();
      const choice = await bip.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
      else dismiss();
    } finally {
      setBip(null);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-4 sm:left-auto sm:right-4 sm:w-[360px] sm:px-0">
      <Card className="card-neon relative overflow-hidden p-4 shadow-2xl">
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Download className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Instale o LucroTrack</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {showIOS
                ? "Adicione à tela inicial para abrir como um app."
                : "Adicione à tela inicial e abra como um app nativo."}
            </p>

            {showIOS ? (
              <ol className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span>1. Toque em</span>
                  <Share className="h-3.5 w-3.5 text-primary" />
                  <span>Compartilhar</span>
                </li>
                <li className="flex items-center gap-2">
                  <span>2. Escolha</span>
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  <span>"Adicionar à Tela de Início"</span>
                </li>
              </ol>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={install} disabled={!bip} className="flex-1">
                  <Download className="mr-1.5 h-4 w-4" />
                  Instalar
                </Button>
                <Button size="sm" variant="ghost" onClick={dismiss}>
                  Agora não
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
