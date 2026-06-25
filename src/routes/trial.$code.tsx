import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Gift, Loader2, Zap, Sparkles, ArrowRight } from "lucide-react";
import { getTrialInviteInfo, redeemTrialInvite } from "@/lib/trial.functions";
import { validatePassword } from "@/lib/password-policy";

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
    if (!fullName || !email) {
      toast.error("Preencha nome e e-mail.");
      return;
    }
    const pwdCheck = validatePassword(password);
    if (!pwdCheck.ok) {
      toast.error(pwdCheck.error);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, store_name: storeName || fullName } },
      });
      if (error) throw error;
      if (!data.session) {
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
      <div className="min-h-screen grid place-items-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!info?.valid) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#0a0a0a] px-4">
        <div className="max-w-md w-full text-center rounded-2xl border border-white/10 bg-[#141414] p-8">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-destructive/15 text-destructive mx-auto mb-4">
            <Gift className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold mb-2 text-white">Convite indisponível</h1>
          <p className="text-sm text-white/60 mb-6">
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

  const days = info.trial_days ?? 3;

  return (
    <div className="min-h-screen bg-[#0a0a0a] grid place-items-center px-4 py-10 relative overflow-hidden">
      {/* Glow background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0) 60%), radial-gradient(40% 40% at 80% 80%, rgba(245,158,11,0.10) 0%, transparent 70%)",
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-3xl border border-amber-500/20 bg-[#141414]/95 backdrop-blur-xl p-7 sm:p-8 shadow-[0_30px_80px_-20px_rgba(245,158,11,0.35)]"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="grid place-items-center h-9 w-9 rounded-xl bg-amber-500/15 text-amber-400">
            <Zap className="h-5 w-5" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold text-amber-400 tracking-tight">
            Trial grátis — {days} dias
          </h1>
        </div>
        <p className="text-sm text-white/60 leading-relaxed mb-5">
          Preencha seus dados e receba o acesso por email na hora. Sem cartão de crédito.
        </p>

        <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 mb-6">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-sm font-medium text-amber-300/90">
            Sem cartão · Acesso completo · Login imediato
          </p>
        </div>

        <div className="space-y-4">
          <Field label="Seu nome">
            <DarkInput
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="João Silva"
              autoComplete="name"
            />
          </Field>

          <Field label="Seu email">
            <DarkInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@email.com"
              autoComplete="email"
            />
          </Field>

          <Field label="Senha">
            <DarkInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
            />
          </Field>

          <Field label="Nome da loja (opcional)">
            <DarkInput
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Ex: Loja da Maria"
            />
          </Field>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full mt-6 h-12 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-semibold text-base shadow-[0_10px_30px_-10px_rgba(245,158,11,0.6)]"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <>
              Criar acesso gratuito <ArrowRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>

        <div className="mt-3 text-center">
          <Link
            to="/auth"
            className="text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold tracking-[0.12em] text-white/50 uppercase mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function DarkInput(props: React.ComponentProps<"input">) {
  return (
    <Input
      {...props}
      className="h-11 rounded-xl bg-[#0d0d0d] border-white/10 text-white placeholder:text-white/30 focus-visible:ring-amber-400/40 focus-visible:border-amber-400/40"
    />
  );
}
