import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ArrowLeft, CreditCard, ShieldCheck, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PLANS, PlanCard } from "@/components/PlanCards";

export const Route = createFileRoute("/_authenticated/planos")({
  component: PlansPage,
});

function PlansPage() {
  return (
    <AppShell title="Planos" subtitle="Escolha o plano ideal para sua loja">
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.15), transparent 70%)",
          }}
        />

        <div className="mb-6">
          <Link
            to="/minha-assinatura"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Minha Assinatura
          </Link>
        </div>

        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            Liberação automática após o pagamento
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
            Escolha seu <span className="text-primary">plano Zappfy</span>
          </h1>
          <p className="mt-3 text-muted-foreground text-base">
            Pague de forma segura pela Kiwify e tenha acesso completo na hora.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3 items-stretch">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>

        <TrustRow />
      </div>
    </AppShell>
  );
}

function TrustRow() {
  const items = [
    { icon: CreditCard, label: "Aceitamos Cartão" },
    { icon: ShieldCheck, label: "Pagamento Seguro" },
    { icon: XCircle, label: "Cancele quando quiser" },
  ];
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-6">
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
