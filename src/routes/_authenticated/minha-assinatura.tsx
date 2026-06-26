import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Crown,
  Calendar,
  RefreshCw,
  XCircle,
  Sparkles,
  ShieldCheck,
  ArrowUpRight,
  Receipt,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getMySubscription, requestSubscriptionCancellation } from "@/lib/admin.functions";
import { brl } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/minha-assinatura")({
  component: MySubPage,
});

const statusMeta: Record<
  string,
  { label: string; color: string; icon: any; dot: string }
> = {
  ativo: {
    label: "Ativa",
    color: "bg-green-500/15 text-green-500 border-green-500/30",
    icon: CheckCircle2,
    dot: "bg-green-500",
  },
  teste: {
    label: "Período de teste",
    color: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    icon: Sparkles,
    dot: "bg-blue-500",
  },
  pendente: {
    label: "Pagamento pendente",
    color: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
    icon: Clock,
    dot: "bg-yellow-500",
  },
  vencido: {
    label: "Vencida",
    color: "bg-orange-500/15 text-orange-500 border-orange-500/30",
    icon: AlertTriangle,
    dot: "bg-orange-500",
  },
  bloqueado: {
    label: "Bloqueada",
    color: "bg-red-500/15 text-red-500 border-red-500/30",
    icon: XCircle,
    dot: "bg-red-500",
  },
};

const paymentStatusColors: Record<string, string> = {
  pago: "bg-green-500/15 text-green-500 border-green-500/30",
  pendente: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  falhou: "bg-red-500/15 text-red-500 border-red-500/30",
  estornado: "bg-orange-500/15 text-orange-500 border-orange-500/30",
};

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
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

/**
 * Calcula a próxima data de renovação com base no ciclo do plano.
 * Usa expires_at se já estiver no futuro e coerente; caso contrário,
 * projeta a partir de started_at somando o intervalo do ciclo até passar de hoje.
 */
function computeNextRenewal(
  expiresAt: string | null | undefined,
  startedAt: string | null | undefined,
  cycle: string | null | undefined,
): Date | null {
  const now = new Date();
  const months = cycleMonths(cycle);

  // Se expires_at está no futuro, confiamos nele (Kiwify atualiza a cada renovação)
  if (expiresAt) {
    const exp = new Date(expiresAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() > now.getTime()) {
      return exp;
    }
  }

  // Caso contrário, projetamos a partir de started_at
  if (startedAt) {
    const start = new Date(startedAt);
    if (!Number.isNaN(start.getTime())) {
      const next = new Date(start);
      // Avança em blocos do ciclo até ultrapassar agora
      while (next.getTime() <= now.getTime()) {
        next.setMonth(next.getMonth() + months);
      }
      return next;
    }
  }

  // Última opção: hoje + ciclo
  const fallback = new Date(now);
  fallback.setMonth(fallback.getMonth() + months);
  return fallback;
}

function MySubPage() {
  const fn = useServerFn(getMySubscription);
  const cancelFn = useServerFn(requestSubscriptionCancellation);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-sub"],
    queryFn: () => fn(),
  });

  const sub = data?.subscription as any;
  const payments = (data?.payments ?? []) as any[];

  const status: string = sub?.status ?? "teste";
  const meta = statusMeta[status] ?? statusMeta.teste;
  const StatusIcon = meta.icon;

  const planName: string = sub?.plans?.name ?? "Plano Zappfy";
  const planPrice: number = Number(sub?.plans?.price_monthly ?? 0);
  const isTrial = status === "teste";
  const isActive = status === "ativo";
  const isExpired = status === "vencido" || status === "bloqueado";
  const cancelAlreadyRequested = Boolean(
    sub?.notes && /CANCELAMENTO SOLICITADO/i.test(String(sub.notes)),
  );

  const trialDays = daysUntil(sub?.trial_ends_at);
  const nextRenewal = isActive
    ? computeNextRenewal(sub?.expires_at, sub?.started_at, sub?.billing_cycle)
    : null;
  const renewalDays = nextRenewal
    ? Math.ceil((nextRenewal.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const expDays = daysUntil(sub?.expires_at);
  const daysLeft = isTrial ? trialDays : isActive ? renewalDays : expDays;


  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cancelMut = useMutation({
    mutationFn: (r: string) => cancelFn({ data: { reason: r } }),
    onSuccess: () => {
      toast.success("Solicitação de cancelamento enviada. Nossa equipe entrará em contato.");
      setCancelOpen(false);
      setReason("");
      qc.invalidateQueries({ queryKey: ["my-sub"] });
      qc.invalidateQueries({ queryKey: ["my-sub-status"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao solicitar cancelamento"),
  });

  return (
    <AppShell
      title="Minha Assinatura"
      subtitle="Gerencie seu plano, pagamentos e renovações"
    >
      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <div className="space-y-6">
          {/* Hero card — status atual */}
          <Card
            className={cn(
              "overflow-hidden border-2 relative",
              isActive
                ? "border-primary/40"
                : isExpired
                ? "border-orange-500/40"
                : "border-blue-500/30",
            )}
          >
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-50"
              style={{
                background: isActive
                  ? "radial-gradient(60% 80% at 0% 0%, hsl(var(--primary) / 0.12), transparent 70%)"
                  : isExpired
                  ? "radial-gradient(60% 80% at 0% 0%, rgba(249,115,22,0.12), transparent 70%)"
                  : "radial-gradient(60% 80% at 0% 0%, rgba(59,130,246,0.12), transparent 70%)",
              }}
            />
            <CardContent className="p-6 lg:p-8 relative">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <Badge variant="outline" className={cn("text-xs px-2.5 py-0.5", meta.color)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full mr-1.5", meta.dot)} />
                      {meta.label}
                    </Badge>
                    {cancelAlreadyRequested && (
                      <Badge variant="outline" className="bg-orange-500/15 text-orange-500 border-orange-500/30 text-xs">
                        Cancelamento solicitado
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Crown className="h-6 w-6 text-primary" />
                    {planName}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isActive
                      ? `Você tem acesso completo ao Zappfy${planPrice ? ` por ${brl(planPrice)}/mês equivalente` : ""}.`
                      : isTrial
                      ? "Aproveite seu período de teste gratuito."
                      : isExpired
                      ? "Sua assinatura expirou. Renove para continuar usando o Zappfy."
                      : "Detalhes da sua assinatura."}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  {(isTrial || isExpired || !sub) && (
                    <Button asChild className="bg-primary hover:bg-primary/90">
                      <Link to="/planos">
                        <Sparkles className="h-4 w-4" />
                        Assinar agora
                      </Link>
                    </Button>
                  )}
                  {isActive && (
                    <>
                      <Button asChild variant="outline">
                        <Link to="/planos">
                          <ArrowUpRight className="h-4 w-4" />
                          Mudar de plano
                        </Link>
                      </Button>
                      {!cancelAlreadyRequested && (
                        <Button
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => setCancelOpen(true)}
                        >
                          <XCircle className="h-4 w-4" />
                          Cancelar assinatura
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Grid de detalhes */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-border/60">
                <DetailItem
                  icon={StatusIcon}
                  label="Status"
                  value={meta.label}
                />
                <DetailItem
                  icon={RefreshCw}
                  label="Ciclo de cobrança"
                  value={cycleLabel(sub?.billing_cycle)}
                />
                <DetailItem
                  icon={Calendar}
                  label={isTrial ? "Trial termina em" : isActive ? "Próxima renovação" : "Expirou em"}
                  value={
                    isTrial && sub?.trial_ends_at
                      ? new Date(sub.trial_ends_at).toLocaleDateString("pt-BR")
                      : sub?.expires_at
                      ? new Date(sub.expires_at).toLocaleDateString("pt-BR")
                      : "—"
                  }
                  highlight={
                    daysLeft !== null && daysLeft >= 0
                      ? `${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`
                      : undefined
                  }
                  highlightColor={
                    daysLeft !== null && daysLeft <= 3
                      ? "text-orange-500"
                      : "text-primary"
                  }
                />
                <DetailItem
                  icon={CreditCard}
                  label="Assinante desde"
                  value={
                    sub?.started_at
                      ? new Date(sub.started_at).toLocaleDateString("pt-BR")
                      : "—"
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Sem assinatura — destaque CTA */}
          {!sub && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-bold text-lg">Você ainda não tem uma assinatura ativa</h3>
                  <p className="text-sm text-muted-foreground">
                    Escolha um plano e libere todos os recursos do Zappfy.
                  </p>
                </div>
                <Button asChild>
                  <Link to="/planos">
                    <Sparkles className="h-4 w-4" />
                    Ver planos
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Histórico de pagamentos */}
          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">Histórico de pagamentos</h3>
                </div>
                <span className="text-xs text-muted-foreground">
                  {payments.length} {payments.length === 1 ? "registro" : "registros"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left p-3">Data</th>
                      <th className="text-left p-3">Valor</th>
                      <th className="text-left p-3">Método</th>
                      <th className="text-left p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: any) => (
                      <tr key={p.id} className="border-t border-border">
                        <td className="p-3 text-xs whitespace-nowrap">
                          {new Date(p.paid_at ?? p.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-3 font-semibold">{brl(Number(p.amount))}</td>
                        <td className="p-3 capitalize">{p.method ?? "—"}</td>
                        <td className="p-3">
                          <Badge
                            variant="outline"
                            className={
                              paymentStatusColors[p.status] ??
                              "bg-muted text-muted-foreground"
                            }
                          >
                            {p.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {payments.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-8 text-center text-muted-foreground text-sm"
                        >
                          Nenhum pagamento registrado ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Selo de segurança */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Pagamentos processados de forma segura pela Kiwify
          </div>
        </div>
      )}

      {/* Modal de cancelamento */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Cancelar assinatura
            </DialogTitle>
            <DialogDescription>
              Ao confirmar, sua solicitação será registrada e nossa equipe processará o
              cancelamento. Seu acesso continua disponível até{" "}
              <strong>
                {sub?.expires_at
                  ? new Date(sub.expires_at).toLocaleDateString("pt-BR")
                  : "o fim do período pago"}
              </strong>
              . Seus dados são preservados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo (opcional)</label>
            <Textarea
              placeholder="Conte rapidamente o motivo do cancelamento..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={cancelMut.isPending}
              onClick={() => cancelMut.mutate(reason)}
            >
              {cancelMut.isPending ? "Enviando..." : "Confirmar cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
  highlight,
  highlightColor = "text-primary",
}: {
  icon: any;
  label: string;
  value: string;
  highlight?: string;
  highlightColor?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="font-semibold text-sm">{value}</div>
      {highlight && (
        <div className={cn("text-xs font-bold mt-0.5", highlightColor)}>{highlight}</div>
      )}
    </div>
  );
}
