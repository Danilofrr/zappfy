import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell, StatCard } from "@/components/AppShell";
import { getMySubscription } from "@/lib/admin.functions";
import { brl } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/minha-assinatura")({ component: MySubPage });

const statusColors: Record<string, string> = {
  ativo: "bg-green-500/15 text-green-500 border-green-500/30",
  teste: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  pendente: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  vencido: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  bloqueado: "bg-red-500/15 text-red-500 border-red-500/30",
};

function MySubPage() {
  const fn = useServerFn(getMySubscription);
  const { data, isLoading } = useQuery({ queryKey: ["my-sub"], queryFn: () => fn() });
  const sub = data?.subscription as any;
  const payments = data?.payments ?? [];
  return (
    <AppShell title="Minha Assinatura" subtitle="Plano, vencimento e histórico de pagamentos">
      {isLoading ? <div className="text-muted-foreground">Carregando...</div> : !sub ? <div className="text-muted-foreground">Sem assinatura ativa</div> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatCard label="Plano" value={sub.plans?.name ?? "—"} />
            <StatCard label="Status" value={sub.status} />
            <StatCard label="Vence em" value={sub.expires_at ? new Date(sub.expires_at).toLocaleDateString("pt-BR") : "—"} />
          </div>
          <h3 className="font-bold mb-3">Histórico de pagamentos</h3>
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left p-3">Data</th><th className="text-left p-3">Valor</th><th className="text-left p-3">Método</th><th className="text-left p-3">Status</th></tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3 text-xs">{new Date(p.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="p-3 font-medium">{brl(Number(p.amount))}</td>
                    <td className="p-3 capitalize">{p.method}</td>
                    <td className="p-3"><Badge variant="outline" className={statusColors[p.status]}>{p.status}</Badge></td>
                  </tr>
                ))}
                {payments.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum pagamento</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
