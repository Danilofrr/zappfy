import { Check, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

export type Plan = {
  id: "mensal" | "trimestral" | "anual";
  name: string;
  badge?: string;
  priceValue: string;
  priceSuffix: string;
  pills: string[];
  highlight?: boolean;
  link: string;
  cta: string;
  features: string[];
  footnote?: string;
};

const MENSAL_FEATURES = [
  "Dashboard + DRE completo",
  "Vendas online e física",
  "Gestão de gastos e estoque",
  "Caixa & Dívidas automático",
  "Impressão de etiquetas e recibos",
  "App de entregas para motoboys",
  "Suporte via WhatsApp",
];

export const PLANS: Plan[] = [
  {
    id: "mensal",
    name: "Mensal",
    priceValue: "69,90",
    priceSuffix: "/mês",
    pills: ["Flexibilidade total · Cancele quando quiser"],
    link: "https://pay.kiwify.com.br/vQT87OV",
    cta: "Quero esse plano",
    features: MENSAL_FEATURES,
    footnote: "Sem fidelidade · Cancele quando quiser",
  },
  {
    id: "trimestral",
    name: "Trimestral",
    badge: "Mais escolhido",
    priceValue: "149,90",
    priceSuffix: "/trimestre",
    pills: ["R$ 149,90 a cada 3 meses · Economize 25%"],
    link: "https://pay.kiwify.com.br/GBDQRTd",
    cta: "Quero esse plano",
    features: [
      "Tudo do plano Mensal",
      "Economia de quase 30% em 3 meses",
      "Cobrança única trimestral",
      "Sem surpresas no cartão",
      "Renovação simples",
      "Suporte prioritário",
    ],
    footnote: "Sem fidelidade · Cancele quando quiser",
  },
  {
    id: "anual",
    name: "Anual",
    badge: "Melhor valor",
    priceValue: "34,65",
    priceSuffix: "/mês",
    pills: [
      "12x de R$ 34,65 ou R$ 334,90 à vista",
      "Economize R$ 503,90/ano",
    ],
    highlight: true,
    link: "https://pay.kiwify.com.br/zhZzzmL",
    cta: "Quero economizar",
    features: [
      "Tudo do plano Mensal",
      "Economia de mais de 60%",
      "Cobrança única anual",
      "Trava seu preço por 12 meses",
      "Suporte prioritário VIP",
      "Onboarding personalizado",
    ],
    footnote: "Sem fidelidade · Cancele quando quiser",
  },
];

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div className="relative h-full">
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-md shadow-primary/40 whitespace-nowrap">
          <Leaf className="h-3 w-3" />
          {plan.badge}
        </div>
      )}

      <div
        className={cn(
          "relative h-full rounded-2xl border bg-card p-6 flex flex-col transition-all",
          plan.highlight
            ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.6),0_0_40px_-4px_hsl(var(--primary)/0.55)]"
            : "border-border/60 hover:border-primary/40",
        )}
      >
        <div className="text-sm font-semibold text-foreground/90 mb-4">
          {plan.name}
        </div>

        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-base text-muted-foreground font-medium">R$</span>
          <span className="text-5xl font-bold tracking-tight leading-none">
            {plan.priceValue}
          </span>
          {plan.priceSuffix && (
            <span className="text-sm text-muted-foreground">{plan.priceSuffix}</span>
          )}
        </div>

        <div className="mt-3 flex flex-col items-start gap-2">
          {plan.pills.map((p) => (
            <span
              key={p}
              className="inline-block rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[12px] font-medium text-primary"
            >
              {p}
            </span>
          ))}
        </div>

        <ul className="mt-6 space-y-2.5 mb-6 flex-1">
          {plan.features.map((f) => (
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
          className="inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-all hover:scale-[1.02] bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30"
        >
          {plan.cta}
        </a>

        {plan.footnote && (
          <div className="mt-3 text-center text-[11px] text-muted-foreground">
            {plan.footnote}
          </div>
        )}
      </div>
    </div>
  );
}
