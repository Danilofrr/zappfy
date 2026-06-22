import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bike, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCourierSession, setCourierSession, clearCourierSession } from "@/lib/courier-session";
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
  const [loading, setLoading] = useState(false);

  console.log("Renderizando login do motoboy");
  console.log("Slug recebido", storeSlug);

  useEffect(() => {
    let cancelled = false;

    // Valida sessão existente sem travar a tela: se falhar, limpa e mostra login.
    (async () => {
      const existing = getCourierSession(storeSlug);
      if (!existing) return;
      try {
        const { data, error } = await (supabase as any).rpc("courier_me", { _session: existing });
        if (cancelled) return;
        if (!error && data) {
          navigate({ to: "/entregas-zappfy/$storeSlug", params: { storeSlug } });
        } else {
          clearCourierSession(storeSlug);
        }
      } catch {
        clearCourierSession(storeSlug);
      }
    })();

    // Tema (não bloqueia a tela)
    (async () => {
      try {
        const { data } = await (supabase as any).rpc("get_zappfy_central_settings");
        if (!cancelled) setTheme(data || {});
      } catch {
        if (!cancelled) setTheme({});
      }
    })();

    // Lookup da loja em segundo plano: nunca bloqueia a renderização do formulário.
    console.log("Buscando loja", storeSlug);
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setStoreStatus((s) => (s === "loading" ? "error" : s));
      }
    }, 8000);

    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc("get_store_by_slug", { _slug: storeSlug });
        if (cancelled) return;
        clearTimeout(timeoutId);
        if (error) {
          console.error("Erro da busca", error);
          setStoreStatus("error");
          return;
        }
        if (!data) {
          console.log("Resultado da loja", null);
          setStoreStatus("not_found");
          return;
        }
        console.log("Resultado da loja", data);
        setStore(data);
        setStoreStatus("ok");
      } catch (err) {
        if (cancelled) return;
        clearTimeout(timeoutId);
        console.error("Erro da busca", err);
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
    setLoading(true);
    try {
      const { data: lookup, error: lookupError } = await (supabase as any).rpc("courier_lookup_for_login", {
        _slug: storeSlug,
        _phone: form.phone.trim(),
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
        _courier_id: (lookup as any).courier_id,
        _token: token,
      });
      if (sessionError) throw sessionError;
      if (!token) { toast.error("Falha no login"); return; }
      setCourierSession(storeSlug, token);
      toast.success(`Olá, ${(lookup as any).name}!`);
      navigate({ to: "/entregas-zappfy/$storeSlug", params: { storeSlug } });
    } catch (e: any) {
      toast.error(e?.message || "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  const bg = theme?.background_color || "#0b1220";
  const card = theme?.card_color || "#0f172a";
  const border = theme?.card_border_color || "#1e293b";
  const text = theme?.text_color || "#e5e7eb";
  const title = theme?.title_color || "#ffffff";
  const btn = theme?.button_color || "#10b981";
  const btnText = theme?.button_text_color || "#ffffff";

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: bg, color: text }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-5 border" style={{ background: card, borderColor: border }}>
        <div className="text-center space-y-2">
          {theme?.logo_url ? (
            <img src={theme.logo_url} alt="" style={{ height: theme.logo_size || 48 }} className="mx-auto object-contain" />
          ) : (
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl" style={{ background: btn, color: btnText }}>
              <Bike className="h-6 w-6" />
            </div>
          )}
          <h1 className="text-xl font-bold" style={{ color: title }}>Acesso Motoboy</h1>
          {storeStatus === "ok" && store && <p className="text-xs opacity-70">{store.store_name}</p>}
          {storeStatus === "loading" && (
            <p className="text-xs opacity-60 flex items-center justify-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando loja…
            </p>
          )}
        </div>

        {storeStatus === "not_found" && (
          <div className="rounded-lg p-3 text-sm text-center" style={{ background: "rgba(239,68,68,0.12)", color: "#fecaca" }}>
            Loja não encontrada. Verifique o link da Central Entregas Zappfy.
          </div>
        )}
        {storeStatus === "error" && (
          <div className="rounded-lg p-3 text-sm text-center" style={{ background: "rgba(234,179,8,0.12)", color: "#fde68a" }}>
            Não foi possível carregar os dados da loja. Tente novamente em instantes.
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>WhatsApp</Label>
            <Input
              inputMode="numeric"
              autoComplete="username"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="5581999990000"
            />
          </div>
          <div>
            <Label>Senha</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••"
            />
          </div>
          <Button type="submit" disabled={loading || storeStatus !== "ok"} className="w-full h-11 font-semibold" style={{ background: btn, color: btnText }}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bike className="h-4 w-4 mr-2" />}
            Entrar
          </Button>
        </form>

        <div className="text-center text-xs opacity-60">
          Não tem login?{" "}
          <Link to="/entregas-zappfy/$storeSlug" params={{ storeSlug }} className="underline">
            Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}
