import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Clock, Crown, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { getMySubscription } from "@/lib/admin.functions";
import { cn } from "@/lib/utils";
import { brl } from "@/lib/format";

type Variant = "sidebar" | "banner";

function daysBetween(target: string | null | undefined): number | null {
  if (!target) return null;
  const ms = new Date(target).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function SubscriptionStatusCard({
  variant = "sidebar",
  collapsedHidden = false,
}: {
  variant?: Variant;
  /** Hide content (keep only the CTA icon) when collapsed sidebar. */
  collapsedHidden?: boolean;
}) {
  const fn = useServerFn(getMySubscription);
  const { data } = useQuery({
    queryKey: ["my-sub-status"],
    queryFn: () => fn(),
    staleTime: 60_000,
  });

  const sub = (data?.subscription ?? null) as any;
  const status: string = sub?.status ?? "teste";
  const plan = sub?.plans ?? null;
  const planName: string = plan?.name ?? "Zappfy Pro";
  const planPrice: number = Number(plan?.price_monthly ?? 79);

  // Compute trial / expiration days
  const trialDays = daysBetween(sub?.trial_ends_at);
  const expDays = daysBetween(sub?.expires_at);

  const isActive = status === "ativo";
  const isTrial = status === "teste" || (!sub && trialDays === null);
  const isExpired = status === "vencido" || status === "bloqueado" || (trialDays !== null && trialDays <= 0 && !isActive);
  const isPending = status === "pendente";

  // Days to show
  const daysLeft = isTrial ? trialDays : isActive ? expDays : null;
  const urgent = daysLeft !== null && daysLeft <= 1 && !isActive;

  // ===== Banner variant (dashboard top) =====
  if (variant === "banner") {
    return (
      <div
        className={cn(
          "mb-5 rounded-2xl border p-4 lg:p-5 shadow-elegant flex flex-wrap items-center gap-4",
          isActive
            ? "border-primary/40 bg-primary/5"
            : urgent || isExpired
            ? "border-orange-500/50 bg-orange-500/5"
            : "border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent",
        )}
      >
        <div
          className={cn(
            "grid h-12 w-12 place-items-center rounded-xl shrink-0",
            isActive
              ? "bg-primary/20 text-primary"
              : urgent || isExpired
              ? "bg-orange-500/20 text-orange-500"
              : "bg-amber-500/20 text-amber-500",
          )}
        >
          {isActive ? <CheckCircle2 className="h-6 w-6" /> : isExpired ? <AlertTriangle className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">
              {isActive
                ? `Plano ${planName} ativo`
                : isExpired
                ? "Trial expirado"
                : isPending
                ? "Pagamento pendente"
                : "Você está no período de teste grátis"}
            </span>
            {isTrial && daysLeft !== null && daysLeft > 0 && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-bold",
                  urgent ? "bg-orange-500 text-white" : "bg-amber-500 text-black",
                )}
              >
                {daysLeft === 1 ? "1 dia restante" : `${daysLeft} dias restantes`}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {isActive
              ? sub?.expires_at
                ? `Próxima cobrança: ${new Date(sub.expires_at).toLocaleDateString("pt-BR")}`
                : `${brl(planPrice)}/mês`
              : isExpired
              ? "Assine para continuar usando o Zappfy sem interrupções."
              : `Aproveite todos os recursos. Depois, ${brl(planPrice)}/mês.`}
          </div>
        </div>

        {!isActive && (
          <Link
            to="/minha-assinatura"
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-lg transition-all hover:scale-[1.02] shrink-0",
              urgent || isExpired
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-gradient-to-r from-amber-400 to-yellow-500 text-black hover:from-amber-300 hover:to-yellow-400",
            )}
          >
            <Crown className="h-4 w-4" />
            {isExpired ? "Assinar para continuar" : `Assinar ${brl(planPrice)}/mês`}
          </Link>
        )}
      </div>
    );
  }

  // ===== Sidebar variant =====
  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-opacity",
        isActive
          ? "border-primary/40 bg-primary/5"
          : urgent || isExpired
          ? "border-orange-500/50 bg-orange-500/10"
          : "border-amber-500/40 bg-amber-500/10",
        collapsedHidden && "opacity-100 lg:opacity-0 lg:group-hover/sidebar:opacity-100",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
        {isActive ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            <span className="text-primary">Plano ativo</span>
          </>
        ) : isExpired ? (
          <>
            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-orange-500">Trial expirado</span>
          </>
        ) : (
          <>
            <Clock className={cn("h-3.5 w-3.5", urgent ? "text-orange-500" : "text-amber-500")} />
            <span className={cn(urgent ? "text-orange-500" : "text-amber-500")}>Teste grátis</span>
          </>
        )}
      </div>

      {isActive ? (
        <div className="mt-1.5">
          <div className="text-sm font-bold truncate">{planName}</div>
          {sub?.expires_at && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Renova em {new Date(sub.expires_at).toLocaleDateString("pt-BR")}
            </div>
          )}
        </div>
      ) : (
        <>
          {daysLeft !== null && daysLeft > 0 && !isExpired && (
            <div className="mt-1.5">
              <div className={cn("text-2xl font-extrabold leading-none", urgent ? "text-orange-500" : "text-foreground")}>
                {daysLeft}
                <span className="text-xs font-medium text-muted-foreground ml-1">
                  {daysLeft === 1 ? "dia restante" : "dias restantes"}
                </span>
              </div>
            </div>
          )}
          {isExpired && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              Assine para liberar os recursos.
            </div>
          )}
          <Link
            to="/minha-assinatura"
            className={cn(
              "mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold shadow transition-all hover:scale-[1.02]",
              urgent || isExpired
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-gradient-to-r from-amber-400 to-yellow-500 text-black hover:from-amber-300 hover:to-yellow-400",
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isExpired ? "Assinar agora" : `Assinar ${brl(planPrice)}/mês`}
          </Link>
        </>
      )}
    </div>
  );
}
