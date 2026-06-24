import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Gift, CheckCircle2, Loader2, Zap, BarChart3, ShieldCheck } from "lucide-react";
import { getTrialInviteInfo, redeemTrialInvite } from "@/lib/trial.functions";
import { validatePassword, PASSWORD_HINT } from "@/lib/password-policy";

export const Route = createFileRoute("/trial/$code")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Teste grátis no Zappfy — ${params.code}` },
      { name: "description", content: "Ative seu período gratuito e gerencie sua loja com o Zappfy." },
    ],
  }),
  component: TrialPage,
});

function TrialPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const infoFn = useServerFn(getTrialInviteInfo);
  const redeemFn = useServerFn(redeemTrialInvite);

  const [info, setInfo] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [fullName, setFullName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    infoFn({ data: { code } })
      .then((r) => setInfo(r))
      .catch(() => setInfo({ valid: false, reason: "error" }))
      .finally(() => setChecking(false));
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !storeName || !email) {
      toast.error("Preencha todos os campos.");
      return;
    }
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.ok) { toast.error(pwdCheck.error); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, store_name: storeName } },
      });
      if (error) throw error;
      if (!data.session) {
        // Email confirmation required
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
        navigate({ to: "/auth" });
        return;
      }
      await redeemFn({ data: { code } });
      toast.success(`Trial de ${info.trial_days} dias ativado!`);
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!info?.valid) {
    return (
      <div className="min-h-screen grid place-items-center bg-background px-4">
        <div className="max-w-md w-full text-center rounded-2xl border border-border bg-card p-8">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-destructive/15 text-destructive mx-auto mb-4">
            <Gift className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold mb-2">Convite indisponível</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {info?.reason === "expired"
              ? "Este link de teste expirou."
              : info?.reason === "revoked"
              ? "Este link foi revogado."
              : "Este link não foi encontrado."}
          </p>
          <Link to="/auth">
            <Button variant="outline">Ir para login</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-12 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold mb-4">
            <Gift className="h-3.5 w-3.5" />
            Convite exclusivo
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Teste o Zappfy grátis por{" "}
            <span className="text-primary">{info.trial_days} dias</span>
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            Tudo que você precisa para gerenciar sua loja, pedidos e entregas em um só lugar.
            Sem cartão de crédito.
          </p>
          <ul className="space-y-3 text-sm">
            {[
              { icon: Zap, text: "Checkout otimizado e link para WhatsApp" },
              { icon: BarChart3, text: "Painel completo de vendas e lucro" },
              { icon: ShieldCheck, text: "Rastreamento em tempo real do entregador" },
              { icon: CheckCircle2, text: `${info.trial_days} dias completos, sem cobrança` },
            ].map((b, i) => (
              <li key={i} className="flex items-center gap-3">
                <b.icon className="h-5 w-5 text-primary shrink-0" />
                <span>{b.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-elegant"
        >
          <div className="mb-4">
            <h2 className="text-xl font-bold">Crie sua conta</h2>
            <p className="text-sm text-muted-foreground">
              Código: <span className="font-mono font-bold text-primary">{code.toUpperCase()}</span>
            </p>
          </div>
          <div className="space-y-3">
            <div className="grid gap-1">
              <Label>Seu nome</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="grid gap-1">
              <Label>Nome da loja</Label>
              <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Minha Loja" />
            </div>
            <div className="grid gap-1">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
            </div>
            <div className="grid gap-1">
              <Label>Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
          <Button type="submit" className="w-full mt-5" disabled={loading} size="lg">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Gift className="h-4 w-4 mr-2" />}
            Ativar meus {info.trial_days} dias grátis
          </Button>
          <p className="mt-3 text-xs text-center text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/auth" className="text-primary font-medium">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
