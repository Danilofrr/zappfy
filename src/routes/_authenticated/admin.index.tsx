import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { StatCard } from "@/components/AppShell";
import { getAdminDashboard } from "@/lib/admin.functions";
import { brl } from "@/lib/format";
import { Users, ShieldCheck, AlertTriangle, Ban, Clock, Wallet, TrendingUp, UserPlus, CalendarClock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({ meta: [{ title: "Admin — Zappfy" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const fn = useServerFn(getAdminDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => fn() });
  const d = data ?? { total: 0, ativos: 0, teste: 0, vencidos: 0, bloqueados: 0, pendentes: 0, mrr: 0, arr: 0, novosMes: 0, proximosVencer: 0 };
  return (
    <AdminShell title="Painel Master" subtitle="Visão geral do Zappfy">
      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard label="Total de clientes" value={String(d.total)} icon={Users} />
          <StatCard label="Clientes ativos" value={String(d.ativos)} icon={ShieldCheck} tone="success" />
          <StatCard label="Em teste grátis" value={String(d.teste)} icon={Clock} />
          <StatCard label="Pendentes" value={String(d.pendentes)} icon={AlertTriangle} tone="warning" />
          <StatCard label="Vencidos" value={String(d.vencidos)} icon={AlertTriangle} tone="danger" />
          <StatCard label="Bloqueados" value={String(d.bloqueados)} icon={Ban} tone="danger" />
          <StatCard label="MRR" value={brl(d.mrr)} icon={Wallet} tone="success" hint="Receita mensal recorrente" />
          <StatCard label="Receita anual" value={brl(d.arr)} icon={TrendingUp} tone="success" />
          <StatCard label="Novos este mês" value={String(d.novosMes)} icon={UserPlus} />
          <StatCard label="Vencendo em 7 dias" value={String(d.proximosVencer)} icon={CalendarClock} tone="warning" />
        </div>
      )}
    </AdminShell>
  );
}
