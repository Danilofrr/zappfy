import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore, type PaymentMethod } from "@/lib/store";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, ShoppingBag, CheckCircle2, PackageX } from "lucide-react";
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
    customer: "", phone: "", address: "", district: "", city: "", payment: "pix" as PaymentMethod, notes: "",
  });
  const [done, setDone] = useState(false);

  const product = products.find((p) => p.id === productId);
  const total = (product?.price ?? 0) * qty + settings.deliveryFee;

  // Apply custom checkout theme + background as inline styles on the root container.
  const isLight = settings.checkoutTheme === "light";
  const textColor = settings.checkoutTextColor || (isLight ? "#0f172a" : "#f8fafc");
  const cardColor = settings.checkoutCardColor || (isLight ? "#ffffff" : "#111111");
  const neonColor = settings.checkoutNeonColor || "#a855f7";
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

  return (
    <div className={themeClass} style={rootStyle}>
      <header className="border-b" style={{ borderColor: `${neonColor}33` }}>
        <div className="mx-auto max-w-3xl flex items-center gap-3 px-4 sm:px-6 h-16">
          {settings.checkoutLogoUrl ? (
            <img src={settings.checkoutLogoUrl} alt={settings.storeName} className="h-10 w-10 rounded-xl object-contain" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: neonColor, boxShadow: `0 0 16px ${neonColor}` }}>
              <TrendingUp className="h-5 w-5 text-white"/>
            </div>
          )}
          <div>
            <div className="font-bold">{settings.storeName}</div>
            <div className="text-xs opacity-60">Checkout rápido</div>
          </div>
          <Link to="/" className="ml-auto text-xs opacity-60 hover:opacity-100">Voltar</Link>
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
          <div className="p-6" style={cardStyle}>

  const noProducts = products.length === 0;

  return (
    <div className={themeClass} style={rootStyle}>
      <header className="border-b border-border">
        <div className="mx-auto max-w-3xl flex items-center gap-3 px-4 sm:px-6 h-16">
          {settings.checkoutLogoUrl ? (
            <img src={settings.checkoutLogoUrl} alt={settings.storeName} className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <TrendingUp className="h-5 w-5 text-primary-foreground"/>
            </div>
          )}
          <div>
            <div className="font-bold">{settings.storeName}</div>
            <div className="text-xs text-muted-foreground">Checkout rápido</div>
          </div>
          <Link to="/" className="ml-auto text-xs text-muted-foreground hover:text-primary">Voltar</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        {noProducts ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center card-neon">
            <PackageX className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 font-bold">Nenhum produto cadastrado</h2>
            <p className="mt-1 text-sm text-muted-foreground">Cadastre seus produtos em Produtos para começar a vender.</p>
          </div>
        ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="rounded-2xl border border-border bg-card p-6 card-neon">
            <h1 className="text-2xl font-bold tracking-tight">Finalizar pedido</h1>
            <p className="text-sm text-muted-foreground mt-1">Preencha seus dados — leva menos de 1 minuto.</p>

            <div className="mt-6 grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Produto">
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id} disabled={p.stock <= 0}>
                          {p.name} {p.stock <= 0 ? "(sem estoque)" : `· ${p.stock} em estoque`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={`Quantidade ${product ? `(máx ${product.stock})` : ""}`}>
                  <Input
                    type="number"
                    min={1}
                    max={product?.stock ?? 1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, Math.min(product?.stock ?? 1, Number(e.target.value))))}
                  />
                </Field>
              </div>

              {product && (
                <div className="rounded-lg border border-border bg-background/50 px-3 py-2 text-xs flex items-center justify-between">
                  <span className="text-muted-foreground">Estoque disponível</span>
                  <span className={product.stock <= product.minStock ? "font-semibold text-warning" : "font-semibold text-primary"}>
                    {product.stock} unidade{product.stock === 1 ? "" : "s"}
                  </span>
                </div>
              )}

              <Field label="Nome completo"><Input value={form.customer} onChange={(e) => setForm({...form, customer: e.target.value})} placeholder="Seu nome"/></Field>
              <Field label="Telefone (WhatsApp)"><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} placeholder="(81) 99999-9999"/></Field>
              <Field label="Endereço"><Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} placeholder="Rua, número, complemento"/></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bairro"><Input value={form.district} onChange={(e) => setForm({...form, district: e.target.value})}/></Field>
                <Field label="Cidade"><Input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})}/></Field>
              </div>

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
            </div>
          </div>

          <aside className="rounded-2xl border border-border bg-card p-6 card-neon h-fit lg:sticky lg:top-6">
            <div className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="h-4 w-4 text-primary"/>Resumo</div>
            <div className="mt-4 space-y-2 text-sm">
              <Row label={`${product?.name ?? "—"} × ${qty}`} value={brl((product?.price ?? 0) * qty)}/>
              <Row label="Entrega" value={brl(settings.deliveryFee)}/>
              <div className="border-t border-border pt-3 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg text-neon">{brl(total)}</span>
              </div>
            </div>
            <Button onClick={submit} className="mt-5 w-full bg-gradient-primary hover:opacity-90 text-primary-foreground font-semibold shadow-glow">
              Enviar pedido pelo WhatsApp
            </Button>
            <p className="mt-3 text-[11px] text-muted-foreground text-center">Você será redirecionado para confirmar com a loja.</p>
          </aside>
        </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-muted-foreground"><span className="truncate pr-2">{label}</span><span className="text-foreground">{value}</span></div>;
}
