import { useEffect, useState } from "react";
import { getPublicSupport } from "@/lib/admin.functions";
import { whatsappLink } from "@/lib/tracking";

type Mode = "login" | "dashboard";

const MESSAGES: Record<Mode, string> = {
  login: "Olá! Preciso de ajuda para acessar o Zappfy.",
  dashboard: "Olá! Preciso de suporte no Zappfy.",
};

const STORAGE_KEYS: Record<Mode, string> = {
  login: "zappfy_support_closed",
  dashboard: "zappfy_support_closed_dashboard",
};

export function SupportWhatsBubble({ mode }: { mode: Mode }) {
  const [whats, setWhats] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setClosed(sessionStorage.getItem(STORAGE_KEYS[mode]) === "1");
    }
    getPublicSupport()
      .then((r: any) => {
        setWhats(r?.whats ?? null);
        if (mode === "login") {
          setEnabled(r?.enabled !== false);
        } else {
          setEnabled(r?.dashboardEnabled === true);
        }
      })
      .catch(() => {});
  }, [mode]);

  if (!whats || !enabled || closed) return null;

  return (
    <div className="hidden lg:block fixed bottom-6 right-6 z-30 group">
      <button
        type="button"
        onClick={() => {
          setClosed(true);
          if (typeof window !== "undefined") sessionStorage.setItem(STORAGE_KEYS[mode], "1");
        }}
        aria-label="Fechar suporte"
        className="absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full bg-background border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <a
        href={whatsappLink(whats, MESSAGES[mode])}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar com o suporte no WhatsApp"
        className="relative block h-16 w-16 rounded-full transition-all hover:-translate-y-0.5 hover:scale-105 drop-shadow-[0_0_18px_rgba(34,197,94,0.65)] hover:drop-shadow-[0_0_28px_rgba(34,197,94,0.95)]"
      >
        <span className="absolute inset-0 rounded-full bg-[#22c55e]/50 blur-xl opacity-70 animate-pulse -z-10" />
        <img
          src="/__l5e/assets-v1/555ed482-0f3f-4b27-bff5-725a39539f20/whatsapp-support.png"
          alt="Suporte WhatsApp"
          className="h-full w-full object-contain"
        />
      </a>
    </div>
  );
}
