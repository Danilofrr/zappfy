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
    <div className="min-h-screen bg-background relative lg:grid lg:grid-cols-[1fr_1.05fr]">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* LEFT — Form */}
      <div className="flex items-center justify-center px-4 py-10 lg:px-12 lg:py-12">
        <div className="w-full max-w-md">
          <Link to="/auth" className="flex items-center justify-center lg:justify-start mb-8">
            <img src="/logo-full.png" alt="Zappfy" className="h-14 w-auto object-contain" />
          </Link>

          <Card className="p-6 lg:p-8 card-neon lg:border-border/60 lg:shadow-elegant">
            <h1 className="text-2xl font-semibold tracking-tight">
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

              <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>
                  Ainda não tem conta?{" "}
                  <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline font-medium">
                    Cadastre-se
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{" "}
                  <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline font-medium">
                    Entrar
                  </button>
                </>
              )}
            </div>
          </Card>

          <p className="mt-6 text-center lg:text-left text-xs text-muted-foreground">
            © {new Date().getFullYear()} Zappfy. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* RIGHT — Marketing panel (desktop only) */}
      <aside className="hidden lg:block relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 100% 0%, color-mix(in oklab, var(--primary) 40%, transparent), transparent 60%), radial-gradient(90% 70% at 0% 100%, color-mix(in oklab, var(--primary-glow) 30%, transparent), transparent 55%), linear-gradient(135deg, color-mix(in oklab, var(--primary) 22%, var(--background)), var(--background) 70%)",
          }}
        />
        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        {/* Glowing orbs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, var(--primary-glow), transparent 70%)" }} />
        <div className="absolute -bottom-32 -left-20 w-[28rem] h-[28rem] rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }} />

        <div className="relative h-full flex flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Novo · Gestão completa pelo WhatsApp
            </span>
          </div>

          <div className="max-w-xl">
            <h2 className="text-4xl xl:text-5xl font-bold tracking-tight text-foreground leading-tight">
              Controle suas vendas,
              <br />
              <span className="bg-gradient-to-r from-primary via-primary-glow to-primary bg-clip-text text-transparent">
                cresça com clareza.
              </span>
            </h2>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
              O Zappfy une pedidos, financeiro e relatórios em um só lugar — feito para vendedores que negociam pelo WhatsApp todos os dias.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                { icon: MessageCircle, title: "Pedidos do WhatsApp organizados", desc: "Cadastre vendas manuais e acompanhe cada cliente." },
                { icon: BarChart3, title: "Relatórios e DRE em tempo real", desc: "Veja lucro, margem e metas sem planilha." },
                { icon: Zap, title: "Checkout próprio e link de loja", desc: "Receba pagamentos com sua marca." },
                { icon: ShieldCheck, title: "Seus dados protegidos", desc: "Criptografia e backup automático." },
              ].map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{title}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Sem cartão para começar</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span>Suporte humano</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
