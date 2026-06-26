import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, DEFAULT_DELIVERY_TEMPLATE, DEFAULT_MOTOBOY_TEMPLATE, type Order, type OrderStatus } from "@/lib/store";
import { brl, fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Copy, ExternalLink, MessageCircle, Pencil, Bike, Receipt, Tag, Truck, CreditCard, Settings, Percent, Save, ShoppingBag, User as UserIcon, MapPin, StickyNote, Wallet, ChevronDown, ChevronUp, CalendarIcon, Phone, Home, Building2, ShoppingCart, Hash, DollarSign, Flag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { dateInputToLocalISO } from "@/lib/format";
import zappfyLabelLogo from "@/assets/zappfy-logo-label.png";
import motoboyLabelIcon from "@/assets/motoboy-icon.png";

import { useEffect, useMemo, useState, Fragment } from "react";
import { toast } from "sonner";
import { getSenderInfo } from "@/lib/sender-info";
import { DeliveryTrackingPanel } from "@/components/DeliveryTrackingPanel";
import { whatsappLink } from "@/lib/tracking";
import { buildPublicUrl } from "@/lib/public-url";
import { usePublicBaseUrl } from "@/hooks/use-public-base-url";

export const Route = createFileRoute("/_authenticated/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — ZappFy" }] }),
  component: PedidosPage,
});

const statusList: { value: OrderStatus; label: string; color: string }[] = [
  { value: "aguardando", label: "Aguardando Pagamento", color: "bg-warning/15 text-warning" },
  { value: "pago", label: "Pago", color: "bg-primary/15 text-primary" },
  { value: "separando", label: "Separando", color: "bg-blue-500/15 text-blue-400" },
  { value: "entrega", label: "Saiu para Entrega", color: "bg-purple-500/15 text-purple-400" },
  { value: "entregue", label: "Entregue", color: "bg-primary/20 text-primary-glow" },
  { value: "cancelado", label: "Cancelado", color: "bg-destructive/15 text-destructive" },
];

const statusMap = Object.fromEntries(statusList.map((s) => [s.value, s]));

type MotoboyContact = { label: string; phone: string };

function loadContacts(): MotoboyContact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("motoboyContacts");
    if (raw) return JSON.parse(raw);
    // migração do formato antigo (um único número)
    const old = localStorage.getItem("motoboyPhone");
    if (old) return [{ label: "Motoboy", phone: old }];
    return [];
  } catch { return []; }
}

function saveContacts(list: MotoboyContact[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem("motoboyContacts", JSON.stringify(list));
  }
}

function applyTemplate(tpl: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, v),
    tpl,
  );
}

function PedidosPage() {
  const { state, addOrder, updateOrder, updateOrderStatus, deleteOrder } = useStore();
  const publicBaseUrl = usePublicBaseUrl();
  const [editing, setEditing] = useState<Order | null>(null);
  const [motoboyFor, setMotoboyFor] = useState<Order | null>(null);

  function extractFromNotes(notes: string | undefined, label: RegExp): string {
    if (!notes) return "";
    const line = notes.split(/\r?\n/).find((l) => label.test(l));
    if (!line) return "";
    return line.replace(label, "").trim();
  }

  function buildMotoboyText(o: Order) {
    const itemsTxt = o.items.map((i) => `• ${i.qty}x ${i.name}`).join("\n");
    const produto = o.items.map((i) => `${i.qty}x ${i.name}`).join(", ");
    const referencia = extractFromNotes(o.notes, /^\s*Ponto de refer[êe]ncia:\s*/i);
    const cep = extractFromNotes(o.notes, /^\s*CEP:\s*/i);
    const enderecoCompleto = `${o.address}${o.district ? ", " + o.district : ""}${o.city ? " - " + o.city : ""}${cep ? " - CEP " + cep : ""}${referencia ? " (Ref.: " + referencia + ")" : ""}`;
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
    // Observações sem as linhas auto-injetadas (CEP / Ponto de referência), já incluídas no endereço.
    const observacoesLimpas = (o.notes || "")
      .split(/\r?\n/)
      .filter((l) => !/^\s*(CEP:|Ponto de refer[êe]ncia:)/i.test(l))
      .join("\n")
      .trim();
    const savedM = state.settings.motoboyMessageTemplate || "";
    const tpl = savedM || DEFAULT_MOTOBOY_TEMPLATE;
    return applyTemplate(tpl, {
      cliente: o.customer,
      telefone: o.phone,
      produto,
      endereco: enderecoCompleto,
      referencia,
      cep,
      mapa: mapsLink,
      itens: itemsTxt,
      pagamento: o.payment.toUpperCase(),
      total: brl(o.total),
      observacoes: observacoesLimpas,
      loja: state.settings.storeName || "",
    });
  }

  function notifyDelivery(o: Order) {
    const phone = (o.phone || "").replace(/\D/g, "");
    if (!phone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    const storeName = state.settings.storeName || "nossa loja";
    const item = o.items[0]?.name ? ` (${o.items[0].name})` : "";
    const endereco = `${o.address}${o.district ? ", " + o.district : ""}${o.city ? " - " + o.city : ""}`;
    const saved = state.settings.deliveryMessageTemplate || "";
    const tpl = saved || DEFAULT_DELIVERY_TEMPLATE;
    const text = applyTemplate(tpl, {
      cliente: o.customer,
      telefone: o.phone,
      produto: item,
      endereco,
      loja: storeName,
      total: brl(o.total),
      observacoes: o.notes || "",
    });
    window.open(whatsappLink(`55${phone}`, text), "_blank");
  }

  function printReceipt(o: Order) {
    const s = state.settings;
    const storeName = s.storeName || "Loja";
    const subtotal = o.items.reduce((a, i) => a + i.price * i.qty, 0);
    const enderecoLinha = [o.address, o.district, o.city].filter(Boolean).join(", ");
    const paymentLabels: Record<string, string> = {
      pix: "PIX", dinheiro: "Dinheiro", cartao_credito: "Cartão de Crédito",
      cartao_debito: "Cartão de Débito", boleto: "Boleto", transferencia: "Transferência",
    };
    const htmlEscape = (v: string) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
    const rows = o.items.map((i) => `
      <tr>
        <td>${htmlEscape(i.name)}</td>
        <td class="c">${i.qty}</td>
        <td class="r">${brl(i.price)}</td>
        <td class="r">${brl(i.price * i.qty)}</td>
      </tr>`).join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Recibo #${htmlEscape(o.id.slice(0, 8))}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:0;padding:24px;background:#f5f5f5}
  .sheet{max-width:720px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  h1{font-size:22px;margin:0 0 4px}
  .muted{color:#666;font-size:12px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}
  .badge{display:inline-block;padding:4px 10px;border-radius:999px;background:#111;color:#fff;font-size:12px;font-weight:600;text-transform:uppercase}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
  .box{border:1px solid #e5e5e5;border-radius:8px;padding:12px}
  .box h3{margin:0 0 6px;font-size:11px;text-transform:uppercase;color:#666;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:14px}
  th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}
  th{background:#f9f9f9;font-size:11px;text-transform:uppercase;color:#666;letter-spacing:.5px}
  .r{text-align:right}.c{text-align:center}
  tfoot td{font-weight:600;border-bottom:none}
  .total td{font-size:18px;border-top:2px solid #111;padding-top:12px}
  .notes{margin-top:16px;padding:12px;background:#fafafa;border-radius:8px;font-size:13px;white-space:pre-wrap}
  .footer{margin-top:24px;text-align:center;color:#999;font-size:11px}
  .actions{max-width:720px;margin:0 auto 16px;display:flex;gap:8px;justify-content:flex-end}
  .actions button{padding:8px 16px;border:0;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px}
  .actions .print{background:#111;color:#fff}
  .actions .close{background:#eee;color:#111}
  @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;max-width:none}.actions{display:none}}
</style></head><body>
<div class="actions">
  <button class="print" onclick="window.print()">Imprimir</button>
  <button class="close" onclick="window.close()">Fechar</button>
</div>
<div class="sheet">
  <div class="head">
    <div>
      <h1>${htmlEscape(storeName)}</h1>
      <div class="muted">Recibo de Pedido</div>
    </div>
    <div style="text-align:right">
      <div class="badge">#${htmlEscape(o.id.slice(0, 8).toUpperCase())}</div>
      <div class="muted" style="margin-top:6px">${htmlEscape(fmtDate(o.date))}</div>
    </div>
  </div>
  <div class="grid">
    <div class="box">
      <h3>Cliente</h3>
      <div><strong>${htmlEscape(o.customer)}</strong></div>
      ${o.phone ? `<div class="muted">${htmlEscape(o.phone)}</div>` : ""}
    </div>
    <div class="box">
      <h3>Entrega</h3>
      <div>${htmlEscape(enderecoLinha) || '<span class="muted">—</span>'}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Produto</th><th class="c">Qtd</th><th class="r">Preço</th><th class="r">Subtotal</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="3" class="r">Subtotal</td><td class="r">${brl(subtotal)}</td></tr>
      <tr><td colspan="3" class="r">Pagamento</td><td class="r">${htmlEscape(paymentLabels[o.payment] || o.payment)}</td></tr>
      <tr class="total"><td colspan="3" class="r">TOTAL</td><td class="r">${brl(o.total)}</td></tr>
    </tfoot>
  </table>
  ${o.notes ? `<div class="notes"><strong>Observações:</strong>\n${htmlEscape(o.notes)}</div>` : ""}
  <div class="footer">Obrigado pela preferência! • ${htmlEscape(storeName)}</div>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script>
</body></html>`;
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) { toast.error("Permita pop-ups para imprimir o recibo"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  function printLabel(o: Order) {
    const s = state.settings;
    const storeName = s.storeName || "Loja";
    const logoUrl = s.checkoutLogoUrl || "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const zappfyLogoAbs = origin + zappfyLabelLogo;
    const motoboyIconAbs = origin + motoboyLabelIcon;
    const htmlEscape = (v: string) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
    const sender = getSenderInfo();
    const senderName = sender.name || storeName;
    const senderAddress = sender.address;
    const senderDistrict = sender.district;
    const senderCity = sender.city;
    const senderCep = sender.cep;
    const senderCnpj = sender.cnpj;
    const hasSender = !!(senderAddress || senderCity || senderCep || senderCnpj);

    // deterministic fictitious numbers seeded by order id
    let seed = 0;
    for (let i = 0; i < o.id.length; i++) seed = (seed * 31 + o.id.charCodeAt(i)) >>> 0;
    const rand = (n: number) => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed % n; };
    const digits = (n: number) => Array.from({ length: n }, () => rand(10)).join("");
    const nf = digits(9);
    const pedidoNum = digits(6);
    const peso = (0.2 + rand(2000) / 1000).toFixed(3).replace(".", ",") + " kg";

    // barcode bars (random widths) — visual only, not a real code
    const bars = Array.from({ length: 70 }, () => {
      const w = 1 + rand(3);
      const black = rand(2) === 0;
      return `<span style="display:inline-block;width:${w}px;height:40px;background:${black ? "#000" : "#fff"}"></span>`;
    }).join("");

    const totalQty = o.items.reduce((a, i) => a + i.qty, 0);
    const itemsList = o.items.map((i) => `${i.qty}x ${htmlEscape(i.name)}`).join(" • ");
    const cep = extractFromNotes(o.notes, /^\s*CEP:\s*/i) || (o as any).cep || "00000-000";
    const senderDocDigits = (senderCnpj || "").replace(/\D/g, "");
    const senderDocLabel = senderDocDigits.length === 11 ? "CPF" : "CNPJ";
    const uf = (o as any).uf || "";
    const cityLine = [o.city, uf].filter(Boolean).join(" - ").toUpperCase();

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Etiqueta ${htmlEscape(pedidoNum)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;color:#000}
  body{background:#e5e5e5;padding:16px}
  .actions{max-width:520px;margin:0 auto 10px;display:flex;gap:8px;justify-content:flex-end}
  .actions button{padding:7px 14px;border:0;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px}
  .actions .print{background:#111;color:#fff}.actions .close{background:#eee;color:#111}
  .label{width:520px;margin:0 auto;background:#fff;border:2px solid #000;font-size:12px}
  .brand{display:flex;align-items:center;justify-content:center;padding:8px;border-bottom:2px solid #000;min-height:54px;background:#fff}
  .brand img{max-height:44px;max-width:280px;object-fit:contain}
  .brand .name{font-size:18px;font-weight:800;letter-spacing:1px;text-transform:uppercase}
  .partner-logos{display:flex;align-items:center;justify-content:center;gap:60px;padding:10px 18px;background:#fff;border-bottom:2px solid #000}
  .partner-logos .plogo{flex:0 0 auto;display:flex;align-items:center;justify-content:center;height:54px}
  .partner-logos .plogo img{max-height:54px;max-width:180px;object-fit:contain}
  .row{display:flex;border-bottom:2px solid #000}
  .row > div{padding:4px 8px}
  .row > div + div{border-left:2px solid #000}
  .lbl{font-size:8px;text-transform:uppercase;color:#000;letter-spacing:.6px;font-weight:700}
  .val{font-weight:700;font-size:12px;margin-top:1px}
  .grow{flex:1}
  .barcode{padding:6px;text-align:center;border-bottom:2px solid #000;background:#fff}
  .barcode .bars{display:flex;justify-content:center;align-items:end;gap:0;height:40px;overflow:hidden}
  .sec-title{background:#fff;color:#000;padding:3px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;border-top:2px solid #000;border-bottom:1px solid #000}
  .recv{padding:6px 8px;border-bottom:2px solid #000;font-size:11px}
  .recv .line{display:flex;gap:6px;margin-bottom:5px;align-items:flex-end}
  .recv .line:last-child{margin-bottom:0}
  .recv .field{flex:1;border-bottom:1px solid #000;min-height:16px;padding:0 4px}
  .recv .lbl2{font-size:9px;text-transform:uppercase;font-weight:700;white-space:nowrap}
  .dest{padding:8px;border-bottom:2px solid #000}
  .dest .name{font-size:15px;font-weight:800;text-transform:uppercase;margin-bottom:3px}
  .dest .addr{font-size:12px;line-height:1.35}
  .dest .city{font-size:16px;font-weight:800;text-transform:uppercase;margin-top:4px}
  .dest .cep{font-size:17px;font-weight:800;letter-spacing:2px;margin-top:2px;font-family:'Courier New',monospace}
  .sender{padding:6px 8px;font-size:11px;background:#f5f5f5;line-height:1.4}
  .sender strong{font-size:12px;text-transform:uppercase}
  .items{padding:5px 8px;font-size:10px;border-top:2px solid #000;background:#fafafa;line-height:1.35}
  .items .ttl{font-size:9px;text-transform:uppercase;font-weight:700;margin-bottom:2px}
  @media print{
    body{background:#fff;padding:0}
    .actions{display:none}
    .label{margin:0;border-width:1.5px}
    @page{size:auto;margin:5mm}
  }
</style></head><body>
<div class="actions">
  <button class="print" onclick="window.print()">Imprimir</button>
  <button class="close" onclick="window.close()">Fechar</button>
</div>
<div class="label">
  <div class="brand">
    ${logoUrl ? `<img src="${htmlEscape(logoUrl)}" alt="${htmlEscape(storeName)}" onerror="this.parentNode.innerHTML='<div class=\\'name\\'>${htmlEscape(storeName)}</div>'"/>` : `<div class="name">${htmlEscape(storeName)}</div>`}
  </div>
  <div class="row">
    <div class="grow"><div class="lbl">NF</div><div class="val">${htmlEscape(nf)}</div></div>
    <div class="grow"><div class="lbl">Pedido</div><div class="val">${htmlEscape(pedidoNum)}</div></div>
    <div><div class="lbl">Volume</div><div class="val">1 / 1</div></div>
    <div><div class="lbl">Peso</div><div class="val">${htmlEscape(peso)}</div></div>
  </div>
  <div class="partner-logos">
    <div class="plogo"><img src="${htmlEscape(zappfyLogoAbs)}" alt="Zappfy"/></div>
    <div class="plogo"><img src="${htmlEscape(motoboyIconAbs)}" alt="Entrega motoboy"/></div>
  </div>
  <div class="sec-title">Recebedor</div>
  <div class="recv">
    <div class="line"><span class="lbl2">Recebedor:</span><span class="field"></span></div>
    <div class="line"><span class="lbl2">Assinatura:</span><span class="field"></span><span class="lbl2">Documento:</span><span class="field"></span></div>
  </div>
  <div class="sec-title">Destinatário</div>
  <div class="dest">
    <div class="name">${htmlEscape(o.customer)}</div>
    <div class="addr">
      ${htmlEscape(o.address) || "—"}${o.district ? "<br/>Bairro: " + htmlEscape(o.district) : ""}
      ${o.phone ? `<br/>Tel: ${htmlEscape(o.phone)}` : ""}
    </div>
    <div class="city">${htmlEscape(cityLine) || "—"}</div>
    <div class="cep">CEP ${htmlEscape(cep)}</div>
  </div>
  <div class="sec-title">Remetente</div>
  <div class="sender">
    <strong>${htmlEscape(senderName)}</strong>${hasSender ? "" : `<br/><span style="font-size:10px;color:#666">Configure o endereço do remetente em Configurações → Remetente da etiqueta.</span>`}
    ${senderAddress ? `<br/>${htmlEscape(senderAddress)}${senderDistrict ? " — " + htmlEscape(senderDistrict) : ""}` : ""}
    ${senderCity || senderCep ? `<br/>${htmlEscape(senderCity)}${senderCep ? " — CEP " + htmlEscape(senderCep) : ""}` : ""}
    ${senderCnpj ? `<br/>${senderDocLabel}: ${htmlEscape(senderCnpj)}` : ""}
  </div>
  <div class="items">
    <div class="ttl">Conteúdo (${totalQty} ${totalQty === 1 ? "item" : "itens"})</div>
    ${htmlEscape(itemsList)}
  </div>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),400));</script>
</body></html>`;
    const w = window.open("", "_blank", "width=600,height=820");
    if (!w) { toast.error("Permita pop-ups para imprimir a etiqueta"); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }





  function handleStatusChange(o: Order, status: OrderStatus) {
    updateOrderStatus(o.id, status);
    if (status === "entrega" && o.status !== "entrega") {
      setTimeout(() => notifyDelivery(o), 200);
    }
  }


  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState<string | null>(null);

  type DateRangeKey = "all" | "today" | "yesterday" | "7d" | "30d" | "month" | "custom";
  const [dateRange, setDateRange] = useState<DateRangeKey>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const dateBounds = useMemo(() => {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    switch (dateRange) {
      case "today":
        return { from: startOfDay(now), to: endOfDay(now) };
      case "yesterday": {
        const y = new Date(now); y.setDate(y.getDate() - 1);
        return { from: startOfDay(y), to: endOfDay(y) };
      }
      case "7d": {
        const f = new Date(now); f.setDate(f.getDate() - 6);
        return { from: startOfDay(f), to: endOfDay(now) };
      }
      case "30d": {
        const f = new Date(now); f.setDate(f.getDate() - 29);
        return { from: startOfDay(f), to: endOfDay(now) };
      }
      case "month":
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
      case "custom":
        return {
          from: customFrom ? startOfDay(new Date(customFrom + "T00:00:00")) : null,
          to: customTo ? endOfDay(new Date(customTo + "T00:00:00")) : null,
        };
      default:
        return { from: null, to: null };
    }
  }, [dateRange, customFrom, customTo]);

  const filtered = useMemo(
    () => state.orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (dateBounds.from || dateBounds.to) {
        const d = new Date(o.date);
        if (dateBounds.from && d < dateBounds.from) return false;
        if (dateBounds.to && d > dateBounds.to) return false;
      }
      return true;
    }),
    [state.orders, filter, dateBounds],
  );

  const dateOptions: { key: DateRangeKey; label: string }[] = [
    { key: "all", label: "Todo período" },
    { key: "today", label: "Hoje" },
    { key: "yesterday", label: "Ontem" },
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
    { key: "month", label: "Mês" },
    { key: "custom", label: "Personalizado" },
  ];

  const checkoutLink = buildPublicUrl(state.settings.slug ? `/loja/${state.settings.slug}` : "/checkout", publicBaseUrl);

  return (
    <AppShell
      title="Pedidos"
      subtitle="Gerencie todos os pedidos recebidos pelo WhatsApp"
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(checkoutLink);
              toast.success("Link do checkout copiado!");
            }}
          >
            <Copy className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Copiar link</span>
          </Button>
          <NewOrderDialog open={open} setOpen={setOpen} onCreate={(o) => { addOrder(o); toast.success("Pedido criado!"); setOpen(false); }} />
        </div>
      }
    >
      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {dateOptions.map((d) => (
          <Chip key={d.key} active={dateRange === d.key} onClick={() => setDateRange(d.key)}>{d.label}</Chip>
        ))}
        {dateRange === "custom" && (
          <div className="flex items-center gap-2 ml-1">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-[150px]" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 w-[150px]" />
          </div>
        )}
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>Todos</Chip>
        {statusList.map((s) => (
          <Chip key={s.value} active={filter === s.value} onClick={() => setFilter(s.value)}>{s.label}</Chip>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-elegant">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Produto</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Bairro</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Data</th>
                <th className="text-right px-4 py-3 font-medium">Valor</th>
                <th className="text-right px-4 py-3 font-medium">Lucro</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Nenhum pedido encontrado.</td></tr>
              )}
              {filtered.map((o) => (
                <Fragment key={o.id}>
                <tr className="border-t border-border hover:bg-secondary/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{o.customer}</div>
                    <div className="text-xs text-muted-foreground">{o.phone}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="truncate max-w-[260px]">
                      {o.items.map((it) => `${it.qty}x ${it.name}`).join(", ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.items.reduce((n, it) => n + it.qty, 0)} item(s) · {o.payment.toUpperCase()}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">{o.district}</td>
                  <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{fmtDate(o.date)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{brl(o.total)}</td>
                  {(() => {
                    const cost = o.items.reduce((s, it) => s + (it.cost ?? 0) * it.qty, 0);
                    const profit = o.total - cost;
                    const margin = o.total > 0 ? (profit / o.total) * 100 : 0;
                    const cls = profit >= 0 ? "text-emerald-500" : "text-destructive";
                    return (
                      <td className="px-4 py-3 text-right">
                        <div className={`font-semibold ${cls}`}>{brl(profit)}</div>
                        <div className="text-[11px] text-muted-foreground">{margin.toFixed(1)}%</div>
                      </td>
                    );
                  })()}
                  <td className="px-4 py-3">
                    <Select value={o.status} onValueChange={(v) => handleStatusChange(o, v as OrderStatus)}>
                      <SelectTrigger className={`h-8 w-[170px] border-0 ${statusMap[o.status].color}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusList.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(o)}
                        title="Editar pedido"
                        className="text-muted-foreground hover:text-primary p-1"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => printReceipt(o)}
                        title="Gerar recibo e imprimir"
                        className="text-muted-foreground hover:text-primary p-1"
                      >
                        <Receipt className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => printLabel(o)}
                        title="Gerar etiqueta de envio"
                        className="text-muted-foreground hover:text-primary p-1"
                      >
                        <Tag className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setMotoboyFor(o)}
                        title="Enviar endereço para o motoboy no WhatsApp"
                        className="text-muted-foreground hover:text-blue-500 p-1"
                      >
                        <Bike className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => notifyDelivery(o)}
                        title="Avisar cliente no WhatsApp que o pedido saiu para entrega"
                        className="text-muted-foreground hover:text-green-500 p-1"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setTrackingOpen(trackingOpen === o.id ? null : o.id)}
                        title="Rastreamento da entrega em tempo real"
                        className={`p-1 ${trackingOpen === o.id ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                      >
                        <MapPin className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { if (confirm("Excluir este pedido? O estoque será devolvido.")) deleteOrder(o.id); }}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>

                </tr>
                {trackingOpen === o.id && (
                  <tr className="border-t border-border bg-secondary/10">
                    <td colSpan={8} className="px-4 py-4">
                      <DeliveryTrackingPanel
                        orderId={o.id}
                        customerPhone={o.phone}
                        orderAddress={[o.address, o.district, o.city].filter(Boolean).join(", ")}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <a
        href={checkoutLink}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Abrir página de checkout pública
      </a>

      <EditOrderDialog
        order={editing}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (!editing) return;
          await updateOrder(editing.id, patch);
          toast.success(patch.date ? "Data do pedido atualizada com sucesso." : "Pedido atualizado!");
          setEditing(null);
        }}
      />

      <MotoboyDialog
        order={motoboyFor}
        onClose={() => setMotoboyFor(null)}
        buildText={buildMotoboyText}
      />
    </AppShell>
  );
}

function EditOrderDialog({
  order, onClose, onSave,
}: {
  order: Order | null;
  onClose: () => void;
  onSave: (patch: Partial<Omit<Order, "id">>) => void;
}) {
  const [form, setForm] = useState({
    customer: "", phone: "", address: "", district: "", city: "",
    payment: "pix" as any, status: "aguardando" as OrderStatus, notes: "",
  });
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalEdited, setTotalEdited] = useState(false);
  const [orderDate, setOrderDate] = useState<Date | undefined>(undefined);

  useMemo(() => {
    if (order) {
      setForm({
        customer: order.customer, phone: order.phone, address: order.address,
        district: order.district, city: order.city,
        payment: order.payment as any, status: order.status, notes: order.notes ?? "",
      });
      setItems(order.items.map((it) => ({ ...it })));
      setTotal(order.total);
      setTotalEdited(false);
      setOrderDate(order.date ? new Date(order.date) : new Date());
    }
  }, [order]);

  // Soma sugerida (itens + frete embutido no primeiro item, se houver)
  const itemsSubtotal = items.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  const shipping = Number((items[0] as any)?.shipping ?? 0) || 0;
  const suggested = Math.round((itemsSubtotal + shipping) * 100) / 100;

  // Auto-atualiza total se usuário não editou manualmente
  useEffect(() => {
    if (!totalEdited) setTotal(suggested);
  }, [suggested, totalEdited]);

  const updateItem = (idx: number, patch: any) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };
  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const { state } = useStore();
  const [addProductId, setAddProductId] = useState<string>("");
  const addProductToOrder = () => {
    const p = state.products.find((x) => x.id === addProductId);
    if (!p) { toast.error("Selecione um produto"); return; }
    setItems((prev) => [...prev, {
      productId: p.id, name: p.name, qty: 1, price: Number(p.price) || 0, cost: Number(p.cost) || 0,
    }]);
    setAddProductId("");
  };

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar pedido</DialogTitle>
          <DialogDescription>Altere dados do cliente, itens, valores e pagamento.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente" icon={UserIcon} iconTone="primary"><Input value={form.customer} onChange={(e) => setForm({...form, customer: e.target.value})} /></Field>
            <Field label="Telefone" icon={Phone}><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></Field>
          </div>
          <Field label="Endereço" icon={MapPin} iconTone="primary"><Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bairro" icon={Home}><Input value={form.district} onChange={(e) => setForm({...form, district: e.target.value})} /></Field>
            <Field label="Cidade" icon={Building2}><Input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} /></Field>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Itens do pedido</span>
            </div>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Field label={idx === 0 ? "Produto" : ""} icon={idx === 0 ? ShoppingCart : undefined}>
                    <Input value={it.name ?? ""} onChange={(e) => updateItem(idx, { name: e.target.value })} />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label={idx === 0 ? "Qtd" : ""} icon={idx === 0 ? Hash : undefined}>
                    <Input type="number" min={1} value={it.qty}
                      onChange={(e) => updateItem(idx, { qty: Math.max(1, Number(e.target.value) || 1) })} />
                  </Field>
                </div>
                <div className="col-span-4">
                  <Field label={idx === 0 ? "Valor unit. (R$)" : ""} icon={idx === 0 ? DollarSign : undefined}>
                    <Input type="number" step="0.01" min={0} value={it.price}
                      onChange={(e) => updateItem(idx, { price: Math.max(0, Number(e.target.value) || 0) })} />
                  </Field>
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon"
                    onClick={() => removeItem(idx)}
                    disabled={items.length <= 1}
                    title="Remover item">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex gap-2 items-end pt-2 border-t border-border">
              <div className="flex-1">
                <Field label="Adicionar produto">
                  <Select value={addProductId} onValueChange={setAddProductId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um produto..." /></SelectTrigger>
                    <SelectContent>
                      {state.products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — R$ {Number(p.price).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Button type="button" onClick={addProductToOrder} disabled={!addProductId}>
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>

            {shipping > 0 && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Entrega: R$ {shipping.toFixed(2)}</div>
            )}
          </div>

          <Field label="Data do pedido" icon={CalendarIcon} iconTone="primary">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !orderDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {orderDate ? orderDate.toLocaleDateString("pt-BR") : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={orderDate}
                  onSelect={(d) => d && setOrderDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Pagamento" icon={CreditCard} iconTone="primary">
              <Select value={form.payment} onValueChange={(v: any) => setForm({...form, payment: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status" icon={Flag}>
              <Select value={form.status} onValueChange={(v: any) => setForm({...form, status: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {statusList.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Total (R$)${totalEdited ? " — manual" : ""}`}>
              <Input type="number" step="0.01" min={0} value={total}
                onChange={(e) => { setTotalEdited(true); setTotal(Math.max(0, Number(e.target.value) || 0)); }} />
            </Field>
            <div className="flex items-end">
              <Button type="button" variant="outline" size="sm"
                onClick={() => { setTotalEdited(false); setTotal(suggested); }}>
                Recalcular ({suggested.toFixed(2)})
              </Button>
            </div>
          </div>

          <Field label="Observações"><Textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => {
            const patch: any = { ...form, items, total };
            if (orderDate) {
              const y = orderDate.getFullYear();
              const m = String(orderDate.getMonth() + 1).padStart(2, "0");
              const d = String(orderDate.getDate()).padStart(2, "0");
              patch.date = dateInputToLocalISO(`${y}-${m}-${d}`);
            }
            onSave(patch);
          }}>Salvar alterações</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

const PRODUCT_COLORS = [
  "bg-rose-500/15 text-rose-400 border-rose-500/30",
  "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "bg-sky-500/15 text-sky-400 border-sky-500/30",
  "bg-violet-500/15 text-violet-400 border-violet-500/30",
  "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  "bg-lime-500/15 text-lime-400 border-lime-500/30",
  "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
];
function colorForProduct(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PRODUCT_COLORS[h % PRODUCT_COLORS.length];
}

type CartLine = { productId: string; qty: number };

const MACHINE_BRANDS = ["VISA", "MASTERCARD", "ELO", "DÉBITO", "PIX", "DINHEIRO", "LINK"] as const;
type MachineFees = Record<string, Record<number, number>>; // brand -> parcela -> %

function loadMachineFees(): MachineFees {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("machineFees") || "{}"); } catch { return {}; }
}
function saveMachineFees(f: MachineFees) {
  if (typeof window !== "undefined") localStorage.setItem("machineFees", JSON.stringify(f));
}

function SectionLabel({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
      <Icon className="h-3.5 w-3.5" />
      <span>{children}</span>
    </div>
  );
}

function NewOrderDialog({ open, setOpen, onCreate }: { open: boolean; setOpen: (v: boolean) => void; onCreate: (o: Omit<Order, "id">) => void }) {
  const { state } = useStore();
  const [form, setForm] = useState({
    customer: "", phone: "", address: "", district: "", city: "",
    payment: "pix" as const, status: "aguardando" as OrderStatus, notes: "",
  });
  const [orderDate, setOrderDate] = useState<string>(() => {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  });
  const [lines, setLines] = useState<CartLine[]>([]);
  const [picker, setPicker] = useState<string>("");

  // Novos campos
  const [shippingOptionId, setShippingOptionId] = useState<string>("none");
  const [shippingValue, setShippingValue] = useState<number>(0);
  const [feeLabel, setFeeLabel] = useState<string>("");
  const [feeValue, setFeeValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"valor" | "percent">("percent");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [couponCode, setCouponCode] = useState<string>("");
  const [couponApplied, setCouponApplied] = useState<string>("");

  // Segundo pagamento
  const [secondPayment, setSecondPayment] = useState<string>("none");
  const [secondPaymentValue, setSecondPaymentValue] = useState<number>(0);

  // Modal de taxas de maquininha
  const [feesOpen, setFeesOpen] = useState(false);

  const selectedIds = new Set(lines.map((l) => l.productId));
  const available = state.products.filter((p) => !selectedIds.has(p.id));
  const subtotal = lines.reduce((sum, l) => {
    const prod = state.products.find((p) => p.id === l.productId);
    return sum + (prod?.price ?? 0) * l.qty;
  }, 0);
  const discountAmount =
    discountType === "percent"
      ? Math.min(subtotal, (subtotal * Math.max(0, discountValue)) / 100)
      : Math.min(subtotal, Math.max(0, discountValue));
  const total = Math.max(0, subtotal + Number(shippingValue || 0) + Number(feeValue || 0) - discountAmount);

  function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) { toast.error("Digite um código de cupom"); return; }
    setCouponApplied(code);
    toast.success(`Cupom ${code} aplicado`);
  }

  function pickShipping(id: string) {
    setShippingOptionId(id);
    if (id === "none") { setShippingValue(0); return; }
    if (id === "custom") return;
    const opt = state.settings.shippingOptions?.find((s) => s.id === id);
    if (opt) setShippingValue(opt.price);
  }

  function addLine(productId: string) {
    if (!productId || selectedIds.has(productId)) return;
    setLines((prev) => [...prev, { productId, qty: 1 }]);
    setPicker("");
  }
  function updateQty(productId: string, qty: number) {
    setLines((prev) => prev.map((l) => l.productId === productId ? { ...l, qty: Math.max(1, qty) } : l));
  }
  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  function reset() {
    setForm({ customer: "", phone: "", address: "", district: "", city: "", payment: "pix", status: "aguardando", notes: "" });
    setLines([]);
    setPicker("");
    setShippingOptionId("none"); setShippingValue(0);
    setFeeLabel(""); setFeeValue(0);
    setDiscountType("percent"); setDiscountValue(0); setCouponCode(""); setCouponApplied("");
    setSecondPayment("none"); setSecondPaymentValue(0);
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setOrderDate(d.toISOString().slice(0, 10));
  }

  const paymentOptions = [
    { value: "pix", label: "PIX" },
    { value: "cartao", label: "Cartão (Crédito/Débito)" },
    { value: "dinheiro", label: "Dinheiro" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" />Novo Pedido</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo pedido</DialogTitle>
          <DialogDescription>Registre manualmente um pedido, com entrega, taxas, descontos, cupons e pagamento dividido.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {/* Cliente */}
          <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
            <SectionLabel icon={UserIcon}>Cliente</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome" icon={UserIcon} iconTone="primary"><Input value={form.customer} onChange={(e) => setForm({...form, customer: e.target.value})} /></Field>
              <Field label="Telefone" icon={Phone}><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></Field>
            </div>
          </div>

          {/* Endereço */}
          <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
            <SectionLabel icon={MapPin}>Endereço</SectionLabel>
            <Field label="Rua / nº" icon={MapPin} iconTone="primary"><Input value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bairro" icon={Home}><Input value={form.district} onChange={(e) => setForm({...form, district: e.target.value})} /></Field>
              <Field label="Cidade" icon={Building2}><Input value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} /></Field>
            </div>
          </div>

          {/* Produtos do pedido */}
          <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
            <SectionLabel icon={ShoppingBag}>Produtos do pedido</SectionLabel>
            <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
              {lines.length === 0 && (
                <div className="text-xs text-muted-foreground py-2 text-center">Nenhum produto adicionado ainda.</div>
              )}
              {lines.map((l) => {
                const prod = state.products.find((p) => p.id === l.productId);
                if (!prod) return null;
                const color = colorForProduct(prod.id);
                const sub = prod.price * l.qty;
                return (
                  <div key={l.productId} className={`flex items-center gap-2 rounded-lg border p-2 ${color}`}>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate text-foreground">{prod.name}</div>
                      <div className="text-xs text-muted-foreground">{brl(prod.price)} · subtotal {brl(sub)}</div>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) => updateQty(l.productId, Number(e.target.value))}
                      className="h-8 w-16 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(l.productId)}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}

              {available.length > 0 ? (
                <div className="flex gap-2 pt-1">
                  <Select value={picker} onValueChange={addLine}>
                    <SelectTrigger className="h-9 flex-1">
                      <SelectValue placeholder="+ Adicionar produto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((p) => {
                        const color = colorForProduct(p.id);
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block h-2.5 w-2.5 rounded-full ${color.split(" ")[0]}`} />
                              <span>{p.name}</span>
                              <span className="text-xs text-muted-foreground ml-1">{brl(p.price)}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ) : state.products.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center pt-1">Cadastre produtos primeiro.</div>
              ) : (
                <div className="text-xs text-muted-foreground text-center pt-1">Todos os produtos já foram adicionados.</div>
              )}
            </div>
          </div>

          {/* Entrega */}
          <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
            <SectionLabel icon={Truck}>Entrega</SectionLabel>
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <Select value={shippingOptionId} onValueChange={pickShipping}>
                <SelectTrigger><SelectValue placeholder="Forma de entrega" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem entrega / retirada</SelectItem>
                  {(state.settings.shippingOptions ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.label} — {brl(s.price)}</SelectItem>
                  ))}
                  <SelectItem value="custom">Valor personalizado</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number" min={0} step="0.01"
                value={shippingValue}
                onChange={(e) => { setShippingValue(Number(e.target.value)); if (shippingOptionId === "none") setShippingOptionId("custom"); }}
                placeholder="R$ 0,00"
              />
            </div>
          </div>

          {/* Taxa adicional */}
          <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
            <SectionLabel icon={Receipt}>Taxa adicional (opcional)</SectionLabel>
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <Input placeholder="Descrição (ex: Taxa de serviço)" value={feeLabel} onChange={(e) => setFeeLabel(e.target.value)} />
              <Input type="number" min={0} step="0.01" value={feeValue} onChange={(e) => setFeeValue(Number(e.target.value))} placeholder="R$ 0,00" />
            </div>
          </div>

          {/* Desconto / Cupom */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
            <SectionLabel icon={Tag}>Desconto (opcional)</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              <Field label="TIPO">
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">% Percentual</SelectItem>
                    <SelectItem value="valor">R$ Valor</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={discountType === "percent" ? "DESCONTO (%)" : "DESCONTO (R$)"}>
                <Input
                  type="number" min={0} step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Number(e.target.value))}
                  placeholder={discountType === "percent" ? "Ex: 10" : "Ex: 5,00"}
                />
              </Field>
              <Field label="OU CUPOM">
                <div className="flex gap-1">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="CODIGO"
                  />
                  <Button type="button" size="sm" onClick={applyCoupon} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">OK</Button>
                </div>
              </Field>
            </div>
            {discountAmount > 0 && (
              <div className="text-xs text-emerald-500 flex items-center gap-1">
                <Percent className="h-3 w-3" />
                Desconto aplicado: −{brl(discountAmount)} {couponApplied && `(cupom ${couponApplied})`}
              </div>
            )}
          </div>

          {/* Pagamento */}
          <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
            <SectionLabel icon={CreditCard}>Pagamento</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Forma">
                <Select value={form.payment} onValueChange={(v: any) => setForm({...form, payment: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {paymentOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status" icon={Flag}>
                <Select value={form.status} onValueChange={(v: any) => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {statusList.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Data do pedido" icon={CalendarIcon} iconTone="primary">
              <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
            </Field>

            {/* Segundo pagamento (opcional) */}
            <div className="pt-1 border-t border-border/60 mt-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-2">
                <Wallet className="h-3.5 w-3.5" />
                <span>+ Segundo pagamento (opcional)</span>
              </div>
              <div className="grid grid-cols-[1fr_160px] gap-2">
                <Field label="FORMA">
                  <Select value={secondPayment} onValueChange={setSecondPayment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      {paymentOptions.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="VALOR (R$)">
                  <Input
                    type="number" min={0} step="0.01"
                    value={secondPaymentValue}
                    onChange={(e) => setSecondPaymentValue(Number(e.target.value))}
                    placeholder="0,00"
                    disabled={secondPayment === "none"}
                  />
                </Field>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setFeesOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mt-2"
            >
              <Settings className="h-3.5 w-3.5" /> Configurar taxas de maquininha
            </button>
          </div>

          {/* Observações */}
          <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
            <SectionLabel icon={StickyNote}>Observações</SectionLabel>
            <Textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} placeholder="Notas internas sobre o pedido..." />
          </div>

          {/* Resumo */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
            {shippingValue > 0 && <div className="flex justify-between text-muted-foreground"><span>Entrega</span><span>{brl(shippingValue)}</span></div>}
            {feeValue > 0 && <div className="flex justify-between text-muted-foreground"><span>{feeLabel || "Taxa"}</span><span>{brl(feeValue)}</span></div>}
            {discountAmount > 0 && <div className="flex justify-between text-emerald-500"><span>Desconto{couponApplied ? ` (${couponApplied})` : ""}</span><span>−{brl(discountAmount)}</span></div>}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-border mt-1"><span>Total</span><span className="text-primary">{brl(total)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            onClick={() => {
              if (!form.customer) { toast.error("Preencha o nome do cliente"); return; }
              if (lines.length === 0) { toast.error("Adicione ao menos um produto"); return; }
              const items = lines.map((l) => {
                const prod = state.products.find((p) => p.id === l.productId)!;
                return { productId: prod.id, name: prod.name, qty: l.qty, price: prod.price, cost: prod.cost };
              });
              const extraNotesLines: string[] = [];
              if (shippingValue > 0) extraNotesLines.push(`Entrega: ${brl(shippingValue)}`);
              if (feeValue > 0) extraNotesLines.push(`${feeLabel || "Taxa"}: ${brl(feeValue)}`);
              if (discountAmount > 0) extraNotesLines.push(`Desconto${couponApplied ? ` (cupom ${couponApplied})` : ""}: -${brl(discountAmount)}`);
              if (secondPayment !== "none" && secondPaymentValue > 0) {
                const label = paymentOptions.find((p) => p.value === secondPayment)?.label || secondPayment;
                extraNotesLines.push(`Segundo pagamento: ${label} — ${brl(secondPaymentValue)}`);
              }
              const finalNotes = [form.notes, extraNotesLines.join("\n")].filter(Boolean).join("\n\n");
              onCreate({
                customer: form.customer, phone: form.phone, address: form.address,
                district: form.district, city: form.city,
                items,
                total, payment: form.payment, status: form.status, notes: finalNotes,
                date: (() => {
                  const now = new Date();
                  const [y, m, d] = orderDate.split("-").map(Number);
                  const dt = new Date(y, (m || 1) - 1, d || 1, now.getHours(), now.getMinutes(), now.getSeconds());
                  return dt.toISOString();
                })(),
              });
              reset();
            }}>
            <Save className="mr-2 h-4 w-4" /> Salvar Venda
          </Button>
        </DialogFooter>

        <MachineFeesDialog open={feesOpen} onClose={() => setFeesOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function MachineFeesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [fees, setFees] = useState<MachineFees>({});
  useMemo(() => { if (open) setFees(loadMachineFees()); }, [open]);

  function setFee(brand: string, parcela: number, value: number) {
    setFees((prev) => ({
      ...prev,
      [brand]: { ...(prev[brand] || {}), [parcela]: value },
    }));
  }

  // Brands sem parcelamento
  const noInstallment = (brand: string) => brand === "DÉBITO" || brand === "PIX";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Taxas de maquininha</DialogTitle>
          <DialogDescription>Configure a taxa (%) por bandeira e por parcela. Salvo neste navegador.</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-2 py-2 font-medium">Parcelas</th>
                {MACHINE_BRANDS.map((b) => (
                  <th key={b} className="text-left px-2 py-2 font-medium">{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((parcela) => (
                <tr key={parcela} className="border-t border-border">
                  <td className="px-2 py-2 text-muted-foreground font-medium">{parcela}x</td>
                  {MACHINE_BRANDS.map((b) => {
                    if (parcela > 1 && noInstallment(b)) {
                      return <td key={b} className="px-2 py-2 text-muted-foreground text-center">—</td>;
                    }
                    const val = fees[b]?.[parcela] ?? 0;
                    return (
                      <td key={b} className="px-2 py-2">
                        <div className="relative">
                          <Input
                            type="number" min={0} step="0.01"
                            value={val}
                            onChange={(e) => setFee(b, parcela, Number(e.target.value))}
                            className="h-8 pr-7 text-sm"
                            placeholder="0"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            onClick={() => { saveMachineFees(fees); toast.success("Taxas salvas!"); onClose(); }}
          >
            <Save className="mr-2 h-4 w-4" /> Salvar Taxas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




function Field({ label, icon: Icon, iconTone = "muted", children }: { label: string; icon?: any; iconTone?: "primary" | "muted"; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5">
        {Icon ? <Icon className={cn("h-3.5 w-3.5", iconTone === "primary" ? "text-primary" : "text-muted-foreground")} /> : null}
        <span>{label}</span>
      </Label>
      {children}
    </div>
  );
}

function MotoboyDialog({
  order, onClose, buildText,
}: {
  order: Order | null;
  onClose: () => void;
  buildText: (o: Order) => string;
}) {
  const [contacts, setContacts] = useState<MotoboyContact[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [text, setText] = useState("");

  useMemo(() => {
    if (order) {
      setContacts(loadContacts());
      setText(buildText(order));
    }
  }, [order]);

  function addContact() {
    const phone = newPhone.replace(/\D/g, "");
    if (!newLabel.trim()) { toast.error("Dê um nome ao contato"); return; }
    if (phone.length < 10) { toast.error("Número inválido"); return; }
    const list = [...contacts, { label: newLabel.trim(), phone }];
    setContacts(list); saveContacts(list);
    setNewLabel(""); setNewPhone("");
  }

  function removeContact(i: number) {
    const list = contacts.filter((_, idx) => idx !== i);
    setContacts(list); saveContacts(list);
  }

  function send(phone: string) {
    window.open(whatsappLink(`55${phone}`, text), "_blank");
    onClose();
  }

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar para o motoboy</DialogTitle>
          <DialogDescription>Escolha um contato salvo ou cadastre um novo (grupo ou número).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Mensagem (você pode ajustar antes de enviar)">
            <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>

          <div>
            <Label className="text-xs">Enviar para</Label>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {contacts.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum contato salvo ainda.</p>
              )}
              {contacts.map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.label}</div>
                    <div className="text-xs text-muted-foreground">{c.phone}</div>
                  </div>
                  <Button size="sm" onClick={() => send(c.phone)}>Enviar</Button>
                  <button onClick={() => removeContact(i)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border p-3">
            <Label className="text-xs">Adicionar novo contato</Label>
            <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input placeholder="Nome (ex: Motoboy João, Grupo Entregas)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
              <Input placeholder="DDD + número" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} inputMode="numeric" />
              <Button variant="outline" onClick={addContact}><Plus className="h-4 w-4" /></Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Para enviar a um grupo do WhatsApp, use o número de um administrador ou crie um contato com o link do grupo (o WhatsApp só aceita envio direto a números — para grupos, abra o grupo e cole a mensagem manualmente).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
