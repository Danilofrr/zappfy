import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSystemSettings, saveSystemSettings } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Save, MessageSquare, CreditCard, Shield, Palette, Plug, Building2, Lock, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({ component: AdminSettings });

type Settings = {
  platform?: { name?: string; logoUrl?: string; primaryColor?: string; supportEmail?: string; supportWhats?: string; cnpj?: string; url?: string };
  subscription?: { trialDays?: number; autoBlock?: boolean; toleranceDays?: number; msgExpired?: string; msgBlocked?: string };
  payment?: { pixKey?: string; receiverName?: string; bank?: string; defaultLink?: string; gateway?: string };
  messages?: { welcome?: string; nearDue?: string; expired?: string; paid?: string; blocked?: string; reactivated?: string };
  security?: { adminOnly?: boolean; accessLogs?: boolean; sessionMinutes?: number };
  appearance?: { theme?: string; brandName?: string; sidebarLogo?: string; primaryColor?: string };
  prize?: { enabled?: boolean; goal?: number; reward?: string; period?: string };
};

const DEFAULTS: Settings = {
  platform: { name: "ZappFy", primaryColor: "#22c55e", url: "https://zappfy.lovable.app" },
  subscription: { trialDays: 7, autoBlock: true, toleranceDays: 3, msgExpired: "Sua assinatura venceu. Renove para continuar usando o ZappFy.", msgBlocked: "Sua conta está bloqueada por falta de pagamento. Regularize para reativar." },
  payment: { gateway: "" },
  messages: {
    welcome: "Olá {{nome}}! Bem-vindo(a) ao ZappFy 🎉 Seu acesso já está liberado.",
    nearDue: "Olá {{nome}}, sua assinatura vence em {{dias}} dias. Renove para não perder acesso.",
    expired: "Olá {{nome}}, sua assinatura venceu hoje. Renove para reativar o acesso.",
    paid: "Recebemos seu pagamento, {{nome}}! Assinatura válida até {{vencimento}}.",
    blocked: "Olá {{nome}}, sua conta foi bloqueada por falta de pagamento.",
    reactivated: "Sua conta foi reativada, {{nome}}! Bom trabalho 🚀",
  },
  security: { adminOnly: true, accessLogs: true, sessionMinutes: 240 },
  appearance: { theme: "dark", brandName: "ZappFy", primaryColor: "#22c55e" },
  prize: { enabled: false, goal: 1000000, reward: "Prêmio especial ao bater a meta!", period: "mensal" },
};

function AdminSettings() {
  const qc = useQueryClient();
  const getFn = useServerFn(getSystemSettings);
  const saveFn = useServerFn(saveSystemSettings);
  const q = useQuery({ queryKey: ["admin-settings"], queryFn: () => getFn(), staleTime: 60_000 });

  const [s, setS] = useState<Settings>(DEFAULTS);
  useEffect(() => {
    if (q.data) {
      setS({
        platform: { ...DEFAULTS.platform, ...(q.data.platform ?? {}) },
        subscription: { ...DEFAULTS.subscription, ...(q.data.subscription ?? {}) },
        payment: { ...DEFAULTS.payment, ...(q.data.payment ?? {}) },
        messages: { ...DEFAULTS.messages, ...(q.data.messages ?? {}) },
        security: { ...DEFAULTS.security, ...(q.data.security ?? {}) },
        appearance: { ...DEFAULTS.appearance, ...(q.data.appearance ?? {}) },
        prize: { ...DEFAULTS.prize, ...(q.data.prize ?? {}) },
      });
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { value: s as any } }),
    onSuccess: () => { toast.success("Configurações salvas com sucesso."); qc.invalidateQueries({ queryKey: ["admin-settings"] }); },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

  const [pwd, setPwd] = useState({ next: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  async function changePassword() {
    if (pwd.next.length < 8) return toast.error("A senha precisa ter no mínimo 8 caracteres");
    if (pwd.next !== pwd.confirm) return toast.error("As senhas não coincidem");
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setSavingPwd(false);
    if (error) return toast.error(error.message);
    toast.success("Senha do administrador alterada");
    setPwd({ next: "", confirm: "" });
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((p) => ({ ...p, [k]: { ...(p[k] as any), ...(v as any) } }));

  if (q.isLoading) {
    return (
      <AdminShell title="Configurações" subtitle="Configurações gerais do ZappFy">
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Configurações"
      subtitle="Configurações gerais do ZappFy"
      actions={<Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4 mr-1" />{save.isPending ? "Salvando..." : "Salvar Configurações"}</Button>}
    >
      <Tabs defaultValue="platform" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="platform"><Building2 className="h-4 w-4 mr-1" />Plataforma</TabsTrigger>
          <TabsTrigger value="subscription">Assinatura</TabsTrigger>
          <TabsTrigger value="payment"><CreditCard className="h-4 w-4 mr-1" />Pagamento</TabsTrigger>
          <TabsTrigger value="messages"><MessageSquare className="h-4 w-4 mr-1" />Mensagens</TabsTrigger>
          <TabsTrigger value="security"><Shield className="h-4 w-4 mr-1" />Segurança</TabsTrigger>
          <TabsTrigger value="appearance"><Palette className="h-4 w-4 mr-1" />Aparência</TabsTrigger>
          <TabsTrigger value="integrations"><Plug className="h-4 w-4 mr-1" />Integrações</TabsTrigger>
        </TabsList>

        <TabsContent value="platform">
          <Card>
            <CardHeader><CardTitle>Configurações da Plataforma</CardTitle><CardDescription>Identidade e contatos oficiais do SaaS</CardDescription></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Field label="Nome do SaaS"><Input value={s.platform?.name ?? ""} onChange={(e) => set("platform", { name: e.target.value })} /></Field>
              <Field label="URL oficial"><Input value={s.platform?.url ?? ""} onChange={(e) => set("platform", { url: e.target.value })} /></Field>
              <Field label="Logo (URL)"><Input value={s.platform?.logoUrl ?? ""} onChange={(e) => set("platform", { logoUrl: e.target.value })} placeholder="https://..." /></Field>
              <Field label="Cor principal"><div className="flex gap-2"><Input type="color" className="w-16 h-10 p-1" value={s.platform?.primaryColor ?? "#22c55e"} onChange={(e) => set("platform", { primaryColor: e.target.value })} /><Input value={s.platform?.primaryColor ?? ""} onChange={(e) => set("platform", { primaryColor: e.target.value })} /></div></Field>
              <Field label="E-mail de suporte"><Input type="email" value={s.platform?.supportEmail ?? ""} onChange={(e) => set("platform", { supportEmail: e.target.value })} /></Field>
              <Field label="WhatsApp de suporte"><Input value={s.platform?.supportWhats ?? ""} onChange={(e) => set("platform", { supportWhats: e.target.value })} placeholder="+55 11 ..." /></Field>
              <Field label="CNPJ/Empresa"><Input value={s.platform?.cnpj ?? ""} onChange={(e) => set("platform", { cnpj: e.target.value })} /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscription">
          <Card>
            <CardHeader><CardTitle>Configurações de Assinatura</CardTitle><CardDescription>Regras de teste, vencimento e bloqueio</CardDescription></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Field label="Dias de teste grátis"><Input type="number" value={s.subscription?.trialDays ?? 7} onChange={(e) => set("subscription", { trialDays: Number(e.target.value) })} /></Field>
              <Field label="Dias de tolerância"><Input type="number" value={s.subscription?.toleranceDays ?? 0} onChange={(e) => set("subscription", { toleranceDays: Number(e.target.value) })} /></Field>
              <div className="flex items-center gap-3 md:col-span-2"><Switch checked={!!s.subscription?.autoBlock} onCheckedChange={(v) => set("subscription", { autoBlock: v })} /><Label>Bloquear automaticamente após vencimento</Label></div>
              <Field label="Mensagem para cliente vencido" className="md:col-span-2"><Textarea rows={3} value={s.subscription?.msgExpired ?? ""} onChange={(e) => set("subscription", { msgExpired: e.target.value })} /></Field>
              <Field label="Mensagem para cliente bloqueado" className="md:col-span-2"><Textarea rows={3} value={s.subscription?.msgBlocked ?? ""} onChange={(e) => set("subscription", { msgBlocked: e.target.value })} /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payment">
          <Card>
            <CardHeader><CardTitle>Configurações de Pagamento</CardTitle><CardDescription>Dados para recebimento de assinaturas</CardDescription></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Field label="Chave Pix"><Input value={s.payment?.pixKey ?? ""} onChange={(e) => set("payment", { pixKey: e.target.value })} /></Field>
              <Field label="Nome do recebedor"><Input value={s.payment?.receiverName ?? ""} onChange={(e) => set("payment", { receiverName: e.target.value })} /></Field>
              <Field label="Banco"><Input value={s.payment?.bank ?? ""} onChange={(e) => set("payment", { bank: e.target.value })} /></Field>
              <Field label="Link de pagamento padrão"><Input value={s.payment?.defaultLink ?? ""} onChange={(e) => set("payment", { defaultLink: e.target.value })} /></Field>
              <Field label="Gateway futuro" className="md:col-span-2">
                <select className="w-full h-10 rounded-md border border-border bg-background px-3" value={s.payment?.gateway ?? ""} onChange={(e) => set("payment", { gateway: e.target.value })}>
                  <option value="">Nenhum (manual)</option>
                  <option value="asaas">Asaas</option>
                  <option value="mercadopago">Mercado Pago</option>
                  <option value="stripe">Stripe</option>
                </select>
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <Card>
            <CardHeader><CardTitle>Mensagens Automáticas</CardTitle><CardDescription>Use variáveis como {"{{nome}}"}, {"{{dias}}"}, {"{{vencimento}}"}</CardDescription></CardHeader>
            <CardContent className="grid gap-4">
              {[
                ["welcome", "Boas-vindas ao novo cliente"],
                ["nearDue", "Assinatura próxima do vencimento"],
                ["expired", "Assinatura vencida"],
                ["paid", "Pagamento confirmado"],
                ["blocked", "Conta bloqueada"],
                ["reactivated", "Conta reativada"],
              ].map(([k, label]) => (
                <Field key={k} label={label}>
                  <Textarea rows={3} value={(s.messages as any)?.[k] ?? ""} onChange={(e) => set("messages", { [k]: e.target.value } as any)} />
                </Field>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Segurança</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 md:col-span-2"><Switch checked={!!s.security?.adminOnly} onCheckedChange={(v) => set("security", { adminOnly: v })} /><Label>Permitir apenas Admin acessar o Painel Master</Label></div>
              <div className="flex items-center gap-3 md:col-span-2"><Switch checked={!!s.security?.accessLogs} onCheckedChange={(v) => set("security", { accessLogs: v })} /><Label>Ativar logs de acesso</Label></div>
              <Field label="Tempo de sessão (minutos)"><Input type="number" value={s.security?.sessionMinutes ?? 240} onChange={(e) => set("security", { sessionMinutes: Number(e.target.value) })} /></Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" />Alterar senha do administrador</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Field label="Nova senha"><Input type="password" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} /></Field>
              <Field label="Confirmar senha"><Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></Field>
              <div className="md:col-span-2"><Button onClick={changePassword} disabled={savingPwd}>{savingPwd ? "Salvando..." : "Alterar senha"}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader><CardTitle>Aparência</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <Field label="Tema">
                <select className="w-full h-10 rounded-md border border-border bg-background px-3" value={s.appearance?.theme ?? "dark"} onChange={(e) => set("appearance", { theme: e.target.value })}>
                  <option value="dark">Escuro</option>
                  <option value="light">Claro</option>
                </select>
              </Field>
              <Field label="Cor principal"><div className="flex gap-2"><Input type="color" className="w-16 h-10 p-1" value={s.appearance?.primaryColor ?? "#22c55e"} onChange={(e) => set("appearance", { primaryColor: e.target.value })} /><Input value={s.appearance?.primaryColor ?? ""} onChange={(e) => set("appearance", { primaryColor: e.target.value })} /></div></Field>
              <Field label="Nome exibido no painel"><Input value={s.appearance?.brandName ?? ""} onChange={(e) => set("appearance", { brandName: e.target.value })} /></Field>
              <Field label="Logo do menu lateral (URL)"><Input value={s.appearance?.sidebarLogo ?? ""} onChange={(e) => set("appearance", { sidebarLogo: e.target.value })} /></Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "WhatsApp", desc: "Envio automático de mensagens" },
              { name: "E-mail SMTP", desc: "Notificações por e-mail" },
              { name: "Asaas", desc: "Cobranças e Pix automático" },
              { name: "Mercado Pago", desc: "Checkout e assinaturas" },
              { name: "Stripe", desc: "Pagamentos internacionais" },
              { name: "Webhook", desc: "Eventos para sistemas externos" },
            ].map((i) => (
              <Card key={i.name} className="opacity-80">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">{i.name}<span className="text-xs font-normal px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">Em breve</span></CardTitle>
                  <CardDescription>{i.desc}</CardDescription>
                </CardHeader>
                <CardContent><Button variant="outline" size="sm" disabled>Configurar</Button></CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
