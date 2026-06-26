import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, DEFAULT_DELIVERY_TEMPLATE, DEFAULT_MOTOBOY_TEMPLATE } from "@/lib/store";
import { DEFAULT_CUSTOMER_TRACKING_TEMPLATE, buildCustomerTrackingMessage } from "@/lib/tracking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Image as ImageIcon, Upload, X, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ShippingOption } from "@/lib/store";
import { SHIPPING_ICONS } from "@/lib/shipping-icons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotificationsCard } from "@/components/NotificationsCard";
import { getSenderInfo, saveSenderInfo, type SenderInfo } from "@/lib/sender-info";
import { AvatarUploader } from "@/components/AvatarUploader";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildPublicUrl } from "@/lib/public-url";
import { usePublicBaseUrl } from "@/hooks/use-public-base-url";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — ZappFy" }] }),
  component: Page,
});

function applyMessageVariables(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template || "");
}

function diagnosticVars(storeName: string) {
  return {
    cliente: "Cliente Teste",
    telefone: "5581999990000",
    produto: "🎉 Teste Emoji",
    endereco: "Rua Teste, 123 📍",
    total: "R$ 10,00",
    loja: storeName || "Sua Loja",
    observacoes: "✅ Observação com emoji",
    mapa: "https://maps.google.com/?q=Rua+Teste",
    itens: "1x 📦 Produto Teste",
    pagamento: "PIX",
  };
}

function Page() {
  const { state, updateSettings, resetSeed } = useStore();
  const publicBaseUrl = usePublicBaseUrl();
  const [f, setF] = useState(state.settings);
  const [sender, setSender] = useState<SenderInfo>(() => getSenderInfo());
  const [logoDims, setLogoDims] = useState<{ w: number; h: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onLogoFile(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem muito grande (máx 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setF((prev) => ({ ...prev, checkoutLogoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (!f.checkoutLogoUrl) { setLogoDims(null); return; }
    const img = new Image();
    img.onload = () => setLogoDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setLogoDims(null);
    img.src = f.checkoutLogoUrl;
  }, [f.checkoutLogoUrl]);

  // Keep local form in sync when settings load asynchronously.
  useEffect(() => { setF(state.settings); }, [state.settings]);

  const vars = diagnosticVars(f.storeName);
  const deliveryDiagnostic = applyMessageVariables(f.deliveryMessageTemplate, vars);
  const motoboyDiagnostic = applyMessageVariables(f.motoboyMessageTemplate, vars);
  const checkoutPublicUrl = f.slug ? buildPublicUrl(`/loja/${f.slug}`, publicBaseUrl) : "";
  const trackingExampleUrl = buildPublicUrl("/rastreio/abc123", publicBaseUrl);

  return (
    <AppShell
      title="Configurações"
      subtitle="Personalize sua loja, suas metas e mensagens"
      actions={
        <Button
          variant="outline"
          onClick={() => {
            if (confirm("Carregar dados de exemplo? Eles serão somados aos seus dados atuais.")) {
              resetSeed();
              toast.success("Dados de exemplo carregados");
            }
          }}
        >
          <RotateCcw className="mr-2 h-4 w-4" />Carregar exemplos
        </Button>
      }
    >
      <ProfileCard />
      <div className="grid lg:grid-cols-2 gap-6 mt-6">
        <Card title="Dados da loja">
          <Field label="Nome da Loja"><Input value={f.storeName} onChange={(e) => setF({ ...f, storeName: e.target.value })} /></Field>
          <Field label="WhatsApp (com DDI, só números)"><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="5581999990000" /></Field>
          <Field label="Chave PIX"><Input value={f.pixKey} onChange={(e) => setF({ ...f, pixKey: e.target.value })} /></Field>
          <Field label="Endereço"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
          <Field label="Link público do checkout (slug)">
            <Input
              value={f.slug}
              onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
              placeholder="esparta"
            />
            {checkoutPublicUrl && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  readOnly
                  value={checkoutPublicUrl}
                  className="text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard?.writeText(checkoutPublicUrl);
                    toast.success("Link copiado!");
                  }}
                >Copiar</Button>
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">Compartilhe esse link com seus clientes. Eles abrirão o checkout sem precisar de login.</p>
          </Field>
        </Card>

        <Card title="Remetente da etiqueta">
          <p className="text-[11px] text-muted-foreground -mt-2">Esses dados aparecem na etiqueta de envio impressa em cada pedido.</p>
          <Field label="Nome / razão social do remetente">
            <Input value={sender.name} onChange={(e) => setSender({ ...sender, name: e.target.value })} placeholder={f.storeName || "Sua loja"} />
          </Field>
          <Field label="Endereço (rua, número, complemento)">
            <Input value={sender.address} onChange={(e) => setSender({ ...sender, address: e.target.value })} placeholder="Av. Brasil, 1000 - Sala 2" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bairro">
              <Input value={sender.district} onChange={(e) => setSender({ ...sender, district: e.target.value })} placeholder="Centro" />
            </Field>
            <Field label="CEP">
              <Input value={sender.cep} onChange={(e) => setSender({ ...sender, cep: e.target.value })} placeholder="00000-000" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cidade - UF">
              <Input value={sender.city} onChange={(e) => setSender({ ...sender, city: e.target.value })} placeholder="São Paulo - SP" />
            </Field>
            <Field label="CNPJ / CPF (opcional)">
              <Input value={sender.cnpj} onChange={(e) => setSender({ ...sender, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
            </Field>
          </div>
        </Card>


        <Card title="Metas e operação">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome da entrega (ex: Motoboy, Correios)">
              <Input value={f.deliveryLabel} onChange={(e) => setF({ ...f, deliveryLabel: e.target.value })} placeholder="Entrega" />
            </Field>
            <Field label="Valor da entrega (R$)">
              <Input type="number" step="0.01" value={f.deliveryFee} onChange={(e) => setF({ ...f, deliveryFee: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Taxa do motoboy (R$) — descontada do lucro por pedido">
            <Input
              type="number"
              step="0.01"
              value={f.motoboyFee}
              onChange={(e) => setF({ ...f, motoboyFee: Number(e.target.value) })}
              placeholder="Ex: 10.00"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Esse valor é o que você paga ao motoboy por entrega. Ele será descontado automaticamente do lucro líquido no dashboard, deixando apenas o lucro real do produto.
            </p>
          </Field>
          <Field label="Meta mensal de faturamento (R$)">
            <Input type="number" step="0.01" value={f.monthlyRevenueGoal} onChange={(e) => setF({ ...f, monthlyRevenueGoal: Number(e.target.value) })} />
          </Field>
          <Field label="Meta mensal de lucro (R$)">
            <Input type="number" step="0.01" value={f.monthlyProfitGoal} onChange={(e) => setF({ ...f, monthlyProfitGoal: Number(e.target.value) })} />
          </Field>
        </Card>

        <Card title="Página de Rastreamento de Entregas">
          <p className="text-xs text-muted-foreground -mt-1 mb-3">
            Personalize cores, logo e textos da página pública que o cliente vê acompanhando o motoboy em tempo real.
          </p>
          <a
            href="/personalizar-rastreamento"
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90"
          >
            Personalizar página de rastreamento
          </a>
        </Card>

      </div>

      <div className="mt-6">
        <Card title="Notificações no celular">
          <NotificationsCard />
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Mensagens automáticas do WhatsApp">
          <p className="text-xs text-muted-foreground -mt-1 mb-3">
            Personalize o texto. Use variáveis entre chaves que serão substituídas no momento do envio.
          </p>

          <Field label="Mensagem para o cliente — saiu para entrega">
            <Textarea
              rows={7}
              value={f.deliveryMessageTemplate}
              onChange={(e) => setF({ ...f, deliveryMessageTemplate: e.target.value })}
            />
            <div className="flex items-center justify-between mt-1 gap-2 flex-wrap">
              <p className="text-[11px] text-muted-foreground">
                Variáveis: <code>{"{cliente}"}</code>, <code>{"{telefone}"}</code>, <code>{"{produto}"}</code>, <code>{"{endereco}"}</code>, <code>{"{total}"}</code>, <code>{"{loja}"}</code>, <code>{"{observacoes}"}</code>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setF({ ...f, deliveryMessageTemplate: DEFAULT_DELIVERY_TEMPLATE })}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar padrão (com emojis)
              </Button>
            </div>
          </Field>

          <Field label="Mensagem para o motoboy / grupo">

            <Textarea
              rows={10}
              value={f.motoboyMessageTemplate}
              onChange={(e) => setF({ ...f, motoboyMessageTemplate: e.target.value })}
            />
            <div className="flex items-center justify-between mt-1 gap-2 flex-wrap">
              <p className="text-[11px] text-muted-foreground">
                Variáveis: <code>{"{cliente}"}</code>, <code>{"{produto}"}</code>, <code>{"{telefone}"}</code>, <code>{"{endereco}"}</code>, <code>{"{mapa}"}</code>, <code>{"{itens}"}</code>, <code>{"{pagamento}"}</code>, <code>{"{total}"}</code>, <code>{"{observacoes}"}</code>, <code>{"{loja}"}</code>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setF({ ...f, motoboyMessageTemplate: DEFAULT_MOTOBOY_TEMPLATE })}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar padrão (com emojis)
              </Button>
            </div>
          </Field>



          <div className="h-px bg-border my-2" />

          <Field label="Mensagem de acompanhamento do pedido (enviada no botão “Avisar cliente”)">
            <Textarea
              rows={9}
              value={f.customerTrackingMessageTemplate}
              onChange={(e) => setF({ ...f, customerTrackingMessageTemplate: e.target.value })}
              placeholder={DEFAULT_CUSTOMER_TRACKING_TEMPLATE}
            />
            <div className="flex items-center justify-between mt-1 gap-2 flex-wrap">
              <p className="text-[11px] text-muted-foreground">
                Variáveis: <code>{"{customer_name}"}</code>, <code>{"{order_number}"}</code>, <code>{"{tracking_link}"}</code>, <code>{"{store_name}"}</code>, <code>{"{product_name}"}</code>, <code>{"{order_status}"}</code>
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setF({ ...f, customerTrackingMessageTemplate: DEFAULT_CUSTOMER_TRACKING_TEMPLATE })}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar padrão
              </Button>
            </div>
          </Field>

        </Card>
      </div>


      <div className="mt-6 flex justify-end">
        <Button onClick={() => { updateSettings(f); saveSenderInfo(sender); toast.success("Configurações salvas"); }}>Salvar alterações</Button>
      </div>

      <DangerZone />
    </AppShell>
  );
}

function DangerZone() {
  const { stores, activeStore, activeStoreId, deleteStore } = useActiveStore();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = !!activeStore && !activeStore.is_default && stores.length > 1;
  const expected = activeStore?.name ?? "";

  async function handleDelete() {
    if (!activeStoreId || confirmText.trim() !== expected) return;
    setDeleting(true);
    try {
      await deleteStore(activeStoreId);
      toast.success(`Loja "${expected}" excluída`);
      setOpen(false);
      setConfirmText("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir loja");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-10 rounded-2xl border border-destructive/40 bg-destructive/5 p-5 lg:p-6">
      <div className="text-sm font-semibold text-destructive mb-1 flex items-center gap-2">
        <Trash2 className="h-4 w-4" /> Zona de perigo
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        A exclusão remove permanentemente todos os pedidos, produtos, despesas, motoboys e
        configurações desta loja. A loja principal e a última loja restante não podem ser excluídas.
      </p>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="text-sm">
          Loja ativa: <strong>{activeStore?.name ?? "—"}</strong>
          {activeStore?.is_default && (
            <span className="ml-2 text-[11px] text-muted-foreground">(principal — protegida)</span>
          )}
        </div>
        <Button
          variant="destructive"
          disabled={!canDelete}
          onClick={() => setOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-1" /> Excluir esta loja
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => !deleting && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir loja "{expected}"</DialogTitle>
            <DialogDescription>
              Esta ação é <strong>permanente</strong> e remove todos os pedidos, produtos,
              despesas, motoboys e configurações desta loja. Para confirmar, digite o nome
              exato da loja abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Digite <strong>{expected}</strong> para confirmar</Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={expected}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleting || confirmText.trim() !== expected}
              onClick={handleDelete}
            >
              {deleting ? "Excluindo..." : "Excluir permanentemente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function ProfileCard() {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const q = useQuery({
    queryKey: ["my-profile-full"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      setUserId(u.user.id);
      setEmail(u.user.email ?? null);
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", u.user.id)
        .maybeSingle();
      return data;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (q.data) {
      setFullName(q.data.full_name ?? "");
      setAvatar(q.data.avatar_url ?? null);
    }
  }, [q.data]);

  async function save() {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, full_name: fullName, avatar_url: avatar });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    qc.invalidateQueries({ queryKey: ["my-profile-full"] });
  }

  return (
    <Card title="Meu perfil">
      <div className="flex flex-col gap-4">
        <AvatarUploader value={avatar} onChange={setAvatar} name={fullName} email={email} size={88} />
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Nome exibido">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" />
          </Field>
          <Field label="E-mail">
            <Input value={email ?? ""} disabled />
          </Field>
        </div>
        <div>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar perfil"}</Button>
        </div>
      </div>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 lg:p-6 card-neon">
      <div className="text-sm font-semibold mb-4">{title}</div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function MessageDiagnostic({ saved: _saved, sent }: { saved: string; sent: string }) {
  return (
    <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs">
      <div className="mb-1 font-medium text-muted-foreground">Mensagem enviada ao WhatsApp:</div>
      <pre className="whitespace-pre-wrap break-words rounded-md bg-background/70 p-2 font-sans leading-relaxed">{sent || "—"}</pre>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-md border border-border bg-transparent cursor-pointer shrink-0"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" />
      </div>
    </Field>
  );
}
