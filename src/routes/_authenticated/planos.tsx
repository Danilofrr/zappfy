import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles, ArrowLeft, CreditCard, ShieldCheck, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/planos")({
  component: PlansPage,
});

type Plan = {
  id: "mensal" | "trimestral" | "anual";
  name: string;
  badge?: string;
  price: string;
  priceSuffix: string;
  caption?: string;
  subCaption?: string;
  highlight?: boolean;
  link: string;
  cta: string;
};

const PLANS: Plan[] = [
  {
    id: "mensal",
    name: "Mensal",
    price: "R$ 69,90",
    priceSuffix: "/mês",
    caption: "Flexibilidade total · Cancele quando quiser",
    link: "https://pay.kiwify.com.br/vQT87OV",
    cta: "Assinar plano mensal",
  },
  {
    id: "trimestral",
    name: "Trimestral",
    price: "R$ 149,90",
    priceSuffix: "/trimestre",
    caption: "R$ 149,90 a cada 3 meses · Economize 25%",
    link: "https://pay.kiwify.com.br/GBDQRTd",
    cta: "Assinar plano trimestral",
  },
  {
    id: "anual",
    name: "Anual",
    badge: "Melhor custo-benefício",
    price: "R$ 27,90",
    priceSuffix: "/mês",
    caption: "R$ 334,90 no ano · Economize 60%",
    highlight: true,
    link: "https://pay.kiwify.com.br/zhZzzmL",
    cta: "Assinar plano anual",
  },
];

const FEATURES = [
  "Acesso completo ao Zappfy",
  "Pedidos, checkout e rastreamento ilimitados",
  "App de entregas para motoboys",
  "Relatórios, DRE e indicadores",
  "Suporte por WhatsApp",
  "Atualizações e novos recursos inclusos",
];

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

        <p className="text-center text-xs text-muted-foreground mt-8">
          Aceitamos cartão de crédito
        </p>
      </div>
    </AppShell>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={cn(
        "relative h-full rounded-2xl border-2 bg-card p-6 flex flex-col transition-all",
        plan.highlight
          ? "border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15),0_20px_50px_-15px_hsl(var(--primary)/0.45)]"
          : "border-primary/40 shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.25)] hover:border-primary/70 hover:shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.4)]",
      )}
    >
      {plan.badge && (
        <div
          className={cn(
            "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap",
            "bg-primary text-primary-foreground shadow-md shadow-primary/40",
          )}
        >
          {plan.badge}
        </div>
      )}

      <div className="mb-4">
        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {plan.name}
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
          <span className="text-sm text-muted-foreground">{plan.priceSuffix}</span>
        </div>
        {plan.caption && (
          <div
            className={cn(
              "mt-1 text-xs",
              plan.highlight ? "text-primary font-semibold" : "text-muted-foreground",
            )}
          >
            {plan.caption}
          </div>
        )}
      </div>

      <ul className="space-y-2 mb-6 flex-1">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span className="text-foreground/90">{f}</span>
          </li>
        ))}
      </ul>

      <a
        href={plan.link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all hover:scale-[1.02] bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30"
      >
        {plan.cta}
      </a>
    </div>
  );
}

