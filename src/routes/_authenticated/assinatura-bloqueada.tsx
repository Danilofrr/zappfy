import { createFileRoute } from "@tanstack/react-router";
import { Lock, Check, Sparkles, LogOut, CreditCard, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PLANS, PlanCard } from "@/components/PlanCards";

export const Route = createFileRoute("/_authenticated/assinatura-bloqueada")({
  component: BlockedPage,
});

function BlockedPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.18), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 py-10 lg:py-16">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 text-destructive" />
            Acesso pausado
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>

        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Seus dados estão seguros — escolha um plano para continuar
          </div>
          <h1 className="text-3xl lg:text-5xl font-bold tracking-tight">
            Seu período de teste{" "}
            <span className="text-primary">terminou</span>
          </h1>
          <p className="mt-4 text-muted-foreground text-base lg:text-lg">
            Tudo o que você cadastrou continua salvo. Assine um dos planos abaixo
            e volte a usar o Zappfy <strong className="text-foreground">na hora</strong> —
            a liberação é automática após o pagamento.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3 items-stretch">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>

        <TrustRow />
      </div>
    </div>
  );
}

function TrustRow() {
  const items = [
    { icon: CreditCard, label: "Aceitamos Cartão" },
    { icon: ShieldCheck, label: "Pagamento Seguro" },
    { icon: XCircle, label: "Cancele quando quiser" },
  ];
  return (
    <div className={cn("mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-6")}>
      {items.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-foreground/90"
        >
          <Icon className="h-4 w-4 text-primary" />
          {label}
        </div>
      ))}
    </div>
  );
}
