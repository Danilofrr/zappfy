import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { TrendingUp, Loader2, ShieldCheck, Zap, BarChart3, MessageCircle, CheckCircle2, Sparkles, ArrowUpRight, Star } from "lucide-react";
import { toast } from "sonner";
import { AvatarUploader } from "@/components/AvatarUploader";
import { getPublicSupport } from "@/lib/admin.functions";

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
    <div className="min-h-screen bg-background relative lg:grid lg:grid-cols-[1.1fr_1fr]">

      {/* LEFT — Marketing panel (desktop only) */}
      <aside className="hidden lg:block relative overflow-hidden">
        {/* Base gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, var(--primary) 45%, transparent), transparent 60%), radial-gradient(90% 70% at 100% 100%, color-mix(in oklab, var(--primary-glow) 35%, transparent), transparent 55%), linear-gradient(135deg, color-mix(in oklab, var(--primary) 25%, var(--background)), var(--background) 75%)",
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse at 30% 50%, black 40%, transparent 80%)",
          }}
        />
        {/* Conic glow */}
        <div
          className="absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full blur-3xl opacity-50"
          style={{ background: "conic-gradient(from 180deg, var(--primary-glow), var(--primary), transparent 70%)" }}
        />
        <div
          className="absolute -bottom-40 right-0 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }}
        />

        {/* Floating ambient dots */}
        <div className="absolute top-1/4 right-12 h-2 w-2 rounded-full bg-primary/70 shadow-[0_0_20px_var(--primary)]" />
        <div className="absolute top-2/3 left-16 h-1.5 w-1.5 rounded-full bg-primary-glow/80 shadow-[0_0_16px_var(--primary-glow)]" />
        <div className="absolute top-1/2 right-1/3 h-1 w-1 rounded-full bg-primary/60" />

        <div className="relative h-full flex flex-col justify-between p-12 xl:p-16">
          {/* Top: badge */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur px-3 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Novo · Gestão completa pelo WhatsApp
            </span>
          </div>

          {/* Middle: headline + showcase */}
          <div className="max-w-2xl">
            <h2 className="text-4xl xl:text-[3.25rem] font-bold tracking-tight text-foreground leading-[1.05]">
              Venda mais.
              <br />
              <span className="bg-gradient-to-r from-primary via-primary-glow to-primary bg-clip-text text-transparent">
                Sem perder o controle.
              </span>
            </h2>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-lg">
              O Zappfy unifica pedidos, financeiro e relatórios para quem vende todos os dias pelo WhatsApp.
            </p>

            {/* Floating dashboard preview card */}
            <div className="mt-10 relative max-w-md">
              <div
                className="absolute -inset-1 rounded-2xl opacity-60 blur-xl"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-glow))" }}
              />
              <div className="relative rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-5 shadow-elegant">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Faturamento hoje</p>
                    <p className="mt-1 text-3xl font-bold text-foreground">R$ 12.847</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                    <ArrowUpRight className="h-3 w-3" />
                    +24,8%
                  </span>
                </div>
                {/* Mini bar chart */}
                <div className="mt-5 flex items-end gap-1.5 h-20">
                  {[42, 58, 35, 70, 48, 82, 65, 95, 72, 88, 60, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm"
                      style={{
                        height: `${h}%`,
                        background:
                          i === 11
                            ? "linear-gradient(180deg, var(--primary-glow), var(--primary))"
                            : "color-mix(in oklab, var(--primary) 35%, transparent)",
                      }}
                    />
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Últimos 12 dias</span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    Atualizado agora
                  </span>
                </div>
              </div>

              {/* Floating WhatsApp pill */}
              <div className="absolute -right-6 -top-6 rounded-xl border border-border/60 bg-card/90 backdrop-blur-xl px-3 py-2 shadow-elegant flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div className="text-xs">
                  <p className="font-semibold text-foreground leading-tight">Novo pedido</p>
                  <p className="text-muted-foreground leading-tight">Maria · R$ 248</p>
                </div>
              </div>

              {/* Floating goal pill */}
              <div className="absolute -left-5 -bottom-5 rounded-xl border border-border/60 bg-card/90 backdrop-blur-xl px-3 py-2 shadow-elegant flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <div className="text-xs">
                  <p className="font-semibold text-foreground leading-tight">Meta do mês</p>
                  <p className="text-muted-foreground leading-tight">87% concluída</p>
                </div>
              </div>
            </div>

            {/* Compact feature row */}
            <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-4 max-w-lg">
              {[
                { icon: MessageCircle, title: "Pedidos do WhatsApp" },
                { icon: BarChart3, title: "Relatórios e DRE" },
                { icon: Zap, title: "Checkout próprio" },
                { icon: ShieldCheck, title: "Dados protegidos" },
              ].map(({ icon: Icon, title }) => (
                <li key={title} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{title}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom: social proof */}
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {["#22c55e", "#16a34a", "#4ade80", "#15803d"].map((c, i) => (
                  <span
                    key={i}
                    className="h-8 w-8 rounded-full border-2 border-background"
                    style={{ background: `linear-gradient(135deg, ${c}, color-mix(in oklab, ${c} 50%, #000))` }}
                  />
                ))}
              </div>
              <div className="text-sm">
                <div className="flex items-center gap-0.5 text-primary">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">+2.500 vendedores usam Zappfy</p>
              </div>
            </div>

            <div className="hidden xl:flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Sem cartão
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                Suporte humano
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT — Form */}
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

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 text-base font-semibold transition-all duration-300 hover:shadow-[0_0_0_1px_var(--primary),0_0_24px_2px_color-mix(in_oklab,var(--primary)_70%,transparent),0_0_60px_-4px_color-mix(in_oklab,var(--primary-glow)_80%,transparent)] hover:brightness-110 hover:-translate-y-0.5"
              >
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
    </div>
  );
}
