import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listTrialInvites,
  createTrialInvite,
  revokeTrialInvite,
  reactivateTrialInvite,
  getTrialStats,
} from "@/lib/trial.functions";
import {
  Gift,
  Plus,
  Copy,
  Ban,
  Play,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  Percent,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/trials")({
  component: TrialsPage,
});

function TrialsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTrialInvites);
  const statsFn = useServerFn(getTrialStats);
  const createFn = useServerFn(createTrialInvite);
  const revokeFn = useServerFn(revokeTrialInvite);
  const reactivateFn = useServerFn(reactivateTrialInvite);

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["trial-invites"],
    queryFn: () => listFn(),
  });
  const { data: stats } = useQuery({
    queryKey: ["trial-stats"],
    queryFn: () => statsFn(),
    staleTime: 30_000,
  });

  const [openCreate, setOpenCreate] = useState(false);
  const [form, setForm] = useState({ label: "", trialDays: "7", expiresInDays: "0" });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["trial-invites"] });
    qc.invalidateQueries({ queryKey: ["trial-stats"] });
  };

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          label: form.label,
          trialDays: Number(form.trialDays) || 7,
          expiresInDays: Number(form.expiresInDays) || 0,
        },
      }),
    onSuccess: (inv: any) => {
      const link = `${window.location.origin}/trial/${inv.code}`;
      navigator.clipboard.writeText(link).catch(() => {});
      toast.success(`Convite ${inv.code} criado — link copiado`);
      setOpenCreate(false);
      setForm({ label: "", trialDays: "7", expiresInDays: "0" });
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar convite"),
  });

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/trial/${code}`;
    navigator.clipboard.writeText(link).then(() => toast.success("Link copiado"));
  };

  return (
    <AdminShell
      title="Trials"
      subtitle="Convites de teste grátis e funil de conversão"
      actions={
        <Button onClick={() => setOpenCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Gerar Link de Trial
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Trials ativos"
          value={stats?.active_trials ?? 0}
          tone="amber"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Trials expirados"
          value={stats?.expired_trials ?? 0}
          tone="muted"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Convertidos"
          value={stats?.conversions ?? 0}
          tone="green"
        />
        <StatCard
          icon={<Percent className="h-5 w-5" />}
          label="Taxa de conversão"
          value={`${stats?.conversion_rate ?? 0}%`}
          tone="primary"
        />
      </div>

      {/* Invites table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Código / Link</th>
              <th className="text-left p-3">Rótulo</th>
              <th className="text-left p-3">Dias trial</th>
              <th className="text-left p-3">Cadastros</th>
              <th className="text-left p-3">Conversões</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Criado em</th>
              <th className="text-right p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            )}
            {!isLoading &&
              invites.map((i: any) => {
                const rate =
                  i.signups_count > 0
                    ? Math.round((i.conversions_count / i.signups_count) * 1000) / 10
                    : 0;
                return (
                  <tr key={i.id} className="border-t border-border">
                    <td className="p-3">
                      <div className="font-mono font-bold text-primary">{i.code}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                        {typeof window !== "undefined" ? window.location.origin : ""}/trial/{i.code}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground">{i.label || "—"}</td>
                    <td className="p-3">{i.trial_days}d</td>
                    <td className="p-3 font-medium">{i.signups_count}</td>
                    <td className="p-3">
                      <span className="font-medium">{i.conversions_count}</span>
                      {i.signups_count > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">({rate}%)</span>
                      )}
                    </td>
                    <td className="p-3">
                      {i.status === "active" ? (
                        <Badge variant="outline" className="bg-green-500/15 text-green-500 border-green-500/30">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-500/15 text-red-500 border-red-500/30">
                          Revogado
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(i.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Copiar link" onClick={() => copyLink(i.code)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        {i.status === "active" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Revogar"
                            onClick={async () => {
                              if (!confirm(`Revogar convite ${i.code}?`)) return;
                              await revokeFn({ data: { id: i.id } });
                              toast.success("Convite revogado");
                              invalidate();
                            }}
                          >
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Reativar"
                            onClick={async () => {
                              await reactivateFn({ data: { id: i.id } });
                              toast.success("Convite reativado");
                              invalidate();
                            }}
                          >
                            <Play className="h-4 w-4 text-green-500" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            {!isLoading && invites.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  <Gift className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  Nenhum convite de trial gerado ainda.
                  <div className="mt-3">
                    <Button onClick={() => setOpenCreate(true)} size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Gerar primeiro link
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo convite de trial</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <Label>Rótulo (opcional)</Label>
              <Input
                placeholder="Ex: Campanha Instagram"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label>Dias de teste grátis</Label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={form.trialDays}
                  onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
                />
              </div>
              <div className="grid gap-1">
                <Label>Validade do link (dias, 0 = sem validade)</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={form.expiresInDays}
                  onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              O link gerado será copiado automaticamente para sua área de transferência.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              <Gift className="h-4 w-4 mr-1" /> Gerar link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: "amber" | "green" | "muted" | "primary";
}) {
  const toneClasses: Record<string, string> = {
    amber: "bg-amber-500/10 text-amber-500 ring-amber-500/20",
    green: "bg-green-500/10 text-green-500 ring-green-500/20",
    muted: "bg-muted text-muted-foreground ring-border",
    primary: "bg-primary/10 text-primary ring-primary/20",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`grid h-9 w-9 place-items-center rounded-lg ring-1 ${toneClasses[tone]}`}>
          {icon}
        </div>
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
