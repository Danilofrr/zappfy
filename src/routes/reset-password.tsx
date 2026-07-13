import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/lib/theme";
import { usePlatformLogo } from "@/lib/usePlatformLogo";
import { validatePassword, PASSWORD_HINT } from "@/lib/password-policy";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — ZappFy" },
      { name: "description", content: "Defina uma nova senha para sua conta ZappFy." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { logoUrl } = usePlatformLogo();
  const [ready, setReady] = useState(false);
  const [validating, setValidating] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const finishOk = () => {
      if (cancelled) return;
      setReady(true);
      setValidating(false);
      setError(null);
      // Limpa parâmetros sensíveis da URL depois de estabelecer a sessão
      try {
        window.history.replaceState({}, document.title, "/reset-password");
      } catch {}
    };
    const finishErr = (msg: string) => {
      if (cancelled) return;
      setReady(false);
      setValidating(false);
      setError(msg);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        finishOk();
      }
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const search = url.searchParams;
        const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);

        // Erros propagados pelo Supabase no link (link expirado etc.)
        const errDesc = search.get("error_description") || hash.get("error_description");
        const errCode = search.get("error_code") || hash.get("error_code") || search.get("error") || hash.get("error");
        if (errDesc || errCode) {
          finishErr(errDesc ? decodeURIComponent(errDesc.replace(/\+/g, " ")) : "Link inválido ou expirado. Solicite uma nova recuperação de senha.");
          return;
        }

        // 1) Fluxo PKCE: ?code=...
        const code = search.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) { finishErr("Link inválido ou expirado. Solicite uma nova recuperação de senha."); return; }
          finishOk();
          return;
        }

        // 2) Fluxo OTP com token_hash
        const tokenHash = search.get("token_hash") || hash.get("token_hash");
        const type = (search.get("type") || hash.get("type")) as any;
        if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) { finishErr("Link inválido ou expirado. Solicite uma nova recuperação de senha."); return; }
          finishOk();
          return;
        }

        // 3) Fluxo hash tokens (#access_token=...&refresh_token=...)
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) { finishErr("Link inválido ou expirado. Solicite uma nova recuperação de senha."); return; }
          finishOk();
          return;
        }

        // 4) Sessão já ativa (usuário acabou de vir do link e Supabase auto-processou)
        const { data } = await supabase.auth.getSession();
        if (data.session) { finishOk(); return; }

        // Espera curta para o auto-parse do supabase-js
        setTimeout(async () => {
          if (cancelled) return;
          const { data: d2 } = await supabase.auth.getSession();
          if (d2.session) finishOk();
          else finishErr("Link inválido ou expirado. Solicite uma nova recuperação de senha.");
        }, 900);
      } catch (e: any) {
        finishErr(e?.message ?? "Não foi possível validar o link de recuperação.");
      }
    })();

    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const check = validatePassword(password);
    if (!check.ok) { toast.error(check.error); return; }
    if (password !== confirm) { toast.error("As senhas informadas não são iguais."); return; }
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) throw new Error("O link de recuperação é inválido ou expirou.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha alterada com sucesso.");
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível redefinir a senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4 py-8">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <Card className="w-full max-w-md p-6 lg:p-8">
        <div className="flex items-center mb-6">
          <img src={logoUrl} alt="Zappfy" className="h-12 w-auto object-contain" />
        </div>

        <h1 className="text-2xl font-bold mb-1">Crie uma nova senha</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Digite abaixo a nova senha que deseja utilizar.
        </p>

        {validating ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Validando link de recuperação...
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <p className="font-semibold text-sm">Link inválido ou expirado</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
            <Button asChild className="w-full">
              <Link to="/auth">Solicitar novo link</Link>
            </Button>
          </div>
        ) : ready ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={PASSWORD_HINT}
                  required
                  autoFocus
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground" aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}>
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar nova senha</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showPwd2 ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Digite novamente"
                  required
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPwd2(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground" aria-label={showPwd2 ? "Ocultar senha" : "Mostrar senha"}>
                  {showPwd2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando nova senha...</> : "Salvar nova senha"}
            </Button>
            <div className="text-center">
              <Link to="/auth" className="text-xs text-muted-foreground hover:text-foreground underline">
                Voltar para o login
              </Link>
            </div>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
