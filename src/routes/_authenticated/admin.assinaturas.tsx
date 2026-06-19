import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { listClients } from "@/lib/admin.functions";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/assinaturas")({ component: SubsPage });

const statusColors: Record<string, string> = {
  ativo: "bg-green-500/15 text-green-500 border-green-500/30",
  teste: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  pendente: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  vencido: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  bloqueado: "bg-red-500/15 text-red-500 border-red-500/30",
};

function SubsPage() {
  const fn = useServerFn(listClients);
  const { data: clients = [], isLoading } = useQuery({ queryKey: ["admin-clients"], queryFn: () => fn() });
  const withSub = clients.filter((c: any) => c.subscription);
  return (
    <AdminShell title="Assinaturas" subtitle="Visão consolidada de todas as assinaturas">
      {isLoading ? <div className="text-muted-foreground">Carregando...</div> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left p-3">Cliente</th><th className="text-left p-3">Plano</th><th className="text-left p-3">Status</th><th className="text-left p-3">Iniciada</th><th className="text-left p-3">Vencimento</th></tr>
            </thead>
            <tbody>
              {withSub.map((c: any) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3"><div className="font-medium">{c.fullName}</div><div className="text-xs text-muted-foreground">{c.email}</div></td>
                  <td className="p-3">{c.subscription.planName || "—"}</td>
                  <td className="p-3"><Badge variant="outline" className={statusColors[c.subscription.status]}>{c.subscription.status}</Badge></td>
                  <td className="p-3 text-xs">{new Date(c.subscription.startedAt).toLocaleDateString("pt-BR")}</td>
                  <td className="p-3 text-xs">{c.subscription.expiresAt ? new Date(c.subscription.expiresAt).toLocaleDateString("pt-BR") : "—"}</td>
                </tr>
              ))}
              {withSub.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhuma assinatura. <Link to="/admin/clientes" className="text-primary">Criar cliente</Link></td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
