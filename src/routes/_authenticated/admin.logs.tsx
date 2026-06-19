import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminShell } from "@/components/AdminShell";
import { listAccessLogs } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/logs")({ component: LogsPage });

function LogsPage() {
  const fn = useServerFn(listAccessLogs);
  const { data: logs = [], isLoading } = useQuery({ queryKey: ["admin-logs"], queryFn: () => fn() });
  return (
    <AdminShell title="Logs do Sistema" subtitle="Eventos de acesso e auditoria">
      {isLoading ? <div className="text-muted-foreground">Carregando...</div> : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left p-3">Quando</th><th className="text-left p-3">Evento</th><th className="text-left p-3">E-mail</th><th className="text-left p-3">IP</th></tr>
            </thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="p-3 text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-3">{l.event}</td>
                  <td className="p-3">{l.email || "—"}</td>
                  <td className="p-3 text-xs">{l.ip || "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Sem registros</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
