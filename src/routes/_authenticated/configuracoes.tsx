import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, DEFAULT_DELIVERY_TEMPLATE, DEFAULT_MOTOBOY_TEMPLATE } from "@/lib/store";
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

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — ZappFy" }] }),
  component: Page,
});

function Page() {
  const { state, updateSettings, resetSeed } = useStore();
  const [f, setF] = useState(state.settings);
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

  return (
    <AppShell
      title="Configurações"
      subtitle="Personalize sua loja, o checkout e suas metas"
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
      <div className="grid lg:grid-cols-2 gap-6">
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
            {f.slug && (
              <div className="mt-2 flex items-center gap-2">
                <Input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/loja/${f.slug}`}
                  className="text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const url = `${window.location.origin}/loja/${f.slug}`;
                    navigator.clipboard?.writeText(url);
                    toast.success("Link copiado!");
                  }}
                >Copiar</Button>
              </div>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">Compartilhe esse link com seus clientes. Eles abrirão o checkout sem precisar de login.</p>
          </Field>
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

        <Card title="Personalização do checkout">
          <Field label="Logo da loja (upload do PC)">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) onLogoFile(file); }}
            />
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 rounded-lg border border-border bg-background/40 grid place-items-center overflow-hidden">
                {f.checkoutLogoUrl ? (
                  <img src={f.checkoutLogoUrl} alt="logo" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 grid gap-1.5">
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" />Enviar imagem
                  </Button>
                  {f.checkoutLogoUrl && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setF({ ...f, checkoutLogoUrl: "" })}>
                      <X className="mr-2 h-4 w-4" />Remover
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {logoDims ? `Tamanho real: ${logoDims.w} × ${logoDims.h}px` : "PNG, JPG ou WebP — até 2MB"}
                </p>
              </div>
            </div>
          </Field>

          <Field label="Ou cole uma URL de imagem">
            <Input
              value={f.checkoutLogoUrl.startsWith("data:") ? "" : f.checkoutLogoUrl}
              onChange={(e) => setF({ ...f, checkoutLogoUrl: e.target.value })}
              placeholder="https://..."
            />
          </Field>

          <Field label="WhatsApp da LOJA — recebe os pedidos (DDI + DDD, só números)">
            <Input
              value={f.whatsapp}
              onChange={(e) => setF({ ...f, whatsapp: e.target.value })}
              placeholder="5581999990000"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Cor de fundo do header (topo)" value={f.checkoutHeaderBgColor} onChange={(v) => setF({ ...f, checkoutHeaderBgColor: v })} />
            <ColorField label="Cor de fundo do checkout (abaixo)" value={f.checkoutBgColor} onChange={(v) => setF({ ...f, checkoutBgColor: v })} />
            <ColorField label="Cor de fundo dos cards" value={f.checkoutCardColor} onChange={(v) => setF({ ...f, checkoutCardColor: v })} />
            <ColorField label="Cor das escritas" value={f.checkoutTextColor} onChange={(v) => setF({ ...f, checkoutTextColor: v })} />
            <ColorField label="Cor do neon dos cards" value={f.checkoutNeonColor} onChange={(v) => setF({ ...f, checkoutNeonColor: v })} />
            <ColorField label="Cor do botão" value={f.checkoutButtonColor} onChange={(v) => setF({ ...f, checkoutButtonColor: v })} />
          </div>

          <Field label="Texto do botão final (enviar pedido)">
            <Input
              value={f.checkoutButtonLabel}
              onChange={(e) => setF({ ...f, checkoutButtonLabel: e.target.value })}
              placeholder="Enviar pedido pelo WhatsApp"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label='Texto "Checkout seguro" (cabeçalho)'>
              <Input
                value={f.checkoutSecureLabel}
                onChange={(e) => setF({ ...f, checkoutSecureLabel: e.target.value })}
                placeholder="Checkout seguro"
              />
            </Field>
            <ColorField label="Cor do 'Checkout seguro'" value={f.checkoutSecureColor} onChange={(v) => setF({ ...f, checkoutSecureColor: v })} />
          </div>

          <Field label={`Tamanho da logo: ${f.checkoutLogoSize}px`}>
            <input
              type="range"
              min={24}
              max={120}
              step={2}
              value={f.checkoutLogoSize}
              onChange={(e) => setF({ ...f, checkoutLogoSize: Number(e.target.value) })}
              className="w-full"
            />
            <p className="text-[11px] text-muted-foreground">A logo é exibida no formato original (PNG transparente fica perfeito).</p>
          </Field>

          <Field label="Posição da logo no cabeçalho">
            <Select
              value={f.checkoutLogoAlign}
              onValueChange={(v) => setF({ ...f, checkoutLogoAlign: v as "left" | "center" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Esquerda</SelectItem>
                <SelectItem value="center">Centralizada</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Card>

        <Card title="Títulos das etapas do checkout">
          <Field label="Título da etapa 1">
            <Input value={f.checkoutStep1Title} onChange={(e) => setF({ ...f, checkoutStep1Title: e.target.value })} placeholder="Dados pessoais" />
          </Field>
          <Field label="Título da etapa 2">
            <Input value={f.checkoutStep2Title} onChange={(e) => setF({ ...f, checkoutStep2Title: e.target.value })} placeholder="Entrega" />
          </Field>
          <Field label="Título da etapa 3">
            <Input value={f.checkoutStep3Title} onChange={(e) => setF({ ...f, checkoutStep3Title: e.target.value })} placeholder="Pagamento" />
          </Field>
        </Card>

        <Card title="Botões das etapas">
          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Cor de fundo dos botões" value={f.checkoutStepButtonColor} onChange={(v) => setF({ ...f, checkoutStepButtonColor: v })} />
            <ColorField label="Cor do texto dos botões" value={f.checkoutStepButtonTextColor} onChange={(v) => setF({ ...f, checkoutStepButtonTextColor: v })} />
          </div>
          <Field label="Texto do botão da etapa 1 (Dados pessoais)">
            <Input value={f.checkoutStep1ButtonLabel} onChange={(e) => setF({ ...f, checkoutStep1ButtonLabel: e.target.value })} placeholder="Continuar" />
          </Field>
          <Field label="Texto do botão da etapa 2 (Entrega)">
            <Input value={f.checkoutStep2ButtonLabel} onChange={(e) => setF({ ...f, checkoutStep2ButtonLabel: e.target.value })} placeholder="Calcular frete" />
          </Field>
          <Field label="Texto do botão da etapa 3 (Pagamento)">
            <Input value={f.checkoutStep3ButtonLabel} onChange={(e) => setF({ ...f, checkoutStep3ButtonLabel: e.target.value })} placeholder="Ir para pagamento" />
          </Field>
        </Card>

        <Card title="Formas de entrega (frete)">
          <p className="text-[11px] text-muted-foreground -mt-2">Cadastre as opções que aparecem após o cliente preencher o CEP. Ex: Motoboy, Correios PAC, SEDEX.</p>
          <div className="grid gap-2">
            {f.shippingOptions.map((opt, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_140px_120px_auto] gap-2 items-end">
                <Field label={idx === 0 ? "Título" : ""}>
                  <Input
                    value={opt.label}
                    onChange={(e) => {
                      const next = [...f.shippingOptions];
                      next[idx] = { ...next[idx], label: e.target.value };
                      setF({ ...f, shippingOptions: next });
                    }}
                    placeholder="Ex: Motoboy"
                  />
                </Field>
                <Field label={idx === 0 ? "Ícone" : ""}>
                  <Select
                    value={opt.icon || "truck"}
                    onValueChange={(v) => {
                      const next = [...f.shippingOptions];
                      next[idx] = { ...next[idx], icon: v };
                      setF({ ...f, shippingOptions: next });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIPPING_ICONS.map(({ key, label, Icon }) => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={idx === 0 ? "Valor (R$)" : ""}>
                  <Input
                    type="number" step="0.01"
                    value={opt.price}
                    onChange={(e) => {
                      const next = [...f.shippingOptions];
                      next[idx] = { ...next[idx], price: Number(e.target.value) };
                      setF({ ...f, shippingOptions: next });
                    }}
                  />
                </Field>
                <Button
                  type="button" variant="ghost" size="icon"
                  onClick={() => setF({ ...f, shippingOptions: f.shippingOptions.filter((_, i) => i !== idx) })}
                ><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => {
              const next: ShippingOption[] = [...f.shippingOptions, { id: `opt-${Date.now()}`, label: "Novo frete", price: 0 }];
              setF({ ...f, shippingOptions: next });
            }}
          ><Plus className="mr-2 h-4 w-4" />Adicionar frete</Button>
        </Card>

        <Card title="Rodapé do checkout">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Mostrar rodapé</div>
              <div className="text-[11px] text-muted-foreground">Exibe marca, CNPJ, e-mail e ícones dos cartões/PIX aceitos.</div>
            </div>
            <Switch checked={f.checkoutFooterEnabled} onCheckedChange={(v) => setF({ ...f, checkoutFooterEnabled: v })} />
          </div>
          <ColorField label="Cor de fundo do rodapé" value={f.checkoutFooterBgColor} onChange={(v) => setF({ ...f, checkoutFooterBgColor: v })} />
          <Field label="Marca (negrito)">
            <Input value={f.checkoutFooterBrand} onChange={(e) => setF({ ...f, checkoutFooterBrand: e.target.value })} placeholder="Esparta Imports" />
          </Field>
          <Field label="Linha de copyright / CNPJ">
            <Textarea value={f.checkoutFooterCopyright} onChange={(e) => setF({ ...f, checkoutFooterCopyright: e.target.value })} placeholder="© 2026 VILIES NEGOCIOS DIGITAIS CNPJ: ..." />
          </Field>
          <Field label="CNPJ exibido no rodapé (opcional)">
            <Input value={f.checkoutFooterCnpj} onChange={(e) => setF({ ...f, checkoutFooterCnpj: e.target.value })} placeholder="50.888.578/0001-02" />
          </Field>
          <Field label="E-mail de suporte">
            <Input value={f.checkoutFooterEmail} onChange={(e) => setF({ ...f, checkoutFooterEmail: e.target.value })} placeholder="suporte@espartaimports.com.br" />
          </Field>
          <Field label="WhatsApp exibido no rodapé (opcional)">
            <Input value={f.checkoutFooterWhatsapp} onChange={(e) => setF({ ...f, checkoutFooterWhatsapp: e.target.value })} placeholder="(81) 99999-0000" />
          </Field>

          <div className="grid gap-2 rounded-lg border border-border p-3">
            <div className="text-sm font-medium mb-1">Exibir no rodapé</div>
            <div className="flex items-center justify-between">
              <span className="text-sm">CNPJ</span>
              <Switch checked={f.checkoutFooterShowCnpj} onCheckedChange={(v) => setF({ ...f, checkoutFooterShowCnpj: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">E-mail</span>
              <Switch checked={f.checkoutFooterShowEmail} onCheckedChange={(v) => setF({ ...f, checkoutFooterShowEmail: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">WhatsApp</span>
              <Switch checked={f.checkoutFooterShowWhatsapp} onCheckedChange={(v) => setF({ ...f, checkoutFooterShowWhatsapp: v })} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="text-sm font-medium">Usar imagem dos cartões (PNG)</div>
              <div className="text-[11px] text-muted-foreground">Exibe uma imagem com as bandeiras já desenhadas no lugar dos ícones.</div>
            </div>
            <Switch checked={f.checkoutFooterShowCardsImage} onCheckedChange={(v) => setF({ ...f, checkoutFooterShowCardsImage: v })} />
          </div>
          <Field label="URL da imagem dos cartões (opcional — deixe em branco para usar a padrão)">
            <Input value={f.checkoutFooterCardsImageUrl} onChange={(e) => setF({ ...f, checkoutFooterCardsImageUrl: e.target.value })} placeholder="https://..." />
          </Field>
          <Field label={`Tamanho da imagem dos cartões: ${f.checkoutFooterCardsImageHeight}px`}>
            <input
              type="range"
              min={20}
              max={120}
              step={2}
              value={f.checkoutFooterCardsImageHeight}
              onChange={(e) => setF({ ...f, checkoutFooterCardsImageHeight: Number(e.target.value) })}
              className="w-full"
            />
          </Field>
          <Field label="Bandeiras (usadas quando a imagem está desativada)">
            <Input value={f.checkoutFooterPayments} onChange={(e) => setF({ ...f, checkoutFooterPayments: e.target.value })} placeholder="pix,visa,mastercard,elo,amex,hipercard,boleto" />
            <p className="text-[11px] text-muted-foreground mt-1">Disponíveis: pix, visa, mastercard, elo, amex, hipercard, boleto.</p>
          </Field>
        </Card>

        <Card title="Pré-visualização do checkout">
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: f.checkoutBgColor || "#0a0a0a", color: f.checkoutTextColor }}
          >
            <div className="flex items-center gap-3">
              {f.checkoutLogoUrl ? (
                <img src={f.checkoutLogoUrl} alt="logo" className="h-10 w-10 rounded-lg object-contain bg-white/5" />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-primary/30 grid place-items-center">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <div>
                <div className="font-bold">{f.storeName || "Sua loja"}</div>
                <div className="text-xs opacity-70">Checkout rápido</div>
              </div>
            </div>
            <div
              className="mt-4 rounded-lg p-3 text-sm"
              style={{
                backgroundColor: f.checkoutCardColor,
                boxShadow: `0 0 18px ${f.checkoutNeonColor}55, inset 0 0 0 1px ${f.checkoutNeonColor}55`,
              }}
            >
              Resumo do pedido · <span style={{ color: f.checkoutNeonColor, textShadow: `0 0 8px ${f.checkoutNeonColor}` }}>Total em neon</span>
            </div>
          </div>
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
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={() => { updateSettings(f); toast.success("Configurações salvas"); }}>Salvar alterações</Button>
      </div>
    </AppShell>
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
