import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bike, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCourierSession, setCourierSession } from "@/lib/courier-session";

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
  const [form, setForm] = useState({ phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existing = getCourierSession(storeSlug);
    if (existing) {
      navigate({ to: "/entregas-zappfy/$storeSlug", params: { storeSlug } });
      return;
    }
    (async () => {
      const [{ data: t }, { data: s }] = await Promise.all([
        (supabase as any).rpc("get_zappfy_central_settings"),
        (supabase as any).rpc("get_store_by_slug", { _slug: storeSlug }),
      ]);
      setTheme(t || {});
      setStore(s);
    })();
  }, [storeSlug, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone.trim() || !form.password) {
      toast.error("Informe WhatsApp e senha");
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("courier_login", {
      _slug: storeSlug,
      _phone: form.phone.trim(),
      _password: form.password,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    const session = (data as any)?.session_token;
    if (!session) { toast.error("Falha no login"); return; }
    setCourierSession(storeSlug, session);
    toast.success(`Olá, ${(data as any).name}!`);
    navigate({ to: "/entregas-zappfy/$storeSlug", params: { storeSlug } });
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
          {store && <p className="text-xs opacity-70">{store.store_name}</p>}
        </div>

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
          <Button type="submit" disabled={loading} className="w-full h-11 font-semibold" style={{ background: btn, color: btnText }}>
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
