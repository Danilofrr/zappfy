import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { TrendingUp, Loader2, ShieldCheck, Zap, BarChart3, MessageCircle, CheckCircle2, Sparkles, ArrowUpRight, Star, Phone, Lock, Eye, EyeOff, Mail, User as UserIcon, Store as StoreIcon } from "lucide-react";
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
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [supportWhats, setSupportWhats] = useState<string | null>(null);
  const [supportEnabled, setSupportEnabled] = useState(false);
  const [supportClosed, setSupportClosed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSupportClosed(sessionStorage.getItem("zappfy_support_closed") === "1");
    }
    getPublicSupport()
      .then((r) => {
        setSupportWhats(r?.whats ?? null);
        setSupportEnabled(r?.enabled !== false);
      })
      .catch(() => {});
  }, []);

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
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
    <div className="min-h-screen lg:h-screen lg:min-h-0 lg:overflow-hidden bg-background relative lg:grid lg:grid-cols-[1.1fr_1fr]">

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

        <div className="relative h-full flex flex-col justify-between p-8 xl:p-12">
          {/* Top: badge */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur px-3 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Novo · Gestão completa pelo WhatsApp
            </span>
          </div>

          {/* Middle: headline + showcase */}
          <div className="max-w-2xl">
            <h2 className="text-3xl xl:text-[2.5rem] font-bold tracking-tight text-foreground leading-[1.05]">
              Venda mais.
              <br />
              <span className="bg-gradient-to-r from-primary via-primary-glow to-primary bg-clip-text text-transparent">
                Sem perder o controle.
              </span>
            </h2>
            <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-lg">
              O Zappfy unifica pedidos, financeiro e relatórios para quem vende todos os dias pelo WhatsApp.
            </p>

            {/* Floating dashboard preview card */}
            <div className="mt-6 relative max-w-md">
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
            <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 max-w-lg">
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

          </div>
        </div>
      </aside>

      <div className="flex flex-col items-center justify-center min-h-screen lg:min-h-0 px-5 py-8 lg:px-10 lg:py-6 lg:h-screen lg:overflow-y-auto">
        <div className="w-full max-w-md flex-1 lg:flex-none flex flex-col justify-center">
          {/* Mobile hero — big logo + welcome */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8 mt-4">
            <img
              src="/logo-bubble.png"
              alt="Zappfy"
              className="h-20 w-auto object-contain drop-shadow-[0_0_24px_rgba(34,197,94,0.55)]"
            />
            <h1 className="mt-6 text-3xl font-bold tracking-tight text-foreground">
              {mode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
            </h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              {mode === "login"
                ? "Faça login para acessar sua conta"
                : "Comece a vender pelo WhatsApp"}
            </p>
          </div>

          {/* Desktop header */}
          <Link to="/auth" className="hidden lg:flex items-center justify-start mb-5">
            <img src="/logo-full.png" alt="Zappfy" className="h-12 w-auto object-contain" />
          </Link>

          <Card className="p-6 lg:p-7 rounded-2xl bg-card/80 backdrop-blur-xl border-border/60 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] card-neon lg:shadow-elegant">
            <h2 className="hidden lg:block text-2xl font-semibold tracking-tight">
              {mode === "login" ? "Entrar na sua conta" : "Criar conta grátis"}
            </h2>
            <p className="hidden lg:block text-sm text-muted-foreground mt-1">
              {mode === "login"
                ? "Acesse seu painel de gestão financeira."
                : "Comece a controlar suas vendas pelo WhatsApp."}
            </p>

            <form onSubmit={handleSubmit} className="lg:mt-6 space-y-4">
              {mode === "signup" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-sm font-semibold">Seu nome</Label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="João Silva" className="h-12 pl-10 rounded-xl bg-background/60" />
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-semibold">Email ou Usuário</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Digite seu email ou usuário"
                    className="h-12 pl-10 rounded-xl bg-background/60"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-semibold">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Digite sua senha"
                    className="h-12 pl-10 pr-11 rounded-xl bg-background/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
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
                className="w-full h-12 text-base font-semibold rounded-xl shadow-[0_8px_24px_-6px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition-all duration-300 hover:shadow-[0_0_0_1px_var(--primary),0_0_24px_2px_color-mix(in_oklab,var(--primary)_70%,transparent),0_0_60px_-4px_color-mix(in_oklab,var(--primary-glow)_80%,transparent)] hover:brightness-110 hover:-translate-y-0.5"
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

          {/* Footer */}
          <div className="mt-8 lg:mt-6 flex flex-col items-center gap-2 lg:items-start">
            <div className="lg:hidden h-px w-12 bg-border/60" />
            <p className="text-center lg:text-left text-xs text-muted-foreground">
              Zappfy Dashboard · © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>


      {/* WhatsApp floating bubble — desktop only */}
      {supportWhats && supportEnabled && !supportClosed && (
        <div className="hidden lg:block fixed bottom-6 right-6 z-30 group">
          <button
            type="button"
            onClick={() => {
              setSupportClosed(true);
              if (typeof window !== "undefined") sessionStorage.setItem("zappfy_support_closed", "1");
            }}
            aria-label="Fechar suporte"
            className="absolute -top-2 -right-2 z-10 h-6 w-6 rounded-full bg-background border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <a
            href={`https://wa.me/${supportWhats.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Preciso de ajuda para acessar o Zappfy.")}`}
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
      )}
    </div>
  );
}
