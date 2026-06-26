import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Plan = {
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
    price: "R$ 69,90",
    priceSuffix: "/mês",
    caption: "Flexibilidade total · Cancele quando quiser",
    link: "https://pay.kiwify.com.br/vQT87OV",
    cta: "Assinar plano mensal",
    features: MENSAL_FEATURES,
    footnote: "Sem fidelidade · Cancele quando quiser",
  },
  {
    id: "trimestral",
    name: "Trimestral",
    price: "R$ 149,90",
    priceSuffix: "/trimestre",
    caption: "R$ 149,90 a cada 3 meses · Economize 25%",
    link: "https://pay.kiwify.com.br/GBDQRTd",
    cta: "Assinar plano trimestral",
    features: [
      "Tudo do plano Mensal",
      "Economia de quase 30% em 3 meses",
      "Cobrança única trimestral",
      "Renovação simples",
      "Suporte prioritário",
    ],
    footnote: "Sem fidelidade · Cancele quando quiser",
  },
  {
    id: "anual",
    name: "Anual",
    badge: "Melhor custo-benefício",
    price: "12x R$ 34,65",
    priceSuffix: "",
    caption: "ou R$ 334,90 à vista",
    subCaption: "Economize mais de 60% no ano",
    highlight: true,
    link: "https://pay.kiwify.com.br/zhZzzmL",
    cta: "Assinar plano anual",
    features: [
      "Tudo do plano Mensal",
      "Economia de mais de 60%",
      "Cobrança única anual",
      "Sem surpresas no cartão",
      "Trava seu preço por 12 meses",
      "Suporte prioritário VIP",
      "Onboarding personalizado",
    ],
    footnote: "Sem fidelidade · Cancele quando quiser",
  },
];

export function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={cn(
        "relative h-full rounded-2xl border-2 bg-card p-6 flex flex-col transition-all",
        plan.highlight
          ? "border-primary animate-neon-pulse"
          : "border-primary/40 shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.25)] hover:border-primary/70 hover:shadow-[0_12px_40px_-12px_hsl(var(--primary)/0.4)]",
      )}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap bg-primary text-primary-foreground shadow-md shadow-primary/40">
          {plan.badge}
        </div>
      )}

      <div className="mb-4">
        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {plan.name}
        </div>
        <div className="mt-2 flex items-baseline gap-1 flex-wrap">
          <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
          {plan.priceSuffix && (
            <span className="text-sm text-muted-foreground">{plan.priceSuffix}</span>
          )}
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
        {plan.subCaption && (
          <div className="mt-0.5 text-[11px] text-primary/80 font-medium">
            {plan.subCaption}
          </div>
        )}
      </div>

      <ul className="space-y-2 mb-6 flex-1">
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
        className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all hover:scale-[1.02] bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30"
      >
        {plan.cta}
      </a>

      {plan.footnote && (
        <div className="mt-3 text-center text-[11px] text-muted-foreground">
          {plan.footnote}
        </div>
      )}
    </div>
  );
}
