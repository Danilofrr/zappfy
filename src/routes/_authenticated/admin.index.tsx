import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { StatCard } from "@/components/AppShell";
import { getAdminDashboard } from "@/lib/admin.functions";
import { useStore } from "@/lib/store";
import { brl } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  Ban,
  Clock,
  Wallet,
  TrendingUp,
  UserPlus,
  CalendarClock,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { ComponentType } from "react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Zappfy" }] }),
  component: AdminDashboard,
});

const CACHE_MS = 5 * 60 * 1000;

function SkeletonStat({ label, icon: Icon }: { label: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground/60" />
      </div>
      <Skeleton className="mt-3 h-8 w-24" />
    </div>
  );
}

function AdminDashboard() {
  const fn = useServerFn(getAdminDashboard);
  const { user } = useStore();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => {
      const t0 = performance.now();
      return fn().finally(() => {
        // eslint-disable-next-line no-console
        console.log(`[admin-dashboard] carregado em ${Math.round(performance.now() - t0)}ms`);
      });
    },
    staleTime: CACHE_MS,
    gcTime: CACHE_MS,
    refetchOnWindowFocus: false,
  });

  const cards: Array<{ label: string; icon: ComponentType<{ className?: string }>; value?: string; tone?: "success" | "warning" | "danger"; hint?: string }> = [
    { label: "Total de clientes", icon: Users, value: data && String(data.total) },
    { label: "Clientes ativos", icon: ShieldCheck, tone: "success", value: data && String(data.ativos) },
    { label: "Em teste grátis", icon: Clock, value: data && String(data.teste) },
    { label: "Pendentes", icon: AlertTriangle, tone: "warning", value: data && String(data.pendentes) },
    { label: "Vencidos", icon: AlertTriangle, tone: "danger", value: data && String(data.vencidos) },
    { label: "Bloqueados", icon: Ban, tone: "danger", value: data && String(data.bloqueados) },
    { label: "MRR", icon: Wallet, tone: "success", hint: "Receita mensal recorrente", value: data && brl(data.mrr) },
    { label: "Receita anual", icon: TrendingUp, tone: "success", value: data && brl(data.arr) },
    { label: "Novos este mês", icon: UserPlus, value: data && String(data.novosMes) },
    { label: "Vencendo em 7 dias", icon: CalendarClock, tone: "warning", value: data && String(data.proximosVencer) },
  ];

  return (
    <AdminShell title="Painel Master" subtitle="Visão geral do Zappfy">
      <div className="mb-6 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold">Bem-vindo{user?.email ? `, ${user.email.split("@")[0]}` : ""} 👋</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Aqui está um resumo do Zappfy. Os dados são atualizados em segundo plano e ficam em cache por 5 minutos.
              {isFetching && !isLoading && <span className="ml-2 text-xs">• atualizando…</span>}
            </p>
          </div>
        </div>
      </div>

      {isError && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-destructive">Não foi possível carregar as estatísticas</div>
            <div className="text-muted-foreground">{(error as Error)?.message ?? "Erro desconhecido"}</div>
          </div>
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-secondary"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((c) =>
          isLoading || c.value === undefined ? (
            <SkeletonStat key={c.label} label={c.label} icon={c.icon} />
          ) : (
            <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} tone={c.tone} hint={c.hint} />
          ),
        )}
      </div>
    </AdminShell>
  );
}
