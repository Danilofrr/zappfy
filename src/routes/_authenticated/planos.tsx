import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Sparkles, ArrowLeft } from "lucide-react";
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
  highlight?: boolean;
  link: string;
  cta: string;
};

const PLANS: Plan[] = [
  {
    id: "mensal",
    name: "Mensal",
    price: "R$ 79",
    priceSuffix: "/mês",
    caption: "Cobrança mensal recorrente",
    link: "https://pay.kiwify.com.br/vQT87OV",
    cta: "Assinar plano mensal",
  },
  {
    id: "trimestral",
    name: "Trimestral",
    badge: "Mais escolhido",
    price: "R$ 199",
    priceSuffix: "/trimestre",
    caption: "Equivale a R$ 66,33/mês · economize 16%",
    highlight: true,
    link: "https://pay.kiwify.com.br/GBDQRTd",
    cta: "Assinar plano trimestral",
  },
  {
    id: "anual",
    name: "Anual",
    badge: "Melhor custo-benefício",
    price: "R$ 699",
    priceSuffix: "/ano",
    caption: "Equivale a R$ 58,25/mês · economize 26%",
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

        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Pagamento processado com segurança pela Kiwify · Pix, cartão ou boleto · Cancele quando quiser
        </p>
      </div>
    </AppShell>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border bg-card p-6 flex flex-col shadow-elegant transition-all",
        plan.highlight
          ? "border-primary/60 ring-2 ring-primary/30 lg:scale-[1.03]"
          : "border-border hover:border-primary/40",
      )}
    >
      {plan.badge && (
        <div
          className={cn(
            "absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap",
            plan.highlight
              ? "bg-primary text-primary-foreground"
              : "bg-foreground text-background",
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
          <div className="mt-1 text-xs text-muted-foreground">{plan.caption}</div>
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
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all hover:scale-[1.02]",
          plan.highlight
            ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30"
            : "bg-foreground text-background hover:opacity-90",
        )}
      >
        {plan.cta}
      </a>
    </div>
  );
}
