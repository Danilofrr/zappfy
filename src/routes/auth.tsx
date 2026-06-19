import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { TrendingUp, Loader2, ShieldCheck, Zap, BarChart3, MessageCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/lib/theme";
import { AvatarUploader } from "@/components/AvatarUploader";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — ZappFy" },
      { name: "description", content: "Acesse sua conta ZappFy para gerenciar pedidos, vendas e lucro." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    const savedEmail = localStorage.getItem("lt_remember_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
  }, [navigate]);

  async function handleForgotPassword() {
    if (!email) {
      toast.error("Digite seu e-mail para recuperar a senha");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Enviamos um link de recuperação para o seu e-mail.");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao enviar recuperação");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName, store_name: storeName || "Minha Loja" },
          },
        });
        if (error) throw error;
        // Tenta salvar avatar imediatamente (funciona se confirmação automática estiver ligada)
        if (avatar && signUpData?.user?.id) {
          await supabase
            .from("profiles")
            .upsert({ id: signUpData.user.id, full_name: fullName, avatar_url: avatar });
        }
        toast.success("Conta criada! Você já pode entrar.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (rememberMe) localStorage.setItem("lt_remember_email", email);
        else localStorage.removeItem("lt_remember_email");
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/" });
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4 py-10 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <Link to="/auth" className="flex items-center justify-center mb-6">
          <img src="/logo-full.png" alt="Zappfy" className="h-16 w-auto object-contain" />
        </Link>

        <Card className="p-6 card-neon animate-neon-pulse">

          <h1 className="text-xl font-semibold tracking-tight">
            {mode === "login" ? "Entrar na sua conta" : "Criar conta grátis"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "login"
              ? "Acesse seu painel de gestão financeira."
              : "Comece a controlar suas vendas pelo WhatsApp."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Seu nome</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="João Silva" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="storeName">Nome da loja</Label>
                  <Input id="storeName" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="TechShop Recife" />
                </div>
                <div className="space-y-1.5">
                  <Label>Foto de perfil (opcional)</Label>
                  <AvatarUploader value={avatar} onChange={setAvatar} name={fullName} email={email} size={64} />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="voce@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
            </div>

            {mode === "login" && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-primary"
                  />
                  <span className="text-muted-foreground">Lembrar senha</span>
                </label>
                <button type="button" onClick={handleForgotPassword} className="text-primary hover:underline">
                  Esqueceu a senha?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>
                Ainda não tem conta?{" "}
                <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                  Entrar
                </button>
              </>
            )}
          </div>
        </Card>



      </div>
    </div>
  );
}
