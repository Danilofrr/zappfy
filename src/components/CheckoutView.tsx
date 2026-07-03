import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, ShoppingBag, CheckCircle2, PackageX, Lock } from "lucide-react";
import { getShippingIcon } from "@/lib/shipping-icons";
import { PaymentBadge } from "@/lib/payment-icons";
import { brl } from "@/lib/format";
import { whatsappLink } from "@/lib/tracking";
import type { Product, Settings, PaymentMethod, ShippingOption, Order } from "@/lib/store";
import cardsImageAsset from "@/assets/cards-payment-methods.png.asset.json";

export type CheckoutViewProps = {
  products: Product[];
  settings: Settings;
  /** Called when the order is submitted. Optional — visitors on the public link don't persist orders. */
  onSubmit?: (order: Omit<Order, "id">) => void | Promise<void>;
  /** Show "Voltar ao painel" link (owner preview). Defaults to false. */
  showBackToPanel?: boolean;
};

export function CheckoutView({ products, settings, onSubmit, showBackToPanel = false }: CheckoutViewProps) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [form, setForm] = useState({
    customer: "", phone: "", cpf: "", email: "", cep: "", address: "", reference: "", district: "", city: "", payment: "pix" as PaymentMethod, notes: "",
  });
  const [done, setDone] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [addressReady, setAddressReady] = useState(false);
  const [shippingId, setShippingId] = useState<string>("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cardBrand, setCardBrand] = useState<string>("VISA");
  const [cardInstallments, setCardInstallments] = useState<number>(1);

  const product = products.find((p) => p.id === productId);
  const shipping: ShippingOption | undefined = settings.shippingOptions.find((s) => s.id === shippingId);
  const baseTotal = (product?.price ?? 0) * qty + (shipping?.price ?? 0);
  const CARD_BRANDS = ["VISA", "MASTERCARD", "ELO", "AMEX"] as const;
  const cardFeePct = form.payment === "cartao"
    ? Number(((settings.cardMachineFees ?? {})[cardBrand] ?? {})[cardInstallments] ?? 0)
    : 0;
  const cardFeeAbsorbed = (settings.cardFeeMode ?? "passthrough") === "absorb";
  const cardFeeValue = form.payment === "cartao" ? baseTotal * (cardFeePct / 100) : 0;
  const cardFeeCharged = cardFeeAbsorbed ? 0 : cardFeeValue;
  const total = baseTotal + cardFeeCharged;
  const installmentValue = form.payment === "cartao" && cardInstallments > 0 ? total / cardInstallments : total;


  async function lookupCep(raw: string) {
    const cep = raw.replace(/\D/g, "");
    if (cep.length !== 8) { setAddressReady(false); return; }
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await r.json();
      if (data.erro) { toast.error("CEP não encontrado"); setAddressReady(false); return; }
      setForm((f) => ({
        ...f,
        address: f.address || [data.logradouro, data.complemento].filter(Boolean).join(", "),
        district: f.district || data.bairro || "",
        city: f.city || (data.localidade && data.uf ? `${data.localidade}/${data.uf}` : data.localidade || ""),
      }));
      setAddressReady(true);
    } catch {
      toast.error("Erro ao consultar CEP");
    } finally {
      setCepLoading(false);
    }
  }

  const isLight = settings.checkoutTheme === "light";
  const textColor = settings.checkoutTextColor || (isLight ? "#0f172a" : "#f8fafc");
  const cardColor = settings.checkoutCardColor || (isLight ? "#ffffff" : "#111111");
  const neonColor = settings.checkoutNeonColor || "#a855f7";
  const buttonColor = settings.checkoutButtonColor || neonColor;
  const stepBtnBg = settings.checkoutStepButtonColor || neonColor;
  const stepBtnText = settings.checkoutStepButtonTextColor || "#fff";
  const rootStyle: React.CSSProperties = {
    backgroundColor: settings.checkoutBgColor || (isLight ? "#f8fafc" : "#0a0a0a"),
    color: textColor,
    minHeight: "100vh",
  };
  const cardStyle: React.CSSProperties = {
    backgroundColor: cardColor,
    color: textColor,
    boxShadow: `0 0 22px ${neonColor}40, inset 0 0 0 1px ${neonColor}55`,
    borderRadius: "1rem",
  };
  const themeClass = isLight ? "light" : "dark";

  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    // Validações campo-a-campo (mensagens específicas)
    if (!form.customer?.trim()) { toast.error("Nome do cliente não preenchido"); return; }
    if (!form.phone?.trim() || form.phone.replace(/\D/g, "").length < 8) {
      toast.error("WhatsApp inválido");
      return;
    }
    if (!product) { toast.error("Produto inválido — selecione um produto"); return; }
    if (!Number.isFinite(qty) || qty < 1) { toast.error("Quantidade inválida"); return; }
    if (!form.payment) { toast.error("Forma de pagamento não selecionada"); return; }
    if (!form.address?.trim()) { toast.error("Endereço não preenchido"); return; }
    if (!shipping) { toast.error("Selecione uma forma de entrega"); return; }
    if (product.stock < qty) { toast.error("Estoque insuficiente para esta quantidade"); return; }
    if (!Number.isFinite(total) || total <= 0) { toast.error("Valor total inválido"); return; }

    const unitPrice = Number(product.price ?? 0);
    const itemCost = Number.isFinite(Number(product.cost)) ? Number(product.cost) : unitPrice;
    const shippingValue = Number(shipping.price ?? 0);

    const customerCpf = form.cpf.trim();
    const customerEmail = form.email.trim();
    const payload = {
      customer: form.customer.trim(),
      phone: form.phone.trim(),
      cpf: customerCpf,
      email: customerEmail,
      cep: form.cep,
      address: form.address.trim(),
      reference: form.reference,
      district: form.district,
      city: form.city,
      items: [{
        productId: product.id,
        name: product.name,
        qty: Number(qty),
        price: unitPrice,
        cost: itemCost,
        cpf: customerCpf,
        email: customerEmail,
      }],
      shipping: shippingValue,
      total: Number(total),
      payment: form.payment,
      status: "aguardando" as const,
      notes: [
        customerCpf ? `CPF: ${customerCpf}` : "",
        customerEmail ? `E-mail: ${customerEmail}` : "",
        form.payment === "cartao" ? `Cartão: ${cardBrand} ${cardInstallments}x de ${brl(installmentValue)}` : "",
        form.payment === "cartao" && cardFeePct > 0 ? `Taxa ${cardFeePct.toFixed(2)}% (${brl(cardFeeValue)})${cardFeeAbsorbed ? " — absorvida pela loja" : ""}` : "",
        form.notes || "",
      ].filter(Boolean).join("\n"),
      date: new Date().toISOString(),
    };


    // não logar PII do cliente (nome, telefone, endereço) no console


    setSubmitting(true);
    try {
      await onSubmit?.(payload);
    } catch (e: any) {
      console.error("[checkout] erro ao registrar pedido (seguindo para WhatsApp):", e);
      toast.warning(
        "Não foi possível registrar o pedido no sistema, mas você pode finalizar enviando pelo WhatsApp.",
      );
    }

    setDone(true);
    setSubmitting(false);
  }

  const waNumber = (settings.whatsapp || "").replace(/\D/g, "");
  const waMessage =
    product && shipping
      ? `Olá! Acabei de finalizar meu pedido na loja *${settings.storeName}*.\n\n` +
        `*Produto:* ${product.name} (x${qty})\n` +
        `*Valor unitário:* ${brl(product.price)}\n` +
        `*Entrega (${shipping.label}):* ${brl(shipping.price)}\n` +
        (form.payment === "cartao" && cardFeeValue > 0 && !cardFeeAbsorbed ? `*Taxa cartão (${cardFeePct.toFixed(2)}%):* ${brl(cardFeeValue)}\n` : "") +
        `*Total:* ${brl(total)}\n` +
        (form.payment === "cartao" ? `*Parcelamento:* ${cardBrand} — ${cardInstallments}x de ${brl(installmentValue)}\n` : "") +
        `\n*Nome:* ${form.customer}\n` +
        `*WhatsApp:* ${form.phone}\n` +
        (form.cpf ? `*CPF:* ${form.cpf}\n` : "") +
        (form.email ? `*E-mail:* ${form.email}\n` : "") +
        (form.cep ? `*CEP:* ${form.cep}\n` : "") +
        `*Endereço:* ${form.address}${form.district ? `, ${form.district}` : ""}${form.city ? ` - ${form.city}` : ""}\n` +
        (form.reference ? `*Ponto de referência:* ${form.reference}\n` : "") +
        `*Forma de pagamento:* ${form.payment === "pix" ? "PIX" : form.payment === "cartao" ? `Cartão ${cardBrand} ${cardInstallments}x` : "Dinheiro"}` +
        (form.notes ? `\n*Observações:* ${form.notes}` : "")

      : "";
  const waUrl = waNumber ? whatsappLink(waNumber, waMessage) : "";

  if (done) {
    return (
      <div className={themeClass} style={rootStyle}>
        <div className="min-h-screen grid place-items-center px-4">
          <div className="max-w-md w-full text-center p-8" style={cardStyle}>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full" style={{ backgroundColor: `${neonColor}26` }}>
              <CheckCircle2 className="h-8 w-8" style={{ color: neonColor }}/>
            </div>
            <h1 className="mt-4 text-xl font-bold">Pedido enviado com sucesso!</h1>
            <p className="mt-2 text-sm opacity-70">
              {waUrl
                ? "Para concluir, envie os dados do pedido para o nosso WhatsApp."
                : "Em breve entraremos em contato pelo WhatsApp."}
            </p>
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold w-full"
                style={{ backgroundColor: "#25D366", color: "#fff", boxShadow: "0 0 18px #25D36699" }}
              >
                <svg viewBox="0 0 32 32" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <path d="M19.11 17.21c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.89-.79-1.49-1.77-1.67-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37s-1.05 1.02-1.05 2.49 1.07 2.88 1.22 3.08c.15.2 2.11 3.22 5.11 4.51.72.31 1.27.49 1.71.63.72.23 1.37.2 1.89.12.58-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35zM16 3C9.37 3 4 8.37 4 15c0 2.39.69 4.61 1.88 6.49L4 29l7.71-1.86A11.95 11.95 0 0 0 16 27c6.63 0 12-5.37 12-12S22.63 3 16 3z"/>
                </svg>
                Enviar pedido pelo WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  const noProducts = products.length === 0;
  const payments = (settings.checkoutFooterPayments || "").split(",").map((p) => p.trim()).filter(Boolean);

  return (
    <div className={themeClass} style={rootStyle}>
      <header className="border-b" style={{ borderColor: `${neonColor}33`, backgroundColor: settings.checkoutHeaderBgColor || rootStyle.backgroundColor }}>
        <div className="mx-auto max-w-3xl relative flex items-center gap-3 px-4 sm:px-6 py-3 min-h-16">
          <div
            className={
              settings.checkoutLogoAlign === "center"
                ? "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3"
                : "flex items-center gap-3"
            }
          >
            {settings.checkoutLogoUrl ? (
              <img
                src={settings.checkoutLogoUrl}
                alt={settings.storeName}
                style={{ height: settings.checkoutLogoSize || 40, width: "auto", maxWidth: "60vw" }}
                className="object-contain"
              />
            ) : (
              <>
                <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: neonColor, boxShadow: `0 0 16px ${neonColor}` }}>
                  <TrendingUp className="h-5 w-5 text-white"/>
                </div>
                <div className="min-w-0">
                  <div className="font-bold truncate">{settings.storeName}</div>
                  {showBackToPanel && (
                    <Link to="/" className="text-[11px] opacity-60 hover:opacity-100">Voltar ao painel</Link>
                  )}
                </div>
              </>
            )}
          </div>
          {settings.checkoutSecureLabel && (
            <div className="ml-auto flex items-center gap-1.5 text-xs font-semibold" style={{ color: settings.checkoutSecureColor || neonColor }}>
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">{settings.checkoutSecureLabel}</span>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        {noProducts ? (
          <div className="p-10 text-center" style={cardStyle}>
            <PackageX className="mx-auto h-10 w-10 opacity-50" />
            <h2 className="mt-4 font-bold">Nenhum produto disponível</h2>
            <p className="mt-1 text-sm opacity-70">Volte mais tarde — a loja ainda não cadastrou produtos.</p>
          </div>
        ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-3">
            <div className="p-5" style={cardStyle}>
              <div className="text-xs uppercase tracking-wider opacity-60 mb-3">Seu pedido</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Produto">
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id} disabled={p.stock <= 0}>
                          {p.name}{p.stock <= 0 ? " (indisponível)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Quantidade">
                  <Input
                    type="number"
                    min={1}
                    max={product?.stock ?? 1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.min(product?.stock ?? 1, Number(e.target.value))))}
                  />
                </Field>
              </div>
            </div>

            <StepCard
              n={1} title={settings.checkoutStep1Title || "Dados pessoais"}
              state={step === 1 ? "active" : step > 1 ? "done" : "locked"}
              neonColor={neonColor} cardStyle={cardStyle}
              summary={step > 1 ? `${form.customer} · ${form.phone}` : undefined}
              onEdit={() => setStep(1)}
            >
              <div className="grid gap-4">
                <Field label="Nome completo"><Input value={form.customer} onChange={(e) => setForm({...form, customer: e.target.value})} placeholder="Seu nome"/></Field>
                <Field label="Telefone (WhatsApp)"><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="(81) 99999-9999"/></Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="CPF (opcional)">
                    <Input value={form.cpf} onChange={(e) => setForm({...form, cpf: e.target.value})} placeholder="000.000.000-00" inputMode="numeric"/>
                  </Field>
                  <Field label="E-mail (opcional)">
                    <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder="voce@email.com"/>
                  </Field>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => {
                      if (!product) return toast.error("Selecione um produto");
                      if (!form.customer || !form.phone) return toast.error("Preencha nome e telefone");
                      setStep(2);
                    }}
                    style={{ backgroundColor: stepBtnBg, color: stepBtnText }}
                  >{settings.checkoutStep1ButtonLabel || "Continuar"}</Button>
                </div>
              </div>
            </StepCard>

            <StepCard
              n={2} title={settings.checkoutStep2Title || "Entrega"}
              state={step === 2 ? "active" : step > 2 ? "done" : "locked"}
              neonColor={neonColor} cardStyle={cardStyle}
              summary={step > 2 && shipping ? `${shipping.label} — ${brl(shipping.price)}` : undefined}
              onEdit={() => setStep(2)}
            >
              <div className="grid gap-4">
                <Field label="CEP">
                  <Input
                    value={form.cep}
                    onChange={(e) => { setForm({...form, cep: e.target.value}); setAddressReady(false); setShippingId(""); }}
                    onBlur={(e) => lookupCep(e.target.value)}
                    placeholder="00000-000"
                    inputMode="numeric"
                  />
                  {cepLoading && <p className="text-[11px] opacity-60 mt-1">Consultando CEP...</p>}
                </Field>
                {addressReady && (
                  <>
                    <Field label="Endereço"><Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} placeholder="Rua, número, complemento"/></Field>
                    <Field label="Ponto de referência"><Input value={form.reference} onChange={(e) => setForm({...form, reference: e.target.value})} placeholder="Ex: próximo à padaria, portão azul..."/></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Bairro"><Input value={form.district} onChange={(e) => setForm({...form, district: e.target.value})}/></Field>
                      <Field label="Cidade"><Input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})}/></Field>
                    </div>
                    <div>
                      <Label className="text-xs mb-2 block">Forma de entrega <span className="opacity-60">(toque para selecionar)</span></Label>
                      <div className="grid gap-2" role="radiogroup">
                        {settings.shippingOptions.map((opt) => {
                          const active = shippingId === opt.id;
                          const Icon = getShippingIcon(opt.icon);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setShippingId(opt.id)}
                              className="flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors"
                              style={{
                                border: `1px solid ${active ? neonColor : `${neonColor}33`}`,
                                backgroundColor: active ? `${neonColor}1a` : "transparent",
                                boxShadow: active ? `0 0 14px ${neonColor}55` : "none",
                              }}
                            >
                              <span
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors"
                                style={{
                                  border: `2px solid ${neonColor}`,
                                  backgroundColor: active ? neonColor : "transparent",
                                }}
                                aria-hidden
                              >
                                {active && <span className="h-2 w-2 rounded-full bg-background" />}
                              </span>
                              <Icon className="h-5 w-5 shrink-0" style={{ color: neonColor }}/>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">{opt.label}</div>
                              </div>
                              <div className="text-sm font-bold">{brl(opt.price)}</div>
                            </button>
                          );
                        })}
                        {settings.shippingOptions.length === 0 && (
                          <p className="text-xs opacity-60">Nenhuma forma de entrega configurada.</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => {
                      if (!addressReady) return toast.error("Informe um CEP válido");
                      if (!form.address) return toast.error("Preencha o endereço");
                      if (!shipping) return toast.error("Selecione uma forma de entrega");
                      setStep(3);
                    }}
                    style={{ backgroundColor: stepBtnBg, color: stepBtnText }}
                  >{settings.checkoutStep2ButtonLabel || "Continuar"}</Button>
                </div>
              </div>
            </StepCard>

            <StepCard
              n={3} title={settings.checkoutStep3Title || "Pagamento"}
              state={step === 3 ? "active" : "locked"}
              neonColor={neonColor} cardStyle={cardStyle}
            >
              <div className="grid gap-4">
                <div>
                  <Label className="text-xs mb-2 block">Forma de pagamento</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["pix", "cartao", "dinheiro"] as PaymentMethod[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setForm({...form, payment: p})}
                        className={`rounded-lg border px-3 py-2.5 text-sm font-medium capitalize transition-colors ${
                          form.payment === p ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                        }`}
                      >{p === "cartao" ? "Cartão" : p === "pix" ? "PIX" : "Dinheiro"}</button>
                    ))}
                  </div>
                </div>
                {form.payment === "cartao" && (
                  <div className="grid gap-3 rounded-lg p-3" style={{ border: `1px solid ${neonColor}33`, backgroundColor: `${neonColor}08` }}>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Bandeira">
                        <Select value={cardBrand} onValueChange={(v) => setCardBrand(v)}>
                          <SelectTrigger><SelectValue/></SelectTrigger>
                          <SelectContent>
                            {CARD_BRANDS.map((b) => (
                              <SelectItem key={b} value={b}>{b}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Parcelas">
                        <Select value={String(cardInstallments)} onValueChange={(v) => setCardInstallments(Number(v))}>
                          <SelectTrigger><SelectValue/></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => {
                              const pct = Number(((settings.cardMachineFees ?? {})[cardBrand] ?? {})[n] ?? 0);
                              const t = cardFeeAbsorbed ? baseTotal : baseTotal + baseTotal * (pct / 100);
                              const suffix = cardFeeAbsorbed ? " sem juros" : "";
                              return (
                                <SelectItem key={n} value={String(n)}>
                                  {n}x de {brl(t / n)}{suffix}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="text-xs space-y-1 opacity-90">
                      <div className="flex justify-between"><span>Subtotal</span><span>{brl(baseTotal)}</span></div>
                      {cardFeeValue > 0 && !cardFeeAbsorbed && (
                        <div className="flex justify-between"><span>Taxa maquininha ({cardFeePct.toFixed(2)}%)</span><span>{brl(cardFeeValue)}</span></div>
                      )}
                      {cardFeeValue > 0 && cardFeeAbsorbed && (
                        <div className="flex justify-between opacity-70"><span>Taxa maquininha ({cardFeePct.toFixed(2)}%)</span><span>Por conta da loja</span></div>
                      )}
                      <div className="flex justify-between font-semibold pt-1" style={{ borderTop: `1px dashed ${neonColor}55` }}>
                        <span>Total no cartão</span><span>{brl(total)}</span>
                      </div>
                      <div className="flex justify-between font-semibold" style={{ color: neonColor }}>
                        <span>{cardInstallments}x</span><span>{brl(installmentValue)}</span>
                      </div>
                    </div>
                  </div>
                )}
                <Field label="Observações (opcional)"><Textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} placeholder="Ex: tocar interfone, troco para R$ 200..."/></Field>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={submit}
                    disabled={submitting}
                    className="font-semibold"
                    style={{ backgroundColor: buttonColor, color: stepBtnText, boxShadow: `0 0 20px ${buttonColor}99` }}
                  >
                    {submitting ? "Enviando..." : (settings.checkoutButtonLabel || settings.checkoutStep3ButtonLabel || "Enviar pedido pelo WhatsApp")}
                  </Button>
                </div>
              </div>
            </StepCard>
          </div>

          <aside className="p-6 h-fit lg:sticky lg:top-6" style={cardStyle}>
            <div className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="h-4 w-4" style={{ color: neonColor }}/>Resumo</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                {product?.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-14 w-14 rounded-lg object-cover shrink-0"
                    style={{ border: `1px solid ${neonColor}33` }}
                  />
                ) : (
                  <div
                    className="h-14 w-14 rounded-lg grid place-items-center shrink-0"
                    style={{ border: `1px solid ${neonColor}33`, backgroundColor: `${neonColor}10` }}
                  >
                    <ShoppingBag className="h-5 w-5 opacity-50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{product?.name ?? "—"}</div>
                  <div className="text-xs opacity-60">Quantidade: {qty}</div>
                </div>
                <div className="text-sm font-semibold">{brl((product?.price ?? 0) * qty)}</div>
              </div>
              <Row
                label={shipping?.label || "Entrega"}
                value={shipping ? brl(shipping.price) : (cepLoading ? "calculando..." : "selecione")}
              />
              {form.payment === "cartao" && cardFeeValue > 0 && !cardFeeAbsorbed && (
                <Row label={`Taxa cartão (${cardFeePct.toFixed(2)}%)`} value={brl(cardFeeValue)} />
              )}
              <div className="pt-3 flex justify-between" style={{ borderTop: `1px solid ${neonColor}33` }}>
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg">{brl(total)}</span>
              </div>
              {form.payment === "cartao" && (
                <div className="text-xs text-right opacity-80">
                  ou <span className="font-semibold" style={{ color: neonColor }}>{cardInstallments}x de {brl(installmentValue)}</span> no {cardBrand}
                </div>
              )}

            </div>
          </aside>
        </div>
        )}
      </main>

      {settings.checkoutFooterEnabled && (
        <footer
          className="border-t mt-3"
          style={{
            borderColor: `${neonColor}22`,
            backgroundColor: settings.checkoutFooterBgColor || settings.checkoutHeaderBgColor || rootStyle.backgroundColor,
          }}
        >
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-5 text-center space-y-3">
            {settings.checkoutFooterShowCardsImage ? (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider opacity-60">Formas de pagamento aceitas</div>
                <div className="flex justify-center">
                  <img
                    src={settings.checkoutFooterCardsImageUrl || cardsImageAsset.url}
                    alt="Bandeiras aceitas"
                    className="max-w-full h-auto"
                    style={{ height: settings.checkoutFooterCardsImageHeight || 40, width: "auto" }}
                  />
                </div>
              </div>
            ) : payments.length > 0 ? (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider opacity-60">Formas de pagamento aceitas</div>
                <div className="flex flex-wrap justify-center items-center gap-3">
                  {payments.map((p) => (
                    <PaymentBadge key={p} brand={p} />
                  ))}
                </div>
              </div>
            ) : null}
            {settings.checkoutFooterBrand && (
              <div className="text-sm font-bold pt-1">{settings.checkoutFooterBrand}</div>
            )}
            {settings.checkoutFooterCopyright && (
              <div className="text-[11px] opacity-70">{settings.checkoutFooterCopyright}</div>
            )}
            {settings.checkoutFooterShowCnpj && settings.checkoutFooterCnpj && (
              <div className="text-[11px] opacity-70">CNPJ: {settings.checkoutFooterCnpj}</div>
            )}
            {settings.checkoutFooterShowEmail && settings.checkoutFooterEmail && (
              <div className="text-[11px] opacity-70">E-mail: {settings.checkoutFooterEmail}</div>
            )}
            {settings.checkoutFooterShowWhatsapp && settings.checkoutFooterWhatsapp && (
              <div className="text-[11px] opacity-70">WhatsApp: {settings.checkoutFooterWhatsapp}</div>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between opacity-80"><span className="truncate pr-2">{label}</span><span className="opacity-100">{value}</span></div>;
}
function StepCard({
  n, title, state, neonColor, cardStyle, summary, onEdit, children,
}: {
  n: 1 | 2 | 3;
  title: string;
  state: "active" | "done" | "locked";
  neonColor: string;
  cardStyle: React.CSSProperties;
  summary?: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  const headerBadge = (
    <div
      className="h-8 w-8 grid place-items-center rounded-full text-xs font-bold shrink-0"
      style={{
        backgroundColor: state === "locked" ? "transparent" : neonColor,
        color: state === "locked" ? "currentColor" : "#fff",
        border: `1px solid ${neonColor}${state === "locked" ? "55" : ""}`,
        boxShadow: state === "active" ? `0 0 12px ${neonColor}` : "none",
        opacity: state === "locked" ? 0.5 : 1,
      }}
    >
      {state === "done" ? "✓" : n}
    </div>
  );

  if (state === "active") {
    return (
      <div className="p-5" style={cardStyle}>
        <div className="flex items-center gap-3 mb-4">
          {headerBadge}
          <h2 className="font-bold">{title}</h2>
        </div>
        {children}
      </div>
    );
  }
  const isDoneClickable = state === "done" && !!onEdit;
  return (
    <div
      role={isDoneClickable ? "button" : undefined}
      tabIndex={isDoneClickable ? 0 : undefined}
      onClick={isDoneClickable ? onEdit : undefined}
      onKeyDown={isDoneClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit?.(); } } : undefined}
      className={`p-4 flex items-center gap-3 ${isDoneClickable ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
      style={{ ...cardStyle, opacity: state === "locked" ? 0.55 : 1, boxShadow: "none", border: `1px solid ${neonColor}22` }}
    >
      {headerBadge}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{title}</div>
        {summary && <div className="text-xs opacity-70 truncate">{summary}</div>}
      </div>
      {state === "done" && (
        <span className="text-xs font-medium" style={{ color: neonColor }}>Editar</span>
      )}
    </div>
  );
}
