import { createFileRoute } from "@tanstack/react-router";
import { Lock, Check, Sparkles, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assinatura-bloqueada")({
  component: BlockedPage,
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

function BlockedPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, hsl(var(--primary) / 0.18), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 py-10 lg:py-16">
        {/* Topo */}
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

        {/* Cabeçalho */}
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

        {/* Planos */}
        <div className="grid gap-5 md:grid-cols-3 items-stretch">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>

        {/* Rodapé */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Pagamento processado com segurança pela Kiwify · Pix, cartão ou boleto · Cancele quando quiser
        </p>
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={cn(
        "relative h-full rounded-2xl border bg-card p-6 flex flex-col shadow-elegant transition-all",
        plan.highlight
          ? "border-primary/60 ring-2 ring-primary/30"
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
