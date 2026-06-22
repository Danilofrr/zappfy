import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bike, Loader2 } from "lucide-react";

const LAST_SLUG_KEY = "zappfy:entregas:last-slug";

export const Route = createFileRoute("/entregas-zappfy/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entregas Zappfy" }] }),
  component: EntregasIndex,
});

function EntregasIndex() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(LAST_SLUG_KEY);
      if (s) {
        navigate({ to: "/entregas-zappfy/$storeSlug/login", params: { storeSlug: s }, replace: true });
        return;
      }
    } catch {}
    setChecked(true);
  }, [navigate]);

  function go(e: React.FormEvent) {
    e.preventDefault();
    const clean = (slug || "").trim().toLowerCase();
    if (!clean) return;
    try { localStorage.setItem(LAST_SLUG_KEY, clean); } catch {}
    navigate({ to: "/entregas-zappfy/$storeSlug/login", params: { storeSlug: clean } });
  }

  if (!checked) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#0b1220] text-white">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1220] text-white px-6">
      <form onSubmit={go} className="w-full max-w-sm space-y-5 text-center">
        <div className="mx-auto h-16 w-16 grid place-items-center rounded-2xl bg-emerald-500/15 text-emerald-400">
          <Bike className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Central de Entregas</h1>
          <p className="text-sm text-white/60 mt-1">Informe o identificador da sua loja para entrar.</p>
        </div>
        <input
          autoFocus
          value={slug ?? ""}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="minha-loja"
          className="w-full h-12 rounded-xl bg-white/5 border border-white/10 px-4 text-base outline-none focus:border-emerald-400"
        />
        <button
          type="submit"
          className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition"
        >
          Continuar
        </button>
      </form>
    </div>
  );
}
