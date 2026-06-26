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

function cycleMonths(cycle: string | null | undefined): number {
  switch (cycle) {
    case "yearly":
      return 12;
    case "quarterly":
      return 3;
    case "monthly":
    default:
      return 1;
  }
}

function computeNextRenewal(
  expiresAt: string | null | undefined,
  startedAt: string | null | undefined,
  cycle: string | null | undefined,
): Date | null {
  const now = new Date();
  const months = cycleMonths(cycle);
  if (expiresAt) {
    const exp = new Date(expiresAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() > now.getTime()) return exp;
  }
  if (startedAt) {
    const start = new Date(startedAt);
    if (!Number.isNaN(start.getTime())) {
      const next = new Date(start);
      while (next.getTime() <= now.getTime()) next.setMonth(next.getMonth() + months);
      return next;
    }
  }
  const fb = new Date(now);
  fb.setMonth(fb.getMonth() + months);
  return fb;
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
  const nextRenewal = computeNextRenewal(
    sub?.expires_at,
    sub?.started_at,
    sub?.billing_cycle,
  );
  const nextRenewalLabel = nextRenewal
    ? nextRenewal.toLocaleDateString("pt-BR")
    : null;




  const isActive = status === "ativo";
  const isTrial = status === "teste" || (!sub && trialDays === null);
  const isExpired = status === "vencido" || status === "bloqueado" || (trialDays !== null && trialDays <= 0 && !isActive);
  const isPending = status === "pendente";

  // Days to show
  const daysLeft = isTrial ? trialDays : isActive ? expDays : null;
  const urgent = daysLeft !== null && daysLeft <= 1 && !isActive;
  // Trial color tier: 7-4 green, 3-2 amber, 1 red
  const trialTier: "green" | "amber" | "red" | null =
    isTrial && daysLeft !== null && daysLeft > 0
      ? daysLeft >= 4
        ? "green"
        : daysLeft >= 2
        ? "amber"
        : "red"
      : null;

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
              ? nextRenewalLabel
                ? `Próxima renovação: ${nextRenewalLabel}`
                : `${brl(planPrice)}/mês`
              : isExpired
              ? "Assine para continuar usando o Zappfy sem interrupções."
              : `Aproveite todos os recursos. Depois, ${brl(planPrice)}/mês.`}
          </div>
        </div>

        {!isActive && (
          <Link
            to="/planos"
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-lg transition-all hover:scale-[1.02] shrink-0",
              urgent || isExpired
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "bg-gradient-to-r from-amber-400 to-yellow-500 text-black hover:from-amber-300 hover:to-yellow-400",
            )}
          >
            <Crown className="h-4 w-4" />
            Assinar plano
          </Link>
        )}
      </div>
    );
  }

  // ===== Sidebar variant (compact) =====
  const tierClass = (g: string, a: string, r: string, fallback: string) =>
    trialTier === "green" ? g : trialTier === "amber" ? a : trialTier === "red" ? r : fallback;

  return (
    <div
      className={cn(
        "rounded-lg border px-2.5 py-2",
        isActive
          ? "border-primary/30 bg-primary/5"
          : isExpired
          ? "border-red-500/40 bg-red-500/5"
          : tierClass(
              "border-green-500/30 bg-green-500/5",
              "border-amber-500/30 bg-amber-500/5",
              "border-red-500/40 bg-red-500/5",
              "border-amber-500/30 bg-amber-500/5",
            ),
      )}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
        {isActive ? (
          <>
            <CheckCircle2 className="h-3 w-3 text-primary" />
            <span className="text-primary">Plano ativo</span>
          </>
        ) : isExpired ? (
          <>
            <AlertTriangle className="h-3 w-3 text-red-500" />
            <span className="text-red-500">Trial expirado</span>
          </>
        ) : (
          <>
            <Clock
              className={cn(
                "h-3 w-3",
                tierClass("text-green-500", "text-amber-500", "text-red-500", "text-amber-500"),
              )}
            />
            <span
              className={tierClass(
                "text-green-500",
                "text-amber-500",
                "text-red-500",
                "text-amber-500",
              )}
            >
              Teste grátis
            </span>
          </>
        )}
      </div>

      {isActive ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
          <span className="font-semibold text-foreground">{planName}</span>
          {nextRenewalLabel && (
            <> · Renova em {nextRenewalLabel}</>
          )}
        </div>
      ) : (
        <>
          {daysLeft !== null && daysLeft > 0 && !isExpired && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              <span
                className={cn(
                  "font-bold",
                  tierClass("text-green-500", "text-amber-500", "text-red-500", "text-foreground"),
                )}
              >
                {daysLeft}
              </span>{" "}
              {daysLeft === 1 ? "dia restante" : "dias restantes"}
            </div>
          )}
          {isExpired && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Assine para liberar os recursos.
            </div>
          )}
          <Link
            to="/planos"
            className={cn(
              "mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-bold shadow-sm transition-all hover:scale-[1.02]",
              isExpired || trialTier === "red"
                ? "bg-red-500 text-white hover:bg-red-600"
                : trialTier === "amber"
                ? "bg-amber-500 text-black hover:bg-amber-400"
                : "bg-gradient-to-r from-amber-400 to-yellow-500 text-black hover:from-amber-300 hover:to-yellow-400",
            )}
          >
            <Sparkles className="h-3 w-3" />
            Assinar plano
          </Link>
        </>
      )}
    </div>
  );
}
