import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore, type PaymentMethod, type ShippingOption } from "@/lib/store";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, ShoppingBag, CheckCircle2, PackageX, Lock, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({
    meta: [
      { title: "Finalizar Pedido" },
      { name: "description", content: "Complete seu pedido em poucos segundos." },
    ],
  }),
  component: Checkout,
});

function Checkout() {
  const { state, addOrder } = useStore();
  const products = state.products;
  const settings = state.settings;
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [form, setForm] = useState({
    customer: "", phone: "", cep: "", address: "", reference: "", district: "", city: "", payment: "pix" as PaymentMethod, notes: "",
  });
  const [done, setDone] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [addressReady, setAddressReady] = useState(false);
  const [shippingId, setShippingId] = useState<string>("");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const product = products.find((p) => p.id === productId);
  const shipping: ShippingOption | undefined = settings.shippingOptions.find((s) => s.id === shippingId);
  const total = (product?.price ?? 0) * qty + (shipping?.price ?? 0);

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

  function submit() {
    if (!product || !form.customer || !form.phone) {
      toast.error("Preencha nome, telefone e selecione um produto");
      return;
    }
    if (!shipping) {
      toast.error("Selecione uma forma de entrega");
      return;
    }
    if (product.stock < qty) {
      toast.error("Estoque insuficiente para esta quantidade");
      return;
    }
    addOrder({
      customer: form.customer,
      phone: form.phone,
      address: form.address,
      district: form.district,
      city: form.city,
      items: [{ productId: product.id, name: product.name, qty, price: product.price, cost: product.cost }],
      total,
      payment: form.payment,
      status: "aguardando",
      notes: form.notes,
      date: new Date().toISOString(),
    });

    const msg = `Olá, gostaria de finalizar meu pedido.%0A%0A` +
      `*Produto:* ${product.name} (x${qty})%0A` +
      `*Nome:* ${form.customer}%0A` +
      `*Telefone:* ${form.phone}%0A` +
      `*Endereço:* ${form.address}, ${form.district} - ${form.city}%0A` +
      (form.reference ? `*Ponto de referência:* ${form.reference}%0A` : "") +
      `*Entrega (${shipping.label}):* ${brl(shipping.price)}%0A` +
      `*Pagamento:* ${form.payment.toUpperCase()}%0A` +
      `*Total:* ${brl(total)}` +
      (form.notes ? `%0A*Obs:* ${form.notes}` : "");

    setDone(true);
    setTimeout(() => {
      window.location.href = `https://wa.me/${settings.whatsapp}?text=${msg}`;
    }, 1200);
  }

  if (done) {
    return (
      <div className={themeClass} style={rootStyle}>
        <div className="min-h-screen grid place-items-center px-4">
          <div className="max-w-md w-full text-center p-8" style={cardStyle}>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full" style={{ backgroundColor: `${neonColor}26` }}>
              <CheckCircle2 className="h-8 w-8" style={{ color: neonColor }}/>
            </div>
            <h1 className="mt-4 text-xl font-bold">Pedido enviado!</h1>
            <p className="mt-2 text-sm opacity-70">Estamos redirecionando você para o WhatsApp da loja para confirmar...</p>
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
        <div className="mx-auto max-w-3xl flex items-center gap-3 px-4 sm:px-6 h-16">
          {settings.checkoutLogoUrl ? (
            <img src={settings.checkoutLogoUrl} alt={settings.storeName} className="h-10 w-10 rounded-xl object-contain" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: neonColor, boxShadow: `0 0 16px ${neonColor}` }}>
              <TrendingUp className="h-5 w-5 text-white"/>
            </div>
          )}
          <div className="min-w-0">
            <div className="font-bold truncate">{settings.storeName}</div>
            <Link to="/" className="text-[11px] opacity-60 hover:opacity-100">Voltar ao painel</Link>
          </div>
          {settings.checkoutSecureLabel && (
            <div className="ml-auto flex items-center gap-1.5 text-xs font-semibold" style={{ color: neonColor }}>
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
            <h2 className="mt-4 font-bold">Nenhum produto cadastrado</h2>
            <p className="mt-1 text-sm opacity-70">Cadastre seus produtos em Produtos para começar a vender.</p>
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

            {/* Etapa 1 */}
            <StepCard
              n={1} title="Dados pessoais"
              state={step === 1 ? "active" : step > 1 ? "done" : "locked"}
              neonColor={neonColor} cardStyle={cardStyle}
              summary={step > 1 ? `${form.customer} · ${form.phone}` : undefined}
              onEdit={() => setStep(1)}
            >
              <div className="grid gap-4">
                <Field label="Nome completo"><Input value={form.customer} onChange={(e) => setForm({...form, customer: e.target.value})} placeholder="Seu nome"/></Field>
                <Field label="Telefone (WhatsApp)"><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="(81) 99999-9999"/></Field>
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

            {/* Etapa 2 */}
            <StepCard
              n={2} title="Entrega"
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

                    {/* Formas de entrega */}
                    <div>
                      <Label className="text-xs mb-2 block">Forma de entrega</Label>
                      <div className="grid gap-2">
                        {settings.shippingOptions.map((opt) => {
                          const active = shippingId === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setShippingId(opt.id)}
                              className="flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors"
                              style={{
                                border: `1px solid ${active ? neonColor : `${neonColor}33`}`,
                                backgroundColor: active ? `${neonColor}1a` : "transparent",
                                boxShadow: active ? `0 0 14px ${neonColor}55` : "none",
                              }}
                            >
                              <Truck className="h-4 w-4 shrink-0" style={{ color: neonColor }}/>
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

            {/* Etapa 3 */}
            <StepCard
              n={3} title="Pagamento"
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
                <Field label="Observações (opcional)"><Textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} placeholder="Ex: tocar interfone, troco para R$ 200..."/></Field>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={submit}
                    className="font-semibold"
                    style={{ backgroundColor: buttonColor, color: stepBtnText, boxShadow: `0 0 20px ${buttonColor}99` }}
                  >
                    {settings.checkoutButtonLabel || settings.checkoutStep3ButtonLabel || "Enviar pedido pelo WhatsApp"}
                  </Button>
                </div>
              </div>
            </StepCard>
          </div>

          <aside className="p-6 h-fit lg:sticky lg:top-6" style={cardStyle}>
            <div className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="h-4 w-4" style={{ color: neonColor }}/>Resumo</div>
            <div className="mt-4 space-y-2 text-sm">
              <Row label={`${product?.name ?? "—"} × ${qty}`} value={brl((product?.price ?? 0) * qty)}/>
              <Row
                label={shipping?.label || "Entrega"}
                value={shipping ? brl(shipping.price) : (cepLoading ? "calculando..." : "selecione")}
              />
              <div className="pt-3 flex justify-between" style={{ borderTop: `1px solid ${neonColor}33` }}>
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg">{brl(total)}</span>
              </div>
            </div>
          </aside>
        </div>
        )}
      </main>

      {settings.checkoutFooterEnabled && (
        <footer
          className="border-t mt-8"
          style={{
            borderColor: `${neonColor}22`,
            backgroundColor: settings.checkoutHeaderBgColor || rootStyle.backgroundColor,
          }}
        >
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 text-center space-y-3">
            {payments.length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider opacity-60 mb-2">Formas de pagamento aceitas</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {payments.map((p) => (
                    <span
                      key={p}
                      className="px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase"
                      style={{ border: `1px solid ${neonColor}55`, color: neonColor }}
                    >{p}</span>
                  ))}
                </div>
              </div>
            )}
            {settings.checkoutFooterBrand && (
              <div className="text-sm font-bold">{settings.checkoutFooterBrand}</div>
            )}
            {settings.checkoutFooterCopyright && (
              <div className="text-[11px] opacity-70">{settings.checkoutFooterCopyright}</div>
            )}
            {settings.checkoutFooterEmail && (
              <div className="text-[11px] opacity-70">E-mail: {settings.checkoutFooterEmail}</div>
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
  return (
    <div
      className="p-4 flex items-center gap-3"
      style={{ ...cardStyle, opacity: state === "locked" ? 0.55 : 1, boxShadow: "none", border: `1px solid ${neonColor}22` }}
    >
      {headerBadge}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{title}</div>
        {summary && <div className="text-xs opacity-70 truncate">{summary}</div>}
      </div>
      {state === "done" && onEdit && (
        <button onClick={onEdit} className="text-xs font-medium" style={{ color: neonColor }}>Editar</button>
      )}
    </div>
  );
}
