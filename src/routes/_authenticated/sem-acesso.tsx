import { createFileRoute } from "@tanstack/react-router";
import { ShieldX } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/sem-acesso")({
  component: SemAcessoPage,
});

function SemAcessoPage() {
  return (
    <AppShell title="Acesso limitado" subtitle="Sua conta de funcionário não possui módulos liberados">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <ShieldX className="h-7 w-7" />
        </span>
        <h2 className="mt-4 text-xl font-bold">Nenhum acesso liberado</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Peça ao responsável pela loja para liberar os módulos necessários na aba Equipe.
        </p>
      </div>
    </AppShell>
  );
}
