import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  listClients,
  createClient,
  deleteClient,
  setSubscriptionStatus,
  renewSubscription,
  changeClientPlan,
  addTrialDays,
  generateActivationToken,
  listPlans,
  setClientPassword,
  sendClientPasswordReset,
} from "@/lib/admin.functions";
import { Plus, Copy, Trash2, Ban, Play, RotateCw, CalendarPlus, Link as LinkIcon, KeyRound, Mail, RefreshCw } from "lucide-react";
import { buildPublicUrl } from "@/lib/public-url";
import { usePublicBaseUrl } from "@/hooks/use-public-base-url";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  component: ClientsPage,
});

const statusColors: Record<string, string> = {
  ativo: "bg-green-500/15 text-green-500 border-green-500/30",
  teste: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  pendente: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  vencido: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  bloqueado: "bg-red-500/15 text-red-500 border-red-500/30",
};

function ClientsPage() {
  const qc = useQueryClient();
  const publicBaseUrl = usePublicBaseUrl();
  const listFn = useServerFn(listClients);
  const plansFn = useServerFn(listPlans);
  const createFn = useServerFn(createClient);
  const delFn = useServerFn(deleteClient);
  const statusFn = useServerFn(setSubscriptionStatus);
  const renewFn = useServerFn(renewSubscription);
  const planFn = useServerFn(changeClientPlan);
  const trialFn = useServerFn(addTrialDays);
  const tokenFn = useServerFn(generateActivationToken);
  const setPwdFn = useServerFn(setClientPassword);
  const resetPwdFn = useServerFn(sendClientPasswordReset);

  const { data: clients = [], isLoading } = useQuery({ queryKey: ["admin-clients"], queryFn: () => listFn() });
  const { data: plans = [] } = useQuery({ queryKey: ["admin-plans"], queryFn: () => plansFn() });

  const [openCreate, setOpenCreate] = useState(false);
  const [activationLink, setActivationLink] = useState<string | null>(null);
  const [pwdClient, setPwdClient] = useState<{ id: string; email: string } | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", fullName: "", storeName: "", whatsapp: "", planId: "", trialDays: "7" });

  const genPwd = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
    setNewPwd(s);
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-clients"] });

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          email: form.email,
          fullName: form.fullName,
          storeName: form.storeName,
          whatsapp: form.whatsapp,
          planId: form.planId || undefined,
          trialDays: Number(form.trialDays) || 7,
        },
      }),
    onSuccess: (res: any) => {
      const link = buildPublicUrl(`/ativar-conta/${res.activationToken}`, publicBaseUrl);
      setActivationLink(link);
      setOpenCreate(false);
      setForm({ email: "", fullName: "", storeName: "", whatsapp: "", planId: "", trialDays: "7" });
      toast.success("Cliente criado com sucesso");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar cliente"),
  });

  return (
    <AdminShell
      title="Clientes"
      subtitle="Gerenciar contas, planos e assinaturas"
      actions={
        <Button onClick={() => setOpenCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo cliente
        </Button>
      }
    >
      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Loja</th>
                <th className="text-left p-3">Plano</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Dias restantes</th>
                <th className="text-left p-3">Vence em</th>
                <th className="text-left p-3">Último acesso</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c: any) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3">
                    <div className="font-medium">{c.fullName || "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </td>
                  <td className="p-3">{c.storeName || "—"}</td>
                  <td className="p-3">
                    <Select
                      value={c.subscription?.planId ?? ""}
                      onValueChange={async (v) => {
                        await planFn({ data: { userId: c.id, planId: v } });
                        toast.success("Plano atualizado");
                        invalidate();
                      }}
                    >
                      <SelectTrigger className="h-8 w-36"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    {c.subscription ? (
                      <Badge variant="outline" className={statusColors[c.subscription.status] || ""}>
                        {c.subscription.status}
                      </Badge>
                    ) : "—"}
                  </td>
                  <td className="p-3 text-xs">
                    {(() => {
                      if (!c.subscription?.expiresAt) return <span className="text-muted-foreground">—</span>;
                      const days = Math.ceil((new Date(c.subscription.expiresAt).getTime() - Date.now()) / 86400000);
                      if (days <= 0) return <span className="text-red-500 font-medium">Expirado</span>;
                      const color = days >= 4 ? "text-green-500" : days >= 2 ? "text-amber-500" : "text-red-500";
                      return <span className={`${color} font-medium`}>{days} {days === 1 ? "dia" : "dias"}</span>;
                    })()}
                  </td>
                  <td className="p-3 text-xs">{c.subscription?.expiresAt ? new Date(c.subscription.expiresAt).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="p-3 text-xs">{c.lastSignInAt ? new Date(c.lastSignInAt).toLocaleString("pt-BR") : "Nunca"}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" title="Renovar +30d" onClick={async () => {
                        try { await renewFn({ data: { userId: c.id, days: 30 } }); toast.success("Renovado +30 dias"); await qc.invalidateQueries({ queryKey: ["admin-clients"] }); }
                        catch (e: any) { toast.error(e?.message ?? "Erro ao renovar"); }
                      }}>
                        <RotateCw className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Adicionar 7d teste" onClick={async () => {
                        try { await trialFn({ data: { userId: c.id, days: 7 } }); toast.success("+7 dias teste"); await qc.invalidateQueries({ queryKey: ["admin-clients"] }); }
                        catch (e: any) { toast.error(e?.message ?? "Erro ao adicionar teste"); }
                      }}>
                        <CalendarPlus className="h-4 w-4" />
                      </Button>
                      {c.subscription?.status !== "bloqueado" ? (
                        <Button size="sm" variant="ghost" title="Bloquear" onClick={async () => {
                          if (!confirm(`Bloquear o acesso de ${c.email}?`)) return;
                          try { await statusFn({ data: { userId: c.id, status: "bloqueado" } }); toast.success("Cliente bloqueado"); await qc.invalidateQueries({ queryKey: ["admin-clients"] }); }
                          catch (e: any) { toast.error(e?.message ?? "Erro ao bloquear"); }
                        }}>
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" title="Desbloquear" onClick={async () => {
                          try { await statusFn({ data: { userId: c.id, status: "ativo" } }); toast.success("Desbloqueado"); await qc.invalidateQueries({ queryKey: ["admin-clients"] }); }
                          catch (e: any) { toast.error(e?.message ?? "Erro ao desbloquear"); }
                        }}>
                          <Play className="h-4 w-4 text-green-500" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" title="Gerar link de ativação" onClick={async () => {
                        try {
                          const r: any = await tokenFn({ data: { userId: c.id } });
                          const link = buildPublicUrl(`/ativar-conta/${r.token}`, publicBaseUrl);
                          setActivationLink(link);
                          try { await navigator.clipboard.writeText(link); toast.success("Link gerado e copiado"); }
                          catch { toast.success("Link gerado"); }
                        } catch (e: any) { toast.error(e?.message ?? "Erro ao gerar link"); }
                      }}>
                        <LinkIcon className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Gerenciar senha" onClick={() => { setPwdClient({ id: c.id, email: c.email }); setNewPwd(""); setResetLink(null); }}>
                        <KeyRound className="h-4 w-4 text-primary" />
                      </Button>
                      <Button size="sm" variant="ghost" title="Excluir" onClick={async () => {
                        if (!confirm(`Excluir ${c.email}?`)) return;
                        try { await delFn({ data: { userId: c.id } }); toast.success("Cliente excluído"); await qc.invalidateQueries({ queryKey: ["admin-clients"] }); }
                        catch (e: any) { toast.error(e?.message ?? "Erro ao excluir"); }
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>

                </tr>
              ))}
              {clients.length === 0 && (
                <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Nenhum cliente cadastrado ainda</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1"><Label>Nome do responsável</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
            <div className="grid gap-1"><Label>Nome da empresa/loja</Label><Input value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} /></div>
            <div className="grid gap-1"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid gap-1"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label>Plano</Label>
                <Select value={form.planId} onValueChange={(v) => setForm({ ...form, planId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1"><Label>Dias de teste</Label><Input type="number" value={form.trialDays} onChange={(e) => setForm({ ...form, trialDays: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending || !form.email || !form.fullName}>Criar cliente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activationLink} onOpenChange={(o) => !o && setActivationLink(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link de ativação</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Envie este link para o cliente. Ele criará a própria senha e o sistema será ativado automaticamente.</p>
          <div className="flex gap-2">
            <Input readOnly value={activationLink ?? ""} />
            <Button onClick={() => { navigator.clipboard.writeText(activationLink!); toast.success("Link copiado"); }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActivationLink(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwdClient} onOpenChange={(o) => !o && setPwdClient(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerenciar senha</DialogTitle></DialogHeader>
          <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            Por segurança, senhas são armazenadas como hash e <strong>não podem ser visualizadas</strong>. Você pode definir uma nova senha para o cliente ou enviar um link de redefinição por e-mail.
          </div>
          <div className="text-sm"><span className="text-muted-foreground">Cliente:</span> <strong>{pwdClient?.email}</strong></div>

          <div className="grid gap-2">
            <Label>Nova senha</Label>
            <div className="flex gap-2">
              <Input type="text" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Mínimo 6 caracteres" />
              <Button variant="outline" type="button" onClick={genPwd} title="Gerar senha"><RefreshCw className="h-4 w-4" /></Button>
              <Button variant="outline" type="button" disabled={!newPwd} onClick={() => { navigator.clipboard.writeText(newPwd); toast.success("Senha copiada"); }} title="Copiar"><Copy className="h-4 w-4" /></Button>
            </div>
            <Button
              disabled={savingPwd || newPwd.length < 6 || !pwdClient}
              onClick={async () => {
                if (!pwdClient) return;
                setSavingPwd(true);
                try {
                  await setPwdFn({ data: { userId: pwdClient.id, password: newPwd } });
                  toast.success("Senha definida — copie e envie ao cliente");
                } catch (e: any) {
                  toast.error(friendlyError(e, "Erro ao definir senha"));
                } finally {
                  setSavingPwd(false);
                }
              }}
            >
              <KeyRound className="h-4 w-4 mr-1" /> Definir esta senha
            </Button>
          </div>

          <div className="border-t border-border pt-3 grid gap-2">
            <Label>Ou envie um link de redefinição</Label>
            <Button
              variant="outline"
              onClick={async () => {
                if (!pwdClient) return;
                try {
                  const r: any = await resetPwdFn({ data: { userId: pwdClient.id, redirectTo: buildPublicUrl("/reset-password", publicBaseUrl) } });
                  setResetLink(r.link);
                  toast.success("Link de redefinição gerado");
                } catch (e: any) {
                  toast.error(e.message ?? "Erro ao gerar link");
                }
              }}
            >
              <Mail className="h-4 w-4 mr-1" /> Gerar link de redefinição
            </Button>
            {resetLink && (
              <div className="flex gap-2">
                <Input readOnly value={resetLink} />
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(resetLink); toast.success("Link copiado"); }}><Copy className="h-4 w-4" /></Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwdClient(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
