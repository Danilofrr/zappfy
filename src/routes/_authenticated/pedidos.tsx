import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import {
  useStore,
  DEFAULT_DELIVERY_TEMPLATE,
  DEFAULT_MOTOBOY_TEMPLATE,
  type Order,
  type OrderStatus,
} from "@/lib/store";
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
import {
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  MessageCircle,
  Pencil,
  Bike,
  Receipt,
  Tag,
  Truck,
  CreditCard,
  Settings,
  Percent,
  Save,
  ShoppingBag,
  User as UserIcon,
  MapPin,
  StickyNote,
  Wallet,
  ChevronDown,
  ChevronUp,
  CalendarIcon,
  Phone,
  Home,
  Building2,
  ShoppingCart,
  Hash,
  DollarSign,
  Flag,
  Search,
  X,
  Paperclip,
  Users,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { dateInputToLocalISO } from "@/lib/format";
import zappfyLabelLogo from "@/assets/zappfy-logo-label.png";
import motoboyLabelIcon from "@/assets/motoboy-icon.png";

import { useEffect, useMemo, useState, Fragment } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { toast } from "sonner";
import { getSenderInfo } from "@/lib/sender-info";
import { DeliveryTrackingPanel } from "@/components/DeliveryTrackingPanel";
import { QuantitySelector } from "@/components/QuantitySelector";
import { FormErrorBoundary } from "@/components/FormErrorBoundary";
import { OrderReceiptsModal } from "@/components/OrderReceiptsModal";
import { whatsappLink } from "@/lib/tracking";
import { buildPublicUrl } from "@/lib/public-url";
import { usePublicBaseUrl } from "@/hooks/use-public-base-url";
import { useActiveStore } from "@/lib/active-store";
import { openShippingLabels } from "@/lib/shipping-labels";
import { supabase } from "@/integrations/supabase/client";
import type { DeliveryAssignment } from "@/lib/delivery-load";
import { Checkbox } from "@/components/ui/checkbox";
import {
  attachFeeMetaToItems,
  buildOrderFeeMeta,
  getOrderFeeMeta,
  getOrderNetReceived,
  getOrderProfit,
  isCardPayment as isCardPaymentMethod,
} from "@/lib/order-financials";
import {
  attachPaymentBreakdownToItems,
  buildPaymentBreakdown,
  formatPaymentBreakdown,
  normalizePaymentBreakdown,
  paymentMethodLabel,
} from "@/lib/order-payments";

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

const customerCpfNoteLabel =
  /^\s*\*?\s*(?:CPF|CPF\/CNPJ)(?:\s+do\s+(?:cliente|comprador))?\s*\*?\s*:\s*\*?\s*/i;
const customerEmailNoteLabel =
  /^\s*\*?\s*E-?mail(?:\s+do\s+(?:cliente|comprador))?\s*\*?\s*:\s*\*?\s*/i;
const customerPrivateNoteLabel =
  /^\s*\*?\s*(?:(?:CPF|CPF\/CNPJ)|E-?mail)(?:\s+do\s+(?:cliente|comprador))?\s*\*?\s*:/i;

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
  } catch {
    return [];
  }
}

function saveContacts(list: MotoboyContact[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem("motoboyContacts", JSON.stringify(list));
  }
}

function applyTemplate(tpl: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), tpl);
}

function deliveryDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function deliveryDatePlusDays(days: number) {
  return deliveryDateKey(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

function formatScheduledDeliveryDate(value: string | null | undefined) {
  if (!value) return "";
  const today = deliveryDateKey();
  const tomorrow = deliveryDatePlusDays(1);
  if (value === today) return "Hoje";
  if (value === tomorrow) return "Amanhã";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function PedidosPage() {
  const { state, addOrder, updateOrder, updateOrderStatus, deleteOrder } = useStore();
  const { activeStoreId } = useActiveStore();
  const publicBaseUrl = usePublicBaseUrl();
  const [editing, setEditing] = useState<Order | null>(null);
  const [motoboyFor, setMotoboyFor] = useState<Order | null>(null);
  const [assignments, setAssignments] = useState<DeliveryAssignment[]>([]);
  const [couriers, setCouriers] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [targetCourier, setTargetCourier] = useState("");
  const [assignmentDate, setAssignmentDate] = useState(() => deliveryDateKey());
  const [courierFilter, setCourierFilter] = useState("all");

  async function loadDeliveryAssignments() {
    if (!activeStoreId) return;
    const [{ data: a }, { data: c }] = await Promise.all([
      (supabase as any).rpc("list_order_assignments", { _store_id: activeStoreId }),
      (supabase as any).rpc("list_couriers_for_store", { _store_id: activeStoreId }),
    ]);
    setAssignments(Array.isArray(a) ? a : []);
    setCouriers((Array.isArray(c) ? c : []).filter((x: any) => x.active));
  }

  useEffect(() => {
    loadDeliveryAssignments();
    if (!activeStoreId) return;
    const channel = supabase
      .channel(`pedidos_carga_${activeStoreId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_tracking",
          filter: `store_id=eq.${activeStoreId}`,
        },
        loadDeliveryAssignments,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStoreId]);

  const assignmentByOrder = useMemo(
    () => new Map(assignments.map((a) => [a.order_id, a])),
    [assignments],
  );

  async function assignSelected() {
    if (!activeStoreId || !targetCourier || selected.size === 0) return;
    if (!assignmentDate || assignmentDate < deliveryDateKey()) {
      toast.error("Escolha hoje ou uma data futura para a entrega");
      return;
    }
    const target = couriers.find((c) => c.id === targetCourier);
    const transfers = [...selected]
      .map((id) => assignmentByOrder.get(id))
      .filter((a) => a?.courier_id && a.courier_id !== targetCourier);
    if (
      transfers.length &&
      !confirm(
        `${transfers.length === 1 ? `Este pedido já está atribuído a ${transfers[0]?.courier_name}.` : `${transfers.length} pedidos já estão atribuídos.`}\nDeseja transferir para ${target?.name}?`,
      )
    )
      return;
    const { error } = await (supabase as any).rpc("assign_orders_to_courier_scheduled", {
      _store_id: activeStoreId,
      _order_ids: [...selected],
      _courier_id: targetCourier,
      _scheduled_for: assignmentDate,
    });
    if (error) return toast.error(error.message);
    toast.success(
      `${selected.size} pedido(s) atribuído(s) a ${target?.name} para ${formatScheduledDeliveryDate(assignmentDate)}`,
    );
    setSelected(new Set());
    setAssignOpen(false);
    setTargetCourier("");
    loadDeliveryAssignments();
  }

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
      pagamento: formatPaymentBreakdown(o),
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
    window.open(whatsappLink(phone, text), "_blank");
  }

  function openCustomerWhatsApp(o: Order) {
    const phone = (o.phone || "").replace(/\D/g, "");
    if (!phone) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    window.open(whatsappLink(phone), "_blank");
  }

  function printReceipt(o: Order) {
    const s = state.settings;
    const storeName = s.storeName || "Loja";
    const logoUrl = s.checkoutLogoUrl || "";
    const firstItemWithCustomerData = o.items.find(
      (item) => (item as any).cpf || (item as any).email,
    ) as any;
    const cpfCliente =
      extractFromNotes(o.notes, customerCpfNoteLabel) ||
      String(firstItemWithCustomerData?.cpf ?? "").trim();
    const emailCliente =
      extractFromNotes(o.notes, customerEmailNoteLabel) ||
      String(firstItemWithCustomerData?.email ?? "").trim();
    const notesLimpas = (o.notes || "")
      .split(/\r?\n/)
      .filter(
        (l) => !customerPrivateNoteLabel.test(l) && !/^\s*(CEP:|Ponto de refer[êe]ncia:)/i.test(l),
      )
      .join("\n")
      .trim();
    const subtotal = o.items.reduce((a, i) => a + i.price * i.qty, 0);
    const enderecoLinha = [o.address, o.district, o.city].filter(Boolean).join(", ");
    const paymentLabels: Record<string, string> = {
      pix: "PIX",
      dinheiro: "Dinheiro",
      cartao_credito: "Cartão de Crédito",
      cartao_debito: "Cartão de Débito",
      debito: "Cartão de Débito",
      cartao: "Cartão",
      boleto: "Boleto",
      transferencia: "Transferência",
    };
    // Extrai parcelamento e taxa do cartão das observações (quando existirem)
    const notesRaw = o.notes || "";
    const parcelaMatch = notesRaw.match(
      /(?:Cart[ãa]o|Parcelamento)\s*:?\s*\*?\s*([^\n\-—]+?)\s*[—-]?\s*(\d+)\s*x\s*de\s*R\$?\s*([\d.,]+)/i,
    );
    const taxaMatch = notesRaw.match(
      /Taxa(?:\s*cart[ãa]o)?\s*\(?\s*([\d.,]+)\s*%\)?[:\s]*\(?R\$?\s*([\d.,]+)/i,
    );
    // Valor monetário BR: "1.234,56" -> 1234.56. Exige vírgula decimal.
    const parseBRL = (s: string) => Number(String(s).replace(/\./g, "").replace(",", "."));
    // Percentual: aceita "8.94" (ponto decimal) ou "8,94" (vírgula decimal).
    const parsePct = (s: string) => {
      const str = String(s).trim();
      if (str.includes(",")) return Number(str.replace(/\./g, "").replace(",", "."));
      return Number(str);
    };
    const cardBrand = parcelaMatch ? parcelaMatch[1].replace(/\*/g, "").trim() : "";
    const cardParcelas = parcelaMatch ? Number(parcelaMatch[2]) : 0;
    const cardParcelaValor = parcelaMatch ? parseBRL(parcelaMatch[3]) : 0;
    const cardTaxaPct = taxaMatch ? parsePct(taxaMatch[1]) : 0;
    const cardTaxaValor = taxaMatch ? parseBRL(taxaMatch[2]) : 0;
    // Frete: prioriza o valor salvo no item do pedido, depois observações
    // ("Entrega: R$ x,xx"), com fallback para o resíduo do total.
    const shippingFromItem = Number((o.items[0] as any)?.shipping ?? 0) || 0;
    const freteMatch = notesRaw.match(/Entrega(?:\s*\(([^)]+)\))?\s*:?\*?\s*R?\$?\s*([\d.,]+)/i);
    const shippingLabel =
      freteMatch && freteMatch[1] ? freteMatch[1].trim() : state.settings.deliveryLabel || "";
    const shippingFromNotes = freteMatch ? parseBRL(freteMatch[2]) : 0;
    const shippingResidual = Math.max(0, Number(o.total || 0) - subtotal - cardTaxaValor);
    const shippingValue =
      shippingFromItem > 0
        ? shippingFromItem
        : shippingFromNotes > 0
          ? shippingFromNotes
          : Math.round(shippingResidual * 100) / 100;
    const htmlEscape = (v: string) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
      );
    const rows = o.items
      .map(
        (i) => `
      <tr>
        <td>${htmlEscape(i.name)}</td>
        <td class="c">${i.qty}</td>
        <td class="r">${brl(i.price)}</td>
        <td class="r">${brl(i.price * i.qty)}</td>
      </tr>`,
      )
      .join("");
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
    <div style="display:flex;align-items:center;gap:12px">
      ${
        logoUrl
          ? `<img src="${htmlEscape(logoUrl)}" alt="${htmlEscape(storeName)}" style="max-height:56px;max-width:200px;object-fit:contain"/>`
          : `<h1>${htmlEscape(storeName)}</h1>`
      }
      <div>
        ${logoUrl ? `<div style="font-size:14px;font-weight:600">${htmlEscape(storeName)}</div>` : ""}
        <div class="muted">Recibo de Pedido</div>
      </div>
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
      ${cpfCliente ? `<div class="muted">CPF: ${htmlEscape(cpfCliente)}</div>` : ""}
      ${emailCliente ? `<div class="muted">E-mail: ${htmlEscape(emailCliente)}</div>` : ""}
    </div>
    <div class="box">
      <h3>Entrega</h3>
      ${(() => {
        const cepEntrega = extractFromNotes(o.notes, /^\s*\*?\s*CEP\s*:?\s*\*?\s*/i) || "";
        const refEntrega =
          extractFromNotes(o.notes, /^\s*\*?\s*Ponto de refer[êe]ncia\s*:?\s*\*?\s*/i) || "";
        const cityRaw = String(o.city || "").trim();
        const ufMatch = cityRaw.match(/^(.+?)\s*[\/\-]\s*([A-Za-z]{2})\s*$/);
        const cidadeStr = ufMatch ? ufMatch[1].trim() : cityRaw;
        const ufStr = ufMatch ? ufMatch[2].toUpperCase() : "";
        const linhas: string[] = [];
        if (o.address)
          linhas.push(`<div><strong>Endereço:</strong> ${htmlEscape(o.address)}</div>`);
        if (o.district)
          linhas.push(`<div><strong>Bairro:</strong> ${htmlEscape(o.district)}</div>`);
        if (cidadeStr)
          linhas.push(
            `<div><strong>Cidade:</strong> ${htmlEscape(cidadeStr)}${ufStr ? ` - <strong>UF:</strong> ${htmlEscape(ufStr)}` : ""}</div>`,
          );
        if (cepEntrega) linhas.push(`<div><strong>CEP:</strong> ${htmlEscape(cepEntrega)}</div>`);
        if (refEntrega)
          linhas.push(`<div><strong>Ponto de referência:</strong> ${htmlEscape(refEntrega)}</div>`);
        return linhas.length ? linhas.join("") : '<span class="muted">—</span>';
      })()}
    </div>
  </div>
  <table>
    <thead><tr><th>Produto</th><th class="c">Qtd</th><th class="r">Preço</th><th class="r">Subtotal</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><td colspan="3" class="r">Subtotal produtos</td><td class="r">${brl(subtotal)}</td></tr>
      <tr><td colspan="3" class="r">Taxa de entrega</td><td class="r">${shippingValue > 0 ? brl(shippingValue) : "Grátis"}</td></tr>
      <tr><td colspan="3" class="r"><strong>Total com entrega</strong></td><td class="r"><strong>${brl(Math.round((subtotal + (shippingValue || 0)) * 100) / 100)}</strong></td></tr>
      <tr><td colspan="3" class="r">Pagamento</td><td class="r">${htmlEscape(formatPaymentBreakdown(o))}</td></tr>
      ${cardTaxaValor > 0 ? `<tr><td colspan="3" class="r">Taxa cartão (${cardTaxaPct.toFixed(2)}%)</td><td class="r">${brl(cardTaxaValor)}</td></tr>` : ""}
      <tr class="total"><td colspan="3" class="r">TOTAL${cardTaxaValor > 0 || cardParcelas > 1 ? " com acréscimo" : ""}</td><td class="r">${brl(cardParcelas > 1 ? Math.round(cardParcelas * cardParcelaValor * 100) / 100 : o.total)}</td></tr>
      ${cardParcelas > 1 ? `<tr><td colspan="3" class="r">Parcelamento${cardBrand ? ` (${htmlEscape(cardBrand)})` : ""}</td><td class="r"><strong>${cardParcelas}x de ${brl(cardParcelaValor)}</strong></td></tr>` : ""}
    </tfoot>
  </table>
  ${notesLimpas ? `<div class="notes"><strong>Observações:</strong>\n${htmlEscape(notesLimpas)}</div>` : ""}
  <div class="footer">Obrigado pela preferência! • ${htmlEscape(storeName)}</div>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300));</script>
</body></html>`;
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) {
      toast.error("Permita pop-ups para imprimir o recibo");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function printLabel(o: Order) {
    const s = state.settings;
    const storeName = s.storeName || "Loja";
    const logoUrl = s.checkoutLogoUrl || "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const zappfyLogoAbs = origin + zappfyLabelLogo;
    const motoboyIconAbs = origin + motoboyLabelIcon;
    const htmlEscape = (v: string) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
      );
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
    const rand = (n: number) => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed % n;
    };
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
    if (!w) {
      toast.error("Permita pop-ups para imprimir a etiqueta");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function printLabels10x15(orders: Order[]) {
    if (!orders.length) {
      toast.error("Selecione ao menos um pedido para imprimir");
      return;
    }

    const opened = openShippingLabels({
      storeName: state.settings.storeName || "Loja",
      logoUrl: state.settings.checkoutLogoUrl || null,
      orders: orders.map((order) => {
        const assignment = assignmentByOrder.get(order.id);
        return {
          id: order.id,
          customer: order.customer,
          phone: order.phone,
          address: order.address,
          district: order.district,
          city: order.city,
          total: Number(order.total || 0),
          date: order.date,
          notes: order.notes,
          paymentLabel: formatPaymentBreakdown(order),
          items: (order.items || []).map((item) => ({ name: item.name, qty: Number(item.qty || 0) })),
          courierName: assignment?.courier_name || null,
          scheduledFor: assignment?.scheduled_for || null,
        };
      }),
    });

    if (!opened) toast.error("Permita pop-ups para gerar as etiquetas 10x15");
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
  const [receiptsOrder, setReceiptsOrder] = useState<Order | null>(null);

  type DateRangeKey = "all" | "today" | "yesterday" | "7d" | "30d" | "month" | "custom";
  const [dateRange, setDateRange] = useState<DateRangeKey>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const PAGE_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const dateBounds = useMemo(() => {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const endOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    switch (dateRange) {
      case "today":
        return { from: startOfDay(now), to: endOfDay(now) };
      case "yesterday": {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        return { from: startOfDay(y), to: endOfDay(y) };
      }
      case "7d": {
        const f = new Date(now);
        f.setDate(f.getDate() - 6);
        return { from: startOfDay(f), to: endOfDay(now) };
      }
      case "30d": {
        const f = new Date(now);
        f.setDate(f.getDate() - 29);
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

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return state.orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      const assignment = assignmentByOrder.get(o.id);
      if (courierFilter === "unassigned" && assignment?.courier_id) return false;
      if (
        courierFilter !== "all" &&
        courierFilter !== "unassigned" &&
        assignment?.courier_id !== courierFilter
      )
        return false;
      if (dateBounds.from || dateBounds.to) {
        const d = new Date(o.date);
        if (dateBounds.from && d < dateBounds.from) return false;
        if (dateBounds.to && d > dateBounds.to) return false;
      }
      if (q) {
        const cpf = extractFromNotes(o.notes, customerCpfNoteLabel);
        const phoneDigits = (o.phone || "").replace(/\D/g, "");
        const cpfDigits = cpf.replace(/\D/g, "");
        const idDigits = o.id.replace(/\D/g, "");
        const hay = `${o.customer || ""} ${o.phone || ""} ${o.id} ${cpf}`.toLowerCase();
        const matchesText = hay.includes(q);
        const matchesDigits =
          qDigits.length > 0 &&
          (phoneDigits.includes(qDigits) ||
            cpfDigits.includes(qDigits) ||
            idDigits.includes(qDigits));
        if (!matchesText && !matchesDigits) return false;
      }
      return true;
    });
  }, [state.orders, filter, courierFilter, assignmentByOrder, dateBounds, debouncedSearch]);

  // Renderiza a lista em blocos para não montar centenas de linhas de uma vez
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, dateBounds, debouncedSearch]);

  const visibleOrders = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = filtered.length > visibleOrders.length;

  const dateOptions: { key: DateRangeKey; label: string }[] = [
    { key: "all", label: "Todo período" },
    { key: "today", label: "Hoje" },
    { key: "yesterday", label: "Ontem" },
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
    { key: "month", label: "Mês" },
    { key: "custom", label: "Personalizado" },
  ];

  const checkoutLink = buildPublicUrl(
    state.settings.slug ? `/loja/${state.settings.slug}` : "/checkout",
    publicBaseUrl,
  );

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
          <NewOrderDialog
            open={open}
            setOpen={setOpen}
            onCreate={async (o) => {
              await addOrder(o);
              toast.success("Pedido criado!");
              setOpen(false);
            }}
          />
        </div>
      }
    >
      {/* Search */}
      <div className="mb-3">
        <div className="relative max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF, telefone ou nº do pedido..."
            className="pl-9 pr-9 h-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {dateOptions.map((d) => (
          <Chip key={d.key} active={dateRange === d.key} onClick={() => setDateRange(d.key)}>
            {d.label}
          </Chip>
        ))}
        {dateRange === "custom" && (
          <div className="flex items-center gap-2 ml-1">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 w-[150px]"
            />
            <span className="text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 w-[150px]"
            />
          </div>
        )}
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          Todos
        </Chip>
        {statusList.map((s) => (
          <Chip key={s.value} active={filter === s.value} onClick={() => setFilter(s.value)}>
            {s.label}
          </Chip>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={courierFilter} onValueChange={setCourierFilter}>
          <SelectTrigger className="w-[210px]">
            <SelectValue placeholder="Motoboy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os motoboys</SelectItem>
            <SelectItem value="unassigned">Não atribuído</SelectItem>
            {couriers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <Button
            onClick={() => {
              setAssignmentDate(deliveryDateKey());
              setAssignOpen(true);
            }}
          >
            <Users className="mr-2 h-4 w-4" />
            Atribuir ao motoboy ({selected.size})
          </Button>
        )}
        {selected.size > 0 && (
          <Button
            variant="outline"
            onClick={() => printLabels10x15(state.orders.filter((order) => selected.has(order.id)))}
          >
            <Tag className="mr-2 h-4 w-4" />
            Imprimir etiquetas 10x15 ({selected.size})
          </Button>
        )}
      </div>

      {(() => {
        const renderActions = (o: (typeof filtered)[number], compact = false) => (
          <div
            className={`flex items-center flex-wrap ${compact ? "gap-1" : "justify-end gap-0.5"}`}
          >
            <button
              onClick={() => setEditing(o)}
              title="Editar pedido"
              className="text-muted-foreground hover:text-primary p-0.5"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => printReceipt(o)}
              title="Gerar recibo e imprimir"
              className="text-muted-foreground hover:text-primary p-0.5"
            >
              <Receipt className="h-4 w-4" />
            </button>
            <button
              onClick={() => printLabels10x15([o])}
              title="Gerar etiqueta térmica 10x15"
              className="text-muted-foreground hover:text-primary p-0.5"
            >
              <Tag className="h-4 w-4" />
            </button>
            <button
              onClick={() => setMotoboyFor(o)}
              title="Enviar endereço para o motoboy no WhatsApp"
              className="text-muted-foreground hover:text-blue-500 p-0.5"
            >
              <Bike className="h-4 w-4" />
            </button>
            <button
              onClick={() => setReceiptsOrder(o)}
              title="Comprovantes do pedido"
              className="text-muted-foreground hover:text-primary p-0.5"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              onClick={() => openCustomerWhatsApp(o)}
              title="Falar com o cliente no WhatsApp"
              className="text-muted-foreground hover:text-green-500 p-0.5"
            >
              <Phone className="h-4 w-4" />
            </button>
            <button
              onClick={() => notifyDelivery(o)}
              title="Avisar cliente no WhatsApp que o pedido saiu para entrega"
              className="text-muted-foreground hover:text-green-500 p-0.5"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => setTrackingOpen(trackingOpen === o.id ? null : o.id)}
              title="Rastreamento da entrega em tempo real"
              className={`p-0.5 ${trackingOpen === o.id ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            >
              <MapPin className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (confirm("Excluir este pedido? O estoque será devolvido.")) deleteOrder(o.id);
              }}
              title="Excluir pedido"
              className="text-muted-foreground hover:text-destructive p-0.5"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );

        const renderStatus = (o: (typeof filtered)[number], full = false) => (
          <Select value={o.status} onValueChange={(v) => handleStatusChange(o, v as OrderStatus)}>
            <SelectTrigger
              className={`h-8 ${full ? "w-full" : "w-full max-w-[150px] truncate"} border-0 text-xs px-2 ${statusMap[o.status]?.color ?? ""}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusList.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

        return (
          <>
            {/* Mobile / tablet: cards */}
            <div className="lg:hidden space-y-3">
              {filtered.length === 0 && (
                <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-muted-foreground">
                  Nenhum pedido encontrado.
                </div>
              )}
              {visibleOrders.map((o) => {
                const profit = getOrderProfit(o);
                const revenueBase = getOrderNetReceived(o);
                const margin = revenueBase > 0 ? (profit / revenueBase) * 100 : 0;
                return (
                  <div
                    key={o.id}
                    className="rounded-2xl border border-border bg-card p-4 shadow-elegant"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Checkbox
                        checked={selected.has(o.id)}
                        onCheckedChange={(v) =>
                          setSelected((s) => {
                            const n = new Set(s);
                            if (v) n.add(o.id);
                            else n.delete(o.id);
                            return n;
                          })
                        }
                      />
                      <span className="text-xs text-muted-foreground">Selecionar</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{o.customer}</div>
                        <div className="text-xs text-muted-foreground truncate">{o.phone}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold">{brl(o.total)}</div>
                        <div
                          className={`text-xs font-semibold ${profit >= 0 ? "text-emerald-500" : "text-destructive"}`}
                        >
                          {brl(profit)} · {margin.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 text-sm break-words">
                      {(o.items ?? []).map((it) => `${it.qty}x ${it.name}`).join(", ")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(o.items ?? []).reduce((n, it) => n + it.qty, 0)} item(s) ·{" "}
                      {formatPaymentBreakdown(o)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {[o.district, fmtDate(o.date)].filter(Boolean).join(" · ")}
                    </div>
                    <div className="mt-1 text-xs">
                      <Bike className="mr-1 inline h-3.5 w-3.5" />
                      {assignmentByOrder.get(o.id)?.courier_name || "Não atribuído"}
                      {assignmentByOrder.get(o.id)?.scheduled_for && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          Entrega:{" "}
                          {formatScheduledDeliveryDate(assignmentByOrder.get(o.id)?.scheduled_for)}
                        </span>
                      )}
                    </div>
                    <div className="mt-3">{renderStatus(o, true)}</div>
                    <div className="mt-3 border-t border-border pt-2">{renderActions(o, true)}</div>
                    {trackingOpen === o.id && (
                      <div className="mt-3">
                        <DeliveryTrackingPanel
                          orderId={o.id}
                          customerPhone={o.phone}
                          orderAddress={[o.address, o.district, o.city].filter(Boolean).join(", ")}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-secondary"
                >
                  Carregar mais ({filtered.length - visibleOrders.length} restantes)
                </button>
              )}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden lg:block w-full max-w-full rounded-2xl border border-border bg-card overflow-hidden shadow-elegant">
              <table className="w-full table-fixed text-sm box-border">
                <colgroup>
                  <col className="w-[4%]" />
                  <col className="w-[13%]" />
                  <col className="w-[17%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[17%]" />
                  <col className="w-[16%]" />
                </colgroup>
                <thead className="text-xs uppercase tracking-wider text-muted-foreground bg-secondary/40">
                  <tr>
                    <th className="px-2 py-3">
                      <Checkbox
                        checked={
                          visibleOrders.length > 0 && visibleOrders.every((o) => selected.has(o.id))
                        }
                        onCheckedChange={(v) =>
                          setSelected(v ? new Set(visibleOrders.map((o) => o.id)) : new Set())
                        }
                      />
                    </th>
                    <th className="text-left px-2 py-3 font-medium">Cliente</th>
                    <th className="text-left px-2 py-3 font-medium">Produto</th>
                    <th className="text-left px-2 py-3 font-medium">Bairro</th>
                    <th className="text-left px-2 py-3 font-medium">Motoboy</th>
                    <th className="text-left px-2 py-3 font-medium">Data</th>
                    <th className="text-right px-2 py-3 font-medium">Valor</th>
                    <th className="text-right px-2 py-3 font-medium">Lucro</th>
                    <th className="text-left px-2 py-3 font-medium">Status</th>
                    <th className="text-right px-2 py-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                        Nenhum pedido encontrado.
                      </td>
                    </tr>
                  )}
                  {visibleOrders.map((o) => {
                    const profit = getOrderProfit(o);
                    const revenueBase = getOrderNetReceived(o);
                    const margin = revenueBase > 0 ? (profit / revenueBase) * 100 : 0;
                    return (
                      <Fragment key={o.id}>
                        <tr className="border-t border-border hover:bg-secondary/30 align-middle">
                          <td className="px-2 py-3">
                            <Checkbox
                              checked={selected.has(o.id)}
                              onCheckedChange={(v) =>
                                setSelected((s) => {
                                  const n = new Set(s);
                                  if (v) n.add(o.id);
                                  else n.delete(o.id);
                                  return n;
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-3">
                            <div className="font-medium truncate">{o.customer}</div>
                            <div className="text-xs text-muted-foreground truncate">{o.phone}</div>
                          </td>
                          <td className="px-2 py-3">
                            <div className="truncate">
                              {(o.items ?? []).map((it) => `${it.qty}x ${it.name}`).join(", ")}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {(o.items ?? []).reduce((n, it) => n + it.qty, 0)} item(s) ·{" "}
                              {formatPaymentBreakdown(o)}
                            </div>
                          </td>
                          <td className="px-2 py-3 truncate">{o.district}</td>
                          <td className="px-2 py-3 text-xs">
                            <div className="truncate">
                              {assignmentByOrder.get(o.id)?.courier_name || "Não atribuído"}
                            </div>
                            {assignmentByOrder.get(o.id)?.scheduled_for && (
                              <div className="mt-0.5 truncate text-[10px] font-medium text-primary">
                                {formatScheduledDeliveryDate(
                                  assignmentByOrder.get(o.id)?.scheduled_for,
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {fmtDate(o.date)}
                          </td>
                          <td className="px-2 py-3 text-right font-semibold whitespace-nowrap">
                            {brl(o.total)}
                          </td>
                          <td className="px-2 py-3 text-right whitespace-nowrap">
                            <div
                              className={`font-semibold ${profit >= 0 ? "text-emerald-500" : "text-destructive"}`}
                            >
                              {brl(profit)}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {margin.toFixed(1)}%
                            </div>
                          </td>
                          <td className="px-2 py-3 overflow-hidden">{renderStatus(o)}</td>
                          <td className="px-1 py-3 text-right overflow-hidden">
                            {renderActions(o)}
                          </td>
                        </tr>
                        {trackingOpen === o.id && (
                          <tr className="border-t border-border bg-secondary/10">
                            <td colSpan={10} className="px-4 py-4">
                              <DeliveryTrackingPanel
                                orderId={o.id}
                                customerPhone={o.phone}
                                orderAddress={[o.address, o.district, o.city]
                                  .filter(Boolean)
                                  .join(", ")}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {hasMore && (
                <div className="border-t border-border p-3 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                    className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
                  >
                    Carregar mais ({filtered.length - visibleOrders.length} restantes)
                  </button>
                </div>
              )}
            </div>
          </>
        );
      })()}

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
          toast.success(
            patch.date ? "Data do pedido atualizada com sucesso." : "Pedido atualizado!",
          );
          setEditing(null);
        }}
      />

      <MotoboyDialog
        order={motoboyFor}
        onClose={() => setMotoboyFor(null)}
        buildText={buildMotoboyText}
      />

      <OrderReceiptsModal
        order={receiptsOrder}
        open={!!receiptsOrder}
        onOpenChange={(open) => !open && setReceiptsOrder(null)}
      />
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir ao motoboy</DialogTitle>
            <DialogDescription>
              Escolha quem fará a entrega e em qual dia o pedido deve entrar na rota do motoboy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motoboy</Label>
              <Select value={targetCourier} onValueChange={setTargetCourier}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um motoboy ativo" />
                </SelectTrigger>
                <SelectContent>
                  {couriers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="mb-3 flex items-center gap-2 font-medium">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Dia planejado da entrega
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={assignmentDate === deliveryDateKey() ? "default" : "outline"}
                  onClick={() => setAssignmentDate(deliveryDateKey())}
                >
                  Hoje
                </Button>
                <Button
                  type="button"
                  variant={assignmentDate === deliveryDatePlusDays(1) ? "default" : "outline"}
                  onClick={() => setAssignmentDate(deliveryDatePlusDays(1))}
                >
                  Amanhã
                </Button>
              </div>
              <Label htmlFor="courier-delivery-date">Escolher outra data</Label>
              <Input
                id="courier-delivery-date"
                type="date"
                min={deliveryDateKey()}
                value={assignmentDate}
                onChange={(event) => setAssignmentDate(event.target.value)}
                className="mt-1.5"
              />
              <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Entrega planejada:</span>{" "}
                <b className="text-primary">{formatScheduledDeliveryDate(assignmentDate)}</b>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={!targetCourier || !assignmentDate} onClick={assignSelected}>
              Confirmar atribuição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function EditOrderDialog({
  order,
  onClose,
  onSave,
}: {
  order: Order | null;
  onClose: () => void;
  onSave: (patch: Partial<Omit<Order, "id">>) => void;
}) {
  const [form, setForm] = useState({
    customer: "",
    phone: "",
    address: "",
    district: "",
    city: "",
    payment: "pix" as any,
    status: "aguardando" as OrderStatus,
    notes: "",
  });
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [totalEdited, setTotalEdited] = useState(false);
  const [orderDate, setOrderDate] = useState<Date | undefined>(undefined);
  const [secondPayment, setSecondPayment] = useState<string>("none");
  const [secondPaymentValue, setSecondPaymentValue] = useState<number>(0);

  useMemo(() => {
    if (order) {
      setForm({
        customer: order.customer,
        phone: order.phone,
        address: order.address,
        district: order.district,
        city: order.city,
        payment: (normalizePaymentBreakdown(order)[0]?.method || order.payment) as any,
        status: order.status,
        notes: order.notes ?? "",
      });
      setItems(order.items.map((it) => ({ ...it })));
      setTotal(order.total);
      setTotalEdited(false);
      setOrderDate(order.date ? new Date(order.date) : new Date());
      const paymentParts = normalizePaymentBreakdown(order);
      const secondPart = paymentParts.length > 1 ? paymentParts[1] : null;
      setSecondPayment(secondPart?.method || "none");
      setSecondPaymentValue(secondPart?.amount || 0);
    }
  }, [order]);

  // Soma sugerida (itens + frete embutido no primeiro item, se houver)
  const itemsSubtotal = items.reduce(
    (acc, it) => acc + (Number(it.price) || 0) * (Number(it.qty) || 0),
    0,
  );
  const shipping = Number((items[0] as any)?.shipping ?? 0) || 0;
  const suggested = Math.round((itemsSubtotal + shipping) * 100) / 100;

  // Auto-atualiza total se usuário não editou manualmente
  useEffect(() => {
    if (!totalEdited) setTotal(suggested);
  }, [suggested, totalEdited]);

  const updateItem = (idx: number, patch: any) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const { state } = useStore();
  const [addProductId, setAddProductId] = useState<string>("");
  const addProductToOrder = () => {
    const p = state.products.find((x) => x.id === addProductId);
    if (!p) {
      toast.error("Selecione um produto");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        name: p.name,
        qty: 1,
        price: Number(p.price) || 0,
        cost: Number(p.cost) || 0,
      },
    ]);
    setAddProductId("");
  };

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar pedido</DialogTitle>
          <DialogDescription>
            Altere dados do cliente, itens, valores e pagamento.
          </DialogDescription>
        </DialogHeader>
        <FormErrorBoundary title="Erro ao carregar a edição do pedido">
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cliente" icon={UserIcon} iconTone="primary">
                <Input
                  value={form.customer}
                  onChange={(e) => setForm({ ...form, customer: e.target.value })}
                />
              </Field>
              <Field label="Telefone" icon={Phone}>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Endereço" icon={MapPin} iconTone="primary">
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bairro" icon={Home}>
                <Input
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                />
              </Field>
              <Field label="Cidade" icon={Building2}>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </Field>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>Itens do pedido</span>
              </div>
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Field
                      label={idx === 0 ? "Produto" : ""}
                      icon={idx === 0 ? ShoppingCart : undefined}
                    >
                      <Input
                        value={it.name ?? ""}
                        onChange={(e) => updateItem(idx, { name: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Field label={idx === 0 ? "Qtd" : ""} icon={idx === 0 ? Hash : undefined}>
                      <QuantitySelector
                        value={Number(it.qty) || 1}
                        onChange={(qty) => updateItem(idx, { qty })}
                      />
                    </Field>
                  </div>
                  <div className="col-span-4">
                    <Field
                      label={idx === 0 ? "Valor unit. (R$)" : ""}
                      icon={idx === 0 ? DollarSign : undefined}
                    >
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={it.price}
                        onChange={(e) =>
                          updateItem(idx, { price: Math.max(0, Number(e.target.value) || 0) })
                        }
                      />
                    </Field>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(idx)}
                      disabled={items.length <= 1}
                      title="Remover item"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex gap-2 items-end pt-2 border-t border-border">
                <div className="flex-1">
                  <Field label="Adicionar produto">
                    <Select value={addProductId} onValueChange={setAddProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto..." />
                      </SelectTrigger>
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
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" /> Entrega: R$ {shipping.toFixed(2)}
                </div>
              )}
            </div>

            <Field label="Data do pedido" icon={CalendarIcon} iconTone="primary">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !orderDate && "text-muted-foreground",
                    )}
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
                <Select
                  value={form.payment}
                  onValueChange={(v: any) => setForm({ ...form, payment: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="debito">Cartão de Débito</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status" icon={Flag}>
                <Select
                  value={form.status}
                  onValueChange={(v: any) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusList.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Wallet className="h-3.5 w-3.5" /> Pagamento dividido (opcional)
              </div>
              <div className="grid grid-cols-[1fr_150px] gap-2">
                <Field label="2ª FORMA">
                  <Select value={secondPayment} onValueChange={setSecondPayment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nenhum —</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="debito">Cartão de Débito</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="VALOR DA 2ª PARTE">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={secondPaymentValue}
                    disabled={secondPayment === "none"}
                    onChange={(e) =>
                      setSecondPaymentValue(Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                </Field>
              </div>
              {secondPayment !== "none" && secondPaymentValue > 0 && (
                <div className="text-xs text-muted-foreground">
                  {paymentMethodLabel(form.payment)}:{" "}
                  <b className="text-foreground">{brl(Math.max(0, total - secondPaymentValue))}</b>{" "}
                  · {paymentMethodLabel(secondPayment)}:{" "}
                  <b className="text-foreground">{brl(secondPaymentValue)}</b>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Total (R$)${totalEdited ? " — manual" : ""}`}>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={total}
                  onChange={(e) => {
                    setTotalEdited(true);
                    setTotal(Math.max(0, Number(e.target.value) || 0));
                  }}
                />
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTotalEdited(false);
                    setTotal(suggested);
                  }}
                >
                  Recalcular ({suggested.toFixed(2)})
                </Button>
              </div>
            </div>

            <Field label="Observações">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>
        </FormErrorBoundary>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (secondPayment !== "none") {
                if (secondPayment === form.payment) {
                  toast.error("A segunda forma de pagamento deve ser diferente da primeira.");
                  return;
                }
                if (secondPaymentValue <= 0 || secondPaymentValue >= total) {
                  toast.error(
                    "No pagamento dividido, informe um valor da 2ª parte maior que zero e menor que o total.",
                  );
                  return;
                }
              }
              // Recalcula metadados da taxa do cartão se aplicável.
              const prevMeta = getOrderFeeMeta({ items: order?.items ?? [] });
              let nextItems = items as any[];
              if (!isCardPaymentMethod(form.payment)) {
                // Trocou para PIX/dinheiro/etc → remove metadados da taxa.
                nextItems = attachFeeMetaToItems(nextItems, null);
              } else if (prevMeta) {
                // Mantém modo/percentual/marca/parcelas, mas recalcula com o
                // novo total (baseTotal = total salvo quando absorb; total - fee
                // atual quando passthrough).
                const rawTotal = Number(total) || 0;
                const baseTotal =
                  prevMeta.cardFeeMode === "passthrough"
                    ? Math.max(0, rawTotal - prevMeta.cardFeeAmount)
                    : rawTotal;
                const rebuilt = buildOrderFeeMeta({
                  payment: form.payment,
                  baseTotal,
                  cardFeePercentage: prevMeta.cardFeePercentage,
                  cardFeeMode: prevMeta.cardFeeMode === "passthrough" ? "passthrough" : "absorb",
                  cardBrand: prevMeta.cardBrand,
                  cardInstallments: prevMeta.cardInstallments,
                });
                nextItems = attachFeeMetaToItems(nextItems, rebuilt);
              }
              const paymentBreakdown = buildPaymentBreakdown(
                form.payment,
                total,
                secondPayment,
                secondPaymentValue,
              );
              nextItems = attachPaymentBreakdownToItems(nextItems, paymentBreakdown);
              const patch: any = { ...form, items: nextItems, total };
              if (orderDate) {
                // Preserva a hora original do pedido (ou usa agora, se for novo)
                const src = order?.date ? new Date(order.date) : new Date();
                const dt = new Date(
                  orderDate.getFullYear(),
                  orderDate.getMonth(),
                  orderDate.getDate(),
                  src.getHours(),
                  src.getMinutes(),
                  src.getSeconds(),
                  src.getMilliseconds(),
                );
                patch.date = dt.toISOString();
              }
              onSave(patch);
            }}
          >
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
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

const MACHINE_BRANDS = [
  "VISA",
  "MASTERCARD",
  "ELO",
  "AMEX",
  "DÉBITO",
  "PIX",
  "DINHEIRO",
  "LINK",
] as const;
type MachineFees = Record<string, Record<number, number>>; // brand -> parcela -> %

function loadMachineFees(): MachineFees {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("machineFees") || "{}");
  } catch {
    return {};
  }
}
function saveMachineFees(f: MachineFees) {
  if (typeof window !== "undefined") localStorage.setItem("machineFees", JSON.stringify(f));
}
function noInstallmentBrand(b: string) {
  return b === "DÉBITO" || b === "PIX" || b === "DINHEIRO";
}

function parseDecimalInput(value: string) {
  const clean = String(value ?? "")
    .replace(/[^\d,.]/g, "")
    .trim();
  if (!clean) return 0;
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  const normalized =
    decimalIndex >= 0
      ? `${clean.slice(0, decimalIndex).replace(/\D/g, "")}.${clean.slice(decimalIndex + 1).replace(/\D/g, "")}`
      : clean.replace(/\D/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function toNum(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value: unknown) {
  return Math.round(toNum(value) * 100) / 100;
}

function SectionLabel({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
      <Icon className="h-3.5 w-3.5" />
      <span>{children}</span>
    </div>
  );
}

function NewOrderDialog({
  open,
  setOpen,
  onCreate,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onCreate: (o: Omit<Order, "id">) => void | Promise<void>;
}) {
  const { state, updateSettings } = useStore();
  const [form, setForm] = useState({
    customer: "",
    phone: "",
    address: "",
    district: "",
    city: "",
    payment: "pix" as "pix" | "cartao" | "debito" | "dinheiro",
    status: "aguardando" as OrderStatus,
    notes: "",
  });
  const [orderDate, setOrderDate] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
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
  const [discountInput, setDiscountInput] = useState<string>("");
  const discountValue = parseDecimalInput(discountInput);
  const [couponCode, setCouponCode] = useState<string>("");
  const [couponApplied, setCouponApplied] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Segundo pagamento
  const [secondPayment, setSecondPayment] = useState<string>("none");
  const [secondPaymentValue, setSecondPaymentValue] = useState<number>(0);

  // Modal de taxas de maquininha
  const [feesOpen, setFeesOpen] = useState(false);

  // Bandeira / parcelas (somente quando pagamento = cartão)
  const [cardBrand, setCardBrand] = useState<string>("VISA");
  const [cardInstallments, setCardInstallments] = useState<number>(1);
  const [cardFeeModeLocal, setCardFeeModeLocal] = useState<"absorb" | "passthrough">(
    state.settings.cardFeeMode === "absorb" ? "absorb" : "passthrough",
  );
  useEffect(() => {
    setCardFeeModeLocal(state.settings.cardFeeMode === "absorb" ? "absorb" : "passthrough");
  }, [state.settings.cardFeeMode]);
  const rawMachineFees =
    state.settings.cardMachineFees &&
    typeof state.settings.cardMachineFees === "object" &&
    Object.keys(state.settings.cardMachineFees).length > 0
      ? state.settings.cardMachineFees
      : loadMachineFees();
  const machineFees: MachineFees = (
    rawMachineFees && typeof rawMachineFees === "object" ? rawMachineFees : {}
  ) as MachineFees;

  const isCardForm = form.payment === "cartao";

  // Ao trocar para PIX / dinheiro / débito, limpa parcelas herdadas do cartão.
  useEffect(() => {
    if (!isCardForm) setCardInstallments(1);
  }, [isCardForm]);

  const currentCardFeePct = isCardForm ? toNum(machineFees?.[cardBrand]?.[cardInstallments]) : 0;

  const selectedIds = new Set(lines.map((l) => l.productId));
  const available = state.products.filter((p) => !selectedIds.has(p.id));
  const safeNum = (n: unknown) => toNum(n);
  const subtotal = roundMoney(
    lines.reduce((sum, l) => {
      const prod = state.products.find((p) => p.id === l.productId);
      return sum + toNum(prod?.price) * Math.max(1, toNum(l?.qty) || 1);
    }, 0),
  );
  const dv = Math.max(0, safeNum(discountValue));
  const orderBase = roundMoney(subtotal + safeNum(shippingValue) + safeNum(feeValue));
  const discountAmount =
    discountType === "percent"
      ? roundMoney(Math.min(orderBase, (orderBase * Math.min(dv, 100)) / 100))
      : roundMoney(Math.min(orderBase, dv));
  const baseTotal = roundMoney(Math.max(0, orderBase - discountAmount));
  const cardFeeAmount =
    isCardForm && currentCardFeePct > 0 ? roundMoney(baseTotal * (currentCardFeePct / 100)) : 0;
  const isPassthrough = cardFeeModeLocal === "passthrough";
  const total = isCardForm && isPassthrough ? roundMoney(baseTotal + cardFeeAmount) : baseTotal;
  const netReceived =
    isCardForm && !isPassthrough ? roundMoney(Math.max(0, baseTotal - cardFeeAmount)) : baseTotal;

  function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      toast.error("Digite um código de cupom");
      return;
    }
    setCouponApplied(code);
    toast.success(`Cupom ${code} aplicado`);
  }

  function pickShipping(id: string) {
    setShippingOptionId(id);
    if (id === "none") {
      setShippingValue(0);
      return;
    }
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
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, qty: Math.max(1, qty) } : l)),
    );
  }
  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  function reset() {
    setForm({
      customer: "",
      phone: "",
      address: "",
      district: "",
      city: "",
      payment: "pix",
      status: "aguardando",
      notes: "",
    });
    setLines([]);
    setPicker("");
    setShippingOptionId("none");
    setShippingValue(0);
    setFeeLabel("");
    setFeeValue(0);
    setDiscountType("percent");
    setDiscountInput("");
    setCouponCode("");
    setCouponApplied("");
    setSecondPayment("none");
    setSecondPaymentValue(0);
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setOrderDate(d.toISOString().slice(0, 10));
  }

  const paymentOptions = [
    { value: "pix", label: "PIX" },
    { value: "cartao", label: "Cartão (Crédito)" },
    { value: "debito", label: "Cartão de Débito" },
    { value: "dinheiro", label: "Dinheiro" },
  ] as const;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo pedido</DialogTitle>
          <DialogDescription>
            Registre manualmente um pedido, com entrega, taxas, descontos, cupons e pagamento
            dividido.
          </DialogDescription>
        </DialogHeader>
        <FormErrorBoundary title="Erro ao montar o formulário de pedido">
          <div className="grid gap-3">
            {/* Cliente */}
            <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
              <SectionLabel icon={UserIcon}>Cliente</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome" icon={UserIcon} iconTone="primary">
                  <Input
                    value={form.customer}
                    onChange={(e) => setForm({ ...form, customer: e.target.value })}
                  />
                </Field>
                <Field label="Telefone" icon={Phone}>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            {/* Endereço */}
            <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
              <SectionLabel icon={MapPin}>Endereço</SectionLabel>
              <Field label="Rua / nº" icon={MapPin} iconTone="primary">
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bairro" icon={Home}>
                  <Input
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                  />
                </Field>
                <Field label="Cidade" icon={Building2}>
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </Field>
              </div>
            </div>

            {/* Produtos do pedido */}
            <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
              <SectionLabel icon={ShoppingBag}>Produtos do pedido</SectionLabel>
              <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
                {lines.length === 0 && (
                  <div className="text-xs text-muted-foreground py-2 text-center">
                    Nenhum produto adicionado ainda.
                  </div>
                )}
                {lines.map((l) => {
                  const prod = state.products.find((p) => p.id === l.productId);
                  if (!prod) return null;
                  const color = colorForProduct(prod.id);
                  const sub = prod.price * l.qty;
                  return (
                    <div
                      key={l.productId}
                      className={`flex items-center gap-2 rounded-lg border p-2 ${color}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate text-foreground">
                          {prod.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {brl(prod.price)} · subtotal {brl(sub)}
                        </div>
                      </div>
                      <QuantitySelector
                        value={Number(l.qty) || 1}
                        onChange={(qty) => updateQty(l.productId, qty)}
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
                                <span
                                  className={`inline-block h-2.5 w-2.5 rounded-full ${color.split(" ")[0]}`}
                                />
                                <span>{p.name}</span>
                                <span className="text-xs text-muted-foreground ml-1">
                                  {brl(p.price)}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                ) : state.products.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center pt-1">
                    Cadastre produtos primeiro.
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center pt-1">
                    Todos os produtos já foram adicionados.
                  </div>
                )}
              </div>
            </div>

            {/* Entrega */}
            <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
              <SectionLabel icon={Truck}>Entrega</SectionLabel>
              <div className="grid grid-cols-[1fr_140px] gap-2">
                <Select value={shippingOptionId} onValueChange={pickShipping}>
                  <SelectTrigger>
                    <SelectValue placeholder="Forma de entrega" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem entrega / retirada</SelectItem>
                    {(state.settings.shippingOptions ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label} — {brl(s.price)}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Valor personalizado</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={Number.isFinite(shippingValue) ? shippingValue : 0}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    setShippingValue(Number.isFinite(n) ? n : 0);
                    if (shippingOptionId === "none") setShippingOptionId("custom");
                  }}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            {/* Taxa adicional */}
            <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
              <SectionLabel icon={Receipt}>Taxa adicional (opcional)</SectionLabel>
              <div className="grid grid-cols-[1fr_140px] gap-2">
                <Input
                  placeholder="Descrição (ex: Taxa de serviço)"
                  value={feeLabel}
                  onChange={(e) => setFeeLabel(e.target.value)}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={Number.isFinite(feeValue) ? feeValue : 0}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    setFeeValue(Number.isFinite(n) ? n : 0);
                  }}
                  placeholder="R$ 0,00"
                />
              </div>
            </div>

            {/* Desconto / Cupom */}
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
              <SectionLabel icon={Tag}>Desconto (opcional)</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                <Field label="TIPO">
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">% Percentual</SelectItem>
                      <SelectItem value="valor">R$ Valor</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={discountType === "percent" ? "DESCONTO (%)" : "DESCONTO (R$)"}>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={discountInput}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d,.]/g, "");
                      setDiscountInput(raw);
                    }}
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
                    <Button
                      type="button"
                      size="sm"
                      onClick={applyCoupon}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    >
                      OK
                    </Button>
                  </div>
                </Field>
              </div>
              {discountAmount > 0 && (
                <div className="text-xs text-emerald-500 flex items-center gap-1">
                  <Percent className="h-3 w-3" />
                  Desconto aplicado: −{brl(discountAmount)}{" "}
                  {couponApplied && `(cupom ${couponApplied})`}
                </div>
              )}
            </div>

            {/* Pagamento */}
            <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
              <SectionLabel icon={CreditCard}>Pagamento</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Forma">
                  <Select
                    value={form.payment}
                    onValueChange={(v: any) => {
                      try {
                        const next = String(v || "pix") as typeof form.payment;
                        if (next !== "cartao") {
                          // limpa parcelas/taxas herdadas do cartão
                          setCardInstallments(1);
                        }
                        setForm((prev) => ({ ...prev, payment: next }));
                      } catch (err) {
                        console.error("[pedidos] falha ao trocar forma de pagamento", err);
                        toast.error("Não foi possível alterar a forma de pagamento");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentOptions.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status" icon={Flag}>
                  <Select
                    value={form.status}
                    onValueChange={(v: any) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusList.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {form.payment === "cartao" && (
                <div className="rounded-lg border border-border/60 bg-background/40 p-2.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <CreditCard className="h-3.5 w-3.5" />
                    <span>Maquininha — bandeira e parcelas</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="BANDEIRA">
                      <Select
                        value={cardBrand}
                        onValueChange={(v) => {
                          setCardBrand(v);
                          if (noInstallmentBrand(v)) setCardInstallments(1);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MACHINE_BRANDS.map((b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="PARCELAS">
                      <Select
                        value={String(cardInstallments)}
                        onValueChange={(v) => setCardInstallments(Number(v))}
                        disabled={noInstallmentBrand(cardBrand)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}x
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>
                      Taxa configurada:{" "}
                      <strong className="text-foreground">{currentCardFeePct.toFixed(2)}%</strong>
                    </span>
                    <span>
                      Valor da taxa:{" "}
                      <strong className="text-foreground">{brl(cardFeeAmount)}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCardFeeModeLocal("absorb")}
                      className={`text-left rounded-lg border p-2 text-xs transition ${
                        cardFeeModeLocal === "absorb"
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-semibold text-sm">A loja absorve</div>
                      <div className="text-[10px] text-muted-foreground">
                        Taxa sai do lucro. Cliente paga só o valor base.
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardFeeModeLocal("passthrough")}
                      className={`text-left rounded-lg border p-2 text-xs transition ${
                        cardFeeModeLocal === "passthrough"
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-semibold text-sm">Repassar ao cliente</div>
                      <div className="text-[10px] text-muted-foreground">
                        Taxa somada ao total. Loja recebe o valor base.
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <Field label="Data do pedido" icon={CalendarIcon} iconTone="primary">
                <Input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Nenhum —</SelectItem>
                        {paymentOptions.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="VALOR (R$)">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={secondPaymentValue}
                      onChange={(e) => setSecondPaymentValue(Number(e.target.value))}
                      placeholder="0,00"
                      disabled={secondPayment === "none"}
                    />
                  </Field>
                </div>
              </div>

              {secondPayment !== "none" && secondPaymentValue > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs">
                  <div className="font-semibold text-foreground mb-1">Divisão do pagamento</div>
                  <div className="flex justify-between">
                    <span>{paymentMethodLabel(form.payment)}</span>
                    <b>{brl(Math.max(0, total - secondPaymentValue))}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>{paymentMethodLabel(secondPayment)}</span>
                    <b>{brl(secondPaymentValue)}</b>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    A 1ª forma recebe automaticamente o restante do total.
                  </div>
                </div>
              )}

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
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notas internas sobre o pedido..."
              />
            </div>

            {/* Resumo */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{brl(subtotal)}</span>
              </div>
              {shippingValue > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Entrega</span>
                  <span>{brl(shippingValue)}</span>
                </div>
              )}
              {feeValue > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{feeLabel || "Taxa"}</span>
                  <span>{brl(feeValue)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-500">
                  <span>Desconto{couponApplied ? ` (${couponApplied})` : ""}</span>
                  <span>−{brl(discountAmount)}</span>
                </div>
              )}
              {form.payment === "cartao" && cardFeeAmount > 0 && isPassthrough && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Acréscimo do cartão ({currentCardFeePct.toFixed(2)}%)</span>
                  <span>+{brl(cardFeeAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-border mt-1">
                <span>Total cobrado do cliente</span>
                <span className="text-primary">{brl(total)}</span>
              </div>
              {form.payment === "cartao" && cardFeeAmount > 0 && !isPassthrough && (
                <>
                  <div className="flex justify-between text-rose-400">
                    <span>Taxa do cartão absorvida ({currentCardFeePct.toFixed(2)}%)</span>
                    <span>−{brl(cardFeeAmount)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-emerald-400">
                    <span>Valor líquido recebido</span>
                    <span>{brl(netReceived)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </FormErrorBoundary>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            disabled={saving}
            onClick={() => {
              if (!form.customer) {
                toast.error("Preencha o nome do cliente");
                return;
              }
              if (lines.length === 0) {
                toast.error("Adicione ao menos um produto");
                return;
              }
              if (secondPayment !== "none") {
                if (secondPayment === form.payment) {
                  toast.error("Escolha uma forma diferente para o segundo pagamento.");
                  return;
                }
                if (secondPaymentValue <= 0 || secondPaymentValue >= total) {
                  toast.error(
                    "No pagamento dividido, o valor da 2ª parte precisa ser maior que zero e menor que o total.",
                  );
                  return;
                }
              }
              const rawItems = lines.map((l) => {
                const prod = state.products.find((p) => p.id === l.productId)!;
                return {
                  productId: prod.id,
                  name: prod.name,
                  qty: l.qty,
                  price: prod.price,
                  cost: prod.cost,
                };
              });
              const feeMeta =
                form.payment === "cartao"
                  ? buildOrderFeeMeta({
                      payment: form.payment,
                      baseTotal,
                      cardFeePercentage: currentCardFeePct,
                      cardFeeMode: isPassthrough ? "passthrough" : "absorb",
                      cardBrand,
                      cardInstallments,
                    })
                  : null;
              let items = attachFeeMetaToItems(rawItems as any[], feeMeta);
              items = attachPaymentBreakdownToItems(
                items,
                buildPaymentBreakdown(form.payment, total, secondPayment, secondPaymentValue),
              );
              const extraNotesLines: string[] = [];
              if (shippingValue > 0) extraNotesLines.push(`Entrega: ${brl(shippingValue)}`);
              if (feeValue > 0) extraNotesLines.push(`${feeLabel || "Taxa"}: ${brl(feeValue)}`);
              if (discountAmount > 0)
                extraNotesLines.push(
                  `Desconto${couponApplied ? ` (cupom ${couponApplied})` : ""}: -${brl(discountAmount)}`,
                );
              if (form.payment === "cartao") {
                const modeLabel = isPassthrough ? "repassada ao cliente" : "absorvida pela loja";
                extraNotesLines.push(
                  `Cartão: ${cardBrand} ${cardInstallments}x — Taxa ${currentCardFeePct.toFixed(2)}% ${modeLabel} (${brl(cardFeeAmount)})`,
                );
                if (!isPassthrough)
                  extraNotesLines.push(`Valor líquido recebido: ${brl(netReceived)}`);
              }
              if (secondPayment !== "none" && secondPaymentValue > 0) {
                const label =
                  paymentOptions.find((p) => p.value === secondPayment)?.label || secondPayment;
                extraNotesLines.push(`Segundo pagamento: ${label} — ${brl(secondPaymentValue)}`);
              }
              const finalNotes = [form.notes, extraNotesLines.join("\n")]
                .filter(Boolean)
                .join("\n\n");
              const orderToCreate = {
                customer: form.customer,
                phone: form.phone,
                address: form.address,
                district: form.district,
                city: form.city,
                items,
                total,
                payment: form.payment,
                status: form.status,
                notes: finalNotes,
                date: (() => {
                  const now = new Date();
                  const [y, m, d] = orderDate.split("-").map(Number);
                  const dt = new Date(
                    y,
                    (m || 1) - 1,
                    d || 1,
                    now.getHours(),
                    now.getMinutes(),
                    now.getSeconds(),
                  );
                  return dt.toISOString();
                })(),
              };
              setSaving(true);
              Promise.resolve(onCreate(orderToCreate))
                .then(() => reset())
                .catch(() => {})
                .finally(() => setSaving(false));
            }}
          >
            <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando..." : "Salvar Venda"}
          </Button>
        </DialogFooter>

        <MachineFeesDialog open={feesOpen} onClose={() => setFeesOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function MachineFeesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, updateSettings } = useStore();
  const [fees, setFees] = useState<MachineFees>({});
  useEffect(() => {
    if (open) {
      const fromSettings = state.settings.cardMachineFees ?? {};
      const initial = Object.keys(fromSettings).length > 0 ? fromSettings : loadMachineFees();
      setFees(initial);
    }
  }, [open, state.settings.cardMachineFees]);

  function setFee(brand: string, parcela: number, value: unknown) {
    setFees((prev) => ({
      ...prev,
      [brand]: { ...(prev[brand] || {}), [parcela]: Math.max(0, toNum(value)) },
    }));
  }

  // Brands sem parcelamento
  const noInstallment = (brand: string) =>
    brand === "DÉBITO" || brand === "PIX" || brand === "DINHEIRO";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Taxas de maquininha
          </DialogTitle>
          <DialogDescription>
            Configure a taxa (%) por bandeira e por parcela. Salvo nas configurações da loja (aba
            Taxas).
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-2 py-2 font-medium">Parcelas</th>
                {MACHINE_BRANDS.map((b) => (
                  <th key={b} className="text-left px-2 py-2 font-medium">
                    {b}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((parcela) => (
                <tr key={parcela} className="border-t border-border">
                  <td className="px-2 py-2 text-muted-foreground font-medium">{parcela}x</td>
                  {MACHINE_BRANDS.map((b) => {
                    if (parcela > 1 && noInstallment(b)) {
                      return (
                        <td key={b} className="px-2 py-2 text-muted-foreground text-center">
                          —
                        </td>
                      );
                    }
                    const val = toNum(fees[b]?.[parcela]);
                    return (
                      <td key={b} className="px-2 py-2">
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={val}
                            onChange={(e) => setFee(b, parcela, e.target.value)}
                            className="h-8 pr-7 text-sm"
                            placeholder="0"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            %
                          </span>
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
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            onClick={async () => {
              saveMachineFees(fees);
              await updateSettings({ cardMachineFees: fees });
              toast.success("Taxas salvas!");
              onClose();
            }}
          >
            <Save className="mr-2 h-4 w-4" /> Salvar Taxas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  icon: Icon,
  iconTone = "muted",
  children,
}: {
  label: string;
  icon?: any;
  iconTone?: "primary" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5">
        {Icon ? (
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              iconTone === "primary" ? "text-primary" : "text-muted-foreground",
            )}
          />
        ) : null}
        <span>{label}</span>
      </Label>
      {children}
    </div>
  );
}

function MotoboyDialog({
  order,
  onClose,
  buildText,
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
    if (!newLabel.trim()) {
      toast.error("Dê um nome ao contato");
      return;
    }
    if (phone.length < 10) {
      toast.error("Número inválido");
      return;
    }
    const list = [...contacts, { label: newLabel.trim(), phone }];
    setContacts(list);
    saveContacts(list);
    setNewLabel("");
    setNewPhone("");
  }

  function removeContact(i: number) {
    const list = contacts.filter((_, idx) => idx !== i);
    setContacts(list);
    saveContacts(list);
  }

  function send(phone: string) {
    window.open(whatsappLink(phone, text), "_blank");
    onClose();
  }

  return (
    <Dialog open={!!order} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar para o motoboy</DialogTitle>
          <DialogDescription>
            Escolha um contato salvo ou cadastre um novo (grupo ou número).
          </DialogDescription>
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
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.label}</div>
                    <div className="text-xs text-muted-foreground">{c.phone}</div>
                  </div>
                  <Button size="sm" onClick={() => send(c.phone)}>
                    Enviar
                  </Button>
                  <button
                    onClick={() => removeContact(i)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border p-3">
            <Label className="text-xs">Adicionar novo contato</Label>
            <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input
                placeholder="Nome (ex: Motoboy João, Grupo Entregas)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
              <Input
                placeholder="DDD + número"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                inputMode="numeric"
              />
              <Button variant="outline" onClick={addContact}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Para enviar a um grupo do WhatsApp, use o número de um administrador ou crie um
              contato com o link do grupo (o WhatsApp só aceita envio direto a números — para
              grupos, abra o grupo e cole a mensagem manualmente).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
