import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({ component: AdminSettings });

function AdminSettings() {
  return (
    <AdminShell title="Configurações" subtitle="Configurações gerais do Zappfy">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="font-bold mb-2">Em breve</h3>
        <p className="text-sm text-muted-foreground">Configurações de e-mail, integração de pagamento, mensagens automáticas e personalização do sistema serão habilitadas aqui.</p>
      </div>
    </AdminShell>
  );
}
