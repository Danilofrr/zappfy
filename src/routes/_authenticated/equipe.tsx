import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStore } from "@/lib/active-store";
import { useStore } from "@/lib/store";
import { TEAM_PERMISSION_OPTIONS, type TeamPermission } from "@/lib/team-permissions";

export const Route = createFileRoute("/_authenticated/equipe")({
  component: EquipePage,
});

type TeamMember = {
  id: string;
  store_id: string;
  member_user_id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
};

const OPERATION_PRESET: TeamPermission[] = ["orders", "couriers", "tracking", "checkout"];

function EquipePage() {
  const { activeStoreId, activeStore } = useActiveStore();
  const { access } = useStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<TeamPermission[]>(OPERATION_PRESET);

  const activeCount = useMemo(() => members.filter((member) => member.active).length, [members]);

  async function loadMembers() {
    if (!activeStoreId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("team_members")
      .select("id,store_id,member_user_id,name,email,role,permissions,active,created_at,updated_at")
      .eq("store_id", activeStoreId)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    else setMembers((data ?? []) as TeamMember[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadMembers();
  }, [activeStoreId]);

  function openCreate() {
    setEditing(null);
    setName("");
    setEmail("");
    setPassword("");
    setPermissions(OPERATION_PRESET);
    setDialogOpen(true);
  }

  function openEdit(member: TeamMember) {
    setEditing(member);
    setName(member.name);
    setEmail(member.email);
    setPassword("");
    setPermissions((member.permissions || []) as TeamPermission[]);
    setDialogOpen(true);
  }

  function togglePermission(permission: TeamPermission, checked: boolean) {
    setPermissions((current) => {
      let next = checked
        ? Array.from(new Set([...current, permission])) as TeamPermission[]
        : current.filter((item) => item !== permission);

      // Dashboard e relatórios financeiros dependem do Financeiro para não mostrar
      // números incompletos ou inconsistentes.
      if (checked && (permission === "dashboard" || permission === "reports")) {
        next = Array.from(new Set([...next, "finance"])) as TeamPermission[];
      }
      if (!checked && permission === "finance") {
        next = next.filter((item) => item !== "dashboard" && item !== "reports");
      }
      return next;
    });
  }

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sua sessão expirou. Entre novamente.");
    return {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    };
  }

  async function saveMember() {
    if (!activeStoreId) return;
    if (!name.trim()) return toast.error("Informe o nome do funcionário.");
    if (!editing && !email.trim()) return toast.error("Informe o e-mail do funcionário.");
    if (!editing && password.length < 6) return toast.error("A senha inicial precisa ter pelo menos 6 caracteres.");
    if (!permissions.length) return toast.error("Selecione pelo menos um acesso.");

    setSaving(true);
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/team/members", {
        method: editing ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(
          editing
            ? {
                id: editing.id,
                storeId: activeStoreId,
                name: name.trim(),
                ...(password ? { password } : {}),
                permissions,
              }
            : {
                storeId: activeStoreId,
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password,
                permissions,
              },
        ),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Não foi possível salvar o funcionário.");

      toast.success(editing ? "Acessos do funcionário atualizados." : "Funcionário criado com sucesso.");
      setDialogOpen(false);
      await loadMembers();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível salvar o funcionário.");
    } finally {
      setSaving(false);
    }
  }

  async function setMemberActive(member: TeamMember, active: boolean) {
    if (!activeStoreId) return;
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/team/members", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: member.id, storeId: activeStoreId, active }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Não foi possível alterar o acesso.");
      toast.success(active ? "Acesso reativado." : "Acesso bloqueado.");
      await loadMembers();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível alterar o acesso.");
    }
  }

  async function removeMember(member: TeamMember) {
    if (!activeStoreId) return;
    if (!confirm(`Remover ${member.name} da equipe? O acesso à loja será revogado.`)) return;
    try {
      const headers = await authHeaders();
      const response = await fetch(
        `/api/team/members?storeId=${encodeURIComponent(activeStoreId)}&id=${encodeURIComponent(member.id)}`,
        { method: "DELETE", headers },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Não foi possível remover o funcionário.");
      toast.success("Funcionário removido da equipe.");
      await loadMembers();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível remover o funcionário.");
    }
  }

  if (access?.isOwner === false) {
    return (
      <AppShell title="Equipe" subtitle="Gerencie usuários e permissões da sua loja">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-bold">Apenas o dono da loja gerencia a equipe</h2>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Equipe"
      subtitle="Crie acessos para funcionários sem compartilhar a sua conta principal"
      actions={
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Novo usuário
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <UsersRound className="h-5 w-5" />
            </span>
            <div>
              <div className="text-2xl font-black">{members.length}</div>
              <div className="text-xs text-muted-foreground">usuários cadastrados</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <div className="text-2xl font-black">{activeCount}</div>
              <div className="text-xs text-muted-foreground">acessos ativos</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <div className="text-sm font-bold">Lucro protegido</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Sem “Financeiro e lucro”, o funcionário não recebe custos, despesas nem lucro da loja.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-bold">Usuários da {activeStore?.name || "loja"}</h2>
            <p className="text-xs text-muted-foreground">Cada usuário entra pelo login normal do Zappfy.</p>
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-48 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : members.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <UserRound className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-3 font-bold">Nenhum funcionário cadastrado</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie um usuário e escolha exatamente quais áreas ele poderá acessar.
            </p>
            <Button onClick={openCreate} className="mt-5 gap-2">
              <Plus className="h-4 w-4" /> Criar primeiro usuário
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div key={member.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-bold">{member.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${member.active ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                        {member.active ? "ATIVO" : "BLOQUEADO"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" /> {member.email}
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-wrap gap-1.5">
                  {(member.permissions || []).slice(0, 6).map((permission) => {
                    const option = TEAM_PERMISSION_OPTIONS.find((item) => item.key === permission);
                    return option ? (
                      <span key={permission} className="rounded-full border border-border bg-secondary/50 px-2 py-1 text-[10px] font-semibold">
                        {option.label}
                      </span>
                    ) : null;
                  })}
                  {(member.permissions || []).length > 6 && (
                    <span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground">
                      +{member.permissions.length - 6}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(member)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void setMemberActive(member, !member.active)}
                  >
                    {member.active ? "Bloquear" : "Reativar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void removeMember(member)}
                    className="text-destructive hover:text-destructive"
                    aria-label="Remover funcionário"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar acesso" : "Novo usuário da equipe"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Altere nome, senha ou módulos liberados para este funcionário."
                : "Crie um login separado. Você não precisa compartilhar sua senha principal."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: João - Atendimento" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail / usuário</Label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={Boolean(editing)}
                placeholder="funcionario@email.com"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{editing ? "Nova senha (opcional)" : "Senha inicial"}</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={editing ? "Deixe vazio para manter a senha atual" : "Mínimo de 6 caracteres"}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-bold">Permissões de acesso</div>
                <div className="text-xs text-muted-foreground">Libere somente o necessário para o trabalho do funcionário.</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPermissions(OPERATION_PRESET)}
              >
                Usar perfil Operação
              </Button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {TEAM_PERMISSION_OPTIONS.map((option) => {
                const checked = permissions.includes(option.key);
                return (
                  <label
                    key={option.key}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${checked ? "border-primary/50 bg-primary/5" : "border-border"}`}
                  >
                    <Switch
                      checked={checked}
                      onCheckedChange={(next) => togglePermission(option.key, next)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        {option.label}
                        {option.sensitive && (
                          <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-500">
                            SENSÍVEL
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mr-1.5 inline h-4 w-4 text-primary" />
            Se “Financeiro e lucro” não estiver liberado, custos dos produtos, despesas e lucro ficam fora dos dados enviados ao funcionário.
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void saveMember()} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Salvar acessos" : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
