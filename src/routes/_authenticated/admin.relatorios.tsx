import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { StatCard } from "@/components/AppShell";
import { listClients, listPayments } from "@/lib/admin.functions";
import { brl } from "@/lib/format";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/admin/relatorios")({ component: ReportsPage });

function ReportsPage() {
  const clientsFn = useServerFn(listClients);
  const payFn = useServerFn(listPayments);
  const { data: clients = [] } = useQuery({ queryKey: ["admin-clients"], queryFn: () => clientsFn() });
  const { data: payments = [] } = useQuery({ queryKey: ["admin-payments"], queryFn: () => payFn() });

  const stats = useMemo(() => {
    const ativos = clients.filter((c: any) => c.subscription?.status === "ativo").length;
    const cancelados = clients.filter((c: any) => c.subscription?.status === "vencido" || c.subscription?.status === "bloqueado").length;
    const paid = payments.filter((p: any) => p.status === "pago");
    const totalRecebido = paid.reduce((a: number, p: any) => a + Number(p.amount), 0);
    const ticketMedio = paid.length > 0 ? totalRecebido / paid.length : 0;
    const mrr = clients.filter((c: any) => c.subscription?.status === "ativo").reduce((a: number, c: any) => a + (c.subscription?.priceMonthly ?? 0), 0);
    return { ativos, cancelados, totalRecebido, ticketMedio, mrr, arr: mrr * 12 };
  }, [clients, payments]);

  const byMonth = useMemo(() => {
    const m: Record<string, number> = {};
    payments.filter((p: any) => p.status === "pago").forEach((p: any) => {
      const d = new Date(p.paid_at || p.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      m[k] = (m[k] ?? 0) + Number(p.amount);
    });
    return Object.entries(m).sort().slice(-12).map(([month, total]) => ({ month, total }));
  }, [payments]);

  return (
    <AdminShell title="Relatórios" subtitle="Análise de receita e crescimento">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="MRR" value={brl(stats.mrr)} tone="success" />
        <StatCard label="Receita anual estimada" value={brl(stats.arr)} tone="success" />
        <StatCard label="Total recebido" value={brl(stats.totalRecebido)} />
        <StatCard label="Ticket médio" value={brl(stats.ticketMedio)} />
        <StatCard label="Clientes ativos" value={String(stats.ativos)} />
        <StatCard label="Cancelados/Vencidos" value={String(stats.cancelados)} tone="warning" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-bold mb-4">Receita por mês</h3>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AdminShell>
  );
}
