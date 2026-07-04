import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, X, ExternalLink, Copy, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { buildPublicUrl } from "@/lib/public-url";
import { usePublicBaseUrl } from "@/hooks/use-public-base-url";
import { SHIPPING_ICONS, getShippingIcon } from "@/lib/shipping-icons";
import type { ShippingOption } from "@/lib/store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/personalizar-checkout")({
  head: () => ({ meta: [{ title: "Personalizar Checkout — ZappFy" }] }),
  component: Page,
});

function Page() {
  const { state, updateSettings } = useStore();
  const publicBaseUrl = usePublicBaseUrl();
  const [f, setF] = useState(state.settings);
  const [logoDims, setLogoDims] = useState<{ w: number; h: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setF(state.settings); }, [state.settings]);

  useEffect(() => {
    if (!f.checkoutLogoUrl) { setLogoDims(null); return; }
    const img = new Image();
    img.onload = () => setLogoDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setLogoDims(null);
    img.src = f.checkoutLogoUrl;
  }, [f.checkoutLogoUrl]);

  function onLogoFile(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem muito grande (máx 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => setF((p) => ({ ...p, checkoutLogoUrl: String(reader.result || "") }));
    reader.readAsDataURL(file);
  }

  const publicUrl = f.slug ? buildPublicUrl(`/loja/${f.slug}`, publicBaseUrl) : "";

  return (
    <AppShell
      title="Personalizar Checkout"
      subtitle="Deixe a página de pedido com a cara da sua loja"
      actions={
        publicUrl ? (
          <Button variant="outline" asChild>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" /> Abrir checkout
            </a>
          </Button>
        ) : undefined
      }
    >
      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Form column */}
        <div className="grid gap-6">
          {/* MARCA */}
          <Card title="Marca da loja">
            <Field label="Nome da loja">
              <Input value={f.storeName} onChange={(e) => setF({ ...f, storeName: e.target.value })} />
            </Field>

            <Field label="Link público (slug)">
              <Input
                value={f.slug}
                onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                placeholder="minha-loja"
              />
              {publicUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <Input readOnly value={publicUrl} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
                  <Button type="button" variant="outline" onClick={() => { navigator.clipboard?.writeText(publicUrl); toast.success("Link copiado!"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">É esse o endereço que você compartilha com seus clientes.</p>
            </Field>

            <Field label="Logo da loja">
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
                      <Upload className="mr-2 h-4 w-4" /> Enviar imagem
                    </Button>
                    {f.checkoutLogoUrl && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setF({ ...f, checkoutLogoUrl: "" })}>
                        <X className="mr-2 h-4 w-4" /> Remover
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
            </Field>
          </Card>

          {/* CORES E TEMA */}
          <Card title="Cores e tema">
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Fundo do topo (header)" value={f.checkoutHeaderBgColor} onChange={(v) => setF({ ...f, checkoutHeaderBgColor: v })} />
              <ColorField label="Fundo do checkout" value={f.checkoutBgColor} onChange={(v) => setF({ ...f, checkoutBgColor: v })} />
              <ColorField label="Fundo dos cards" value={f.checkoutCardColor} onChange={(v) => setF({ ...f, checkoutCardColor: v })} />
              <ColorField label="Cor das escritas" value={f.checkoutTextColor} onChange={(v) => setF({ ...f, checkoutTextColor: v })} />
              <ColorField label="Neon dos cards" value={f.checkoutNeonColor} onChange={(v) => setF({ ...f, checkoutNeonColor: v })} />
              <ColorField label="Botão final" value={f.checkoutButtonColor} onChange={(v) => setF({ ...f, checkoutButtonColor: v })} />
              <ColorField label="Botões das etapas" value={f.checkoutStepButtonColor} onChange={(v) => setF({ ...f, checkoutStepButtonColor: v })} />
              <ColorField label="Texto dos botões" value={f.checkoutStepButtonTextColor} onChange={(v) => setF({ ...f, checkoutStepButtonTextColor: v })} />
              <ColorField label="Texto 'Checkout seguro'" value={f.checkoutSecureColor} onChange={(v) => setF({ ...f, checkoutSecureColor: v })} />
            </div>
          </Card>

          {/* FORMAS DE ENTREGA */}
          <Card title="Formas de entrega">
            <p className="text-[11px] text-muted-foreground -mt-2">
              Configure as opções de entrega e o valor que aparecerá no checkout (ex.: Motoboy, Retirada, Correios).
            </p>
            <div className="grid gap-2">
              {(f.shippingOptions || []).map((opt, idx) => {
                const Icon = getShippingIcon(opt.icon);
                return (
                  <div key={opt.id} className="rounded-lg border border-border p-3 grid gap-2 sm:grid-cols-[auto_1fr_140px_150px_auto] sm:items-end">
                    <div className="h-10 w-10 grid place-items-center rounded-md border border-border bg-background/40 shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Field label="Nome">
                      <Input
                        value={opt.label}
                        onChange={(e) => {
                          const next = [...f.shippingOptions];
                          next[idx] = { ...opt, label: e.target.value };
                          setF({ ...f, shippingOptions: next });
                        }}
                        placeholder="Motoboy"
                      />
                    </Field>
                    <Field label="Valor (R$)">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={opt.price}
                        onChange={(e) => {
                          const next = [...f.shippingOptions];
                          next[idx] = { ...opt, price: Number(e.target.value) || 0 };
                          setF({ ...f, shippingOptions: next });
                        }}
                      />
                    </Field>
                    <Field label="Ícone">
                      <Select
                        value={opt.icon || "truck"}
                        onValueChange={(v) => {
                          const next = [...f.shippingOptions];
                          next[idx] = { ...opt, icon: v };
                          setF({ ...f, shippingOptions: next });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SHIPPING_ICONS.map((i) => (
                            <SelectItem key={i.key} value={i.key}>
                              <span className="inline-flex items-center gap-2">
                                <i.Icon className="h-4 w-4" /> {i.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const next = f.shippingOptions.filter((_, i) => i !== idx);
                        setF({ ...f, shippingOptions: next });
                      }}
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
              {(f.shippingOptions || []).length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma forma de entrega cadastrada.</p>
              )}
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newOpt: ShippingOption = {
                    id: `ship-${Date.now().toString(36)}`,
                    label: "Nova entrega",
                    price: 0,
                    icon: "truck",
                  };
                  setF({ ...f, shippingOptions: [...(f.shippingOptions || []), newOpt] });
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar forma de entrega
              </Button>
            </div>
          </Card>

          {/* RODAPÉ */}

          <Card title="Rodapé do checkout">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium">Mostrar rodapé</div>
                <div className="text-[11px] text-muted-foreground">Exibe marca, contatos e bandeiras de pagamento.</div>
              </div>
              <Switch checked={f.checkoutFooterEnabled} onCheckedChange={(v) => setF({ ...f, checkoutFooterEnabled: v })} />
            </div>

            <ColorField label="Cor de fundo do rodapé" value={f.checkoutFooterBgColor} onChange={(v) => setF({ ...f, checkoutFooterBgColor: v })} />

            <Field label="Marca (em negrito)">
              <Input value={f.checkoutFooterBrand} onChange={(e) => setF({ ...f, checkoutFooterBrand: e.target.value })} placeholder={f.storeName} />
            </Field>

            <Field label="Linha de copyright">
              <Textarea
                rows={2}
                value={f.checkoutFooterCopyright}
                onChange={(e) => setF({ ...f, checkoutFooterCopyright: e.target.value })}
                placeholder="© 2026 Sua Empresa LTDA"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="WhatsApp">
                <Input value={f.checkoutFooterWhatsapp} onChange={(e) => setF({ ...f, checkoutFooterWhatsapp: e.target.value })} placeholder="(00) 00000-0000" />
              </Field>
              <Field label="CNPJ">
                <Input value={f.checkoutFooterCnpj} onChange={(e) => setF({ ...f, checkoutFooterCnpj: e.target.value })} placeholder="00.000.000/0001-00" />
              </Field>
            </div>

            <Field label="E-mail de suporte">
              <Input value={f.checkoutFooterEmail} onChange={(e) => setF({ ...f, checkoutFooterEmail: e.target.value })} placeholder="contato@sualoja.com" />
            </Field>

            <div className="grid gap-2 rounded-lg border border-border p-3">
              <div className="text-sm font-medium mb-1">Exibir no rodapé</div>
              <ToggleRow label="WhatsApp" checked={f.checkoutFooterShowWhatsapp} onChange={(v) => setF({ ...f, checkoutFooterShowWhatsapp: v })} />
              <ToggleRow label="CNPJ" checked={f.checkoutFooterShowCnpj} onChange={(v) => setF({ ...f, checkoutFooterShowCnpj: v })} />
              <ToggleRow label="E-mail" checked={f.checkoutFooterShowEmail} onChange={(v) => setF({ ...f, checkoutFooterShowEmail: v })} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium">Imagem das bandeiras (PNG)</div>
                <div className="text-[11px] text-muted-foreground">Substitui os ícones padrão por uma imagem sua.</div>
              </div>
              <Switch checked={f.checkoutFooterShowCardsImage} onCheckedChange={(v) => setF({ ...f, checkoutFooterShowCardsImage: v })} />
            </div>

            <Field label="URL da imagem das bandeiras">
              <Input value={f.checkoutFooterCardsImageUrl} onChange={(e) => setF({ ...f, checkoutFooterCardsImageUrl: e.target.value })} placeholder="https://..." />
            </Field>

            <Field label={`Altura da imagem: ${f.checkoutFooterCardsImageHeight}px`}>
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

            <Field label="Bandeiras exibidas (quando a imagem está desativada)">
              <Input
                value={f.checkoutFooterPayments}
                onChange={(e) => setF({ ...f, checkoutFooterPayments: e.target.value })}
                placeholder="pix,visa,mastercard,elo,amex,hipercard,boleto"
              />
              <p className="text-[11px] text-muted-foreground mt-1">Disponíveis: pix, visa, mastercard, elo, amex, hipercard, boleto.</p>
            </Field>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => { updateSettings(f); toast.success("Personalização salva"); }}>Salvar alterações</Button>
          </div>
        </div>

        {/* Preview column */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Card title="Pré-visualização">
            <div className="rounded-xl overflow-hidden border border-border">
              {/* Header */}
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ backgroundColor: f.checkoutHeaderBgColor || "#0a0a0a", color: f.checkoutTextColor }}
              >
                {f.checkoutLogoUrl ? (
                  <img
                    src={f.checkoutLogoUrl}
                    alt="logo"
                    style={{ height: f.checkoutLogoSize, maxHeight: f.checkoutLogoSize }}
                    className="object-contain"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-primary/30 grid place-items-center">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <div className="ml-auto text-xs" style={{ color: f.checkoutSecureColor }}>
                  {f.checkoutSecureLabel || "Checkout seguro"}
                </div>
              </div>

              {/* Body */}
              <div className="p-4 space-y-3" style={{ backgroundColor: f.checkoutBgColor || "#0a0a0a", color: f.checkoutTextColor }}>
                <div className="text-sm font-semibold">{f.storeName || "Sua loja"}</div>
                <div
                  className="rounded-lg p-3 text-sm"
                  style={{
                    backgroundColor: f.checkoutCardColor,
                    boxShadow: `0 0 18px ${f.checkoutNeonColor}55, inset 0 0 0 1px ${f.checkoutNeonColor}55`,
                  }}
                >
                  Resumo do pedido ·{" "}
                  <span style={{ color: f.checkoutNeonColor, textShadow: `0 0 8px ${f.checkoutNeonColor}` }}>R$ 199,90</span>
                </div>
                <button
                  className="w-full rounded-lg py-2 text-sm font-semibold"
                  style={{ backgroundColor: f.checkoutStepButtonColor, color: f.checkoutStepButtonTextColor }}
                >
                  {f.checkoutStep1ButtonLabel || "Continuar"}
                </button>
                <button
                  className="w-full rounded-lg py-2 text-sm font-semibold"
                  style={{ backgroundColor: f.checkoutButtonColor, color: "#fff" }}
                >
                  {f.checkoutButtonLabel || "Enviar pedido pelo WhatsApp"}
                </button>
              </div>

              {/* Footer */}
              {f.checkoutFooterEnabled && (
                <div
                  className="px-4 py-3 text-[11px] space-y-1"
                  style={{ backgroundColor: f.checkoutFooterBgColor || "#000", color: f.checkoutTextColor }}
                >
                  {f.checkoutFooterBrand && <div className="font-bold">{f.checkoutFooterBrand}</div>}
                  {f.checkoutFooterShowWhatsapp && f.checkoutFooterWhatsapp && <div>WhatsApp: {f.checkoutFooterWhatsapp}</div>}
                  {f.checkoutFooterShowEmail && f.checkoutFooterEmail && <div>{f.checkoutFooterEmail}</div>}
                  {f.checkoutFooterShowCnpj && f.checkoutFooterCnpj && <div>CNPJ: {f.checkoutFooterCnpj}</div>}
                  {f.checkoutFooterCopyright && <div className="opacity-70 mt-1">{f.checkoutFooterCopyright}</div>}
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              A pré-visualização é simplificada. Use “Abrir checkout” para ver o resultado real.
            </p>
          </Card>
        </div>
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

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
