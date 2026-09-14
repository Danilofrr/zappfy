export type ShippingLabelItem = {
  name: string;
  qty: number;
};

export type ShippingLabelOrder = {
  id: string;
  customer: string;
  phone?: string | null;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  total: number;
  date?: string | null;
  notes?: string | null;
  paymentLabel?: string | null;
  items: ShippingLabelItem[];
  courierName?: string | null;
  scheduledFor?: string | null;
};

export type ShippingLabelOptions = {
  storeName: string;
  logoUrl?: string | null;
  orders: ShippingLabelOrder[];
  autoPrint?: boolean;
};

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] || char,
  );
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value || 0));
}

function shortOrderNumber(id: string) {
  return String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase() || "PEDIDO";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("pt-BR");
}

function noteValue(notes: string | null | undefined, pattern: RegExp) {
  if (!notes) return "";
  const line = notes.split(/\r?\n/).find((entry) => pattern.test(entry));
  if (!line) return "";
  return line.replace(pattern, "").replace(/\*/g, "").trim();
}

function cleanNotes(notes?: string | null) {
  if (!notes) return "";
  return notes
    .split(/\r?\n/)
    .filter(
      (line) =>
        line.trim() &&
        !/^\s*\*?\s*(CEP|Ponto de refer[êe]ncia|CPF|CPF\/CNPJ|E-?mail)\s*:/i.test(line),
    )
    .join("\n")
    .trim();
}

function labelPage(order: ShippingLabelOrder, storeName: string, logoUrl?: string | null) {
  const cep = noteValue(order.notes, /^\s*\*?\s*CEP\s*:?\s*\*?\s*/i);
  const reference = noteValue(
    order.notes,
    /^\s*\*?\s*Ponto de refer[êe]ncia\s*:?\s*\*?\s*/i,
  );
  const notes = cleanNotes(order.notes);
  const orderNo = shortOrderNumber(order.id);
  const quantity = (order.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const manyItems = (order.items || []).length > 5;
  const items = (order.items || [])
    .map(
      (item) => `
        <div class="item-row">
          <span class="item-qty">${Number(item.qty || 0)}x</span>
          <span class="item-name">${escapeHtml(item.name)}</span>
        </div>`,
    )
    .join("");

  return `
    <article class="label-page${manyItems ? " many-items" : ""}">
      <header class="label-header">
        <div class="store-brand">
          ${
            logoUrl
              ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(storeName)}" />`
              : `<div class="store-name">${escapeHtml(storeName)}</div>`
          }
        </div>
        <div class="order-code">
          <span>PEDIDO</span>
          <strong>#${escapeHtml(orderNo)}</strong>
          ${order.date ? `<small>${escapeHtml(formatDate(order.date))}</small>` : ""}
        </div>
      </header>

      <section class="destination">
        <div class="section-kicker">DESTINATÁRIO</div>
        <div class="customer">${escapeHtml(order.customer)}</div>
        ${order.phone ? `<div class="phone">Tel: ${escapeHtml(order.phone)}</div>` : ""}
        <div class="address-main">${escapeHtml(order.address || "Endereço não informado")}</div>
        <div class="address-secondary">
          ${order.district ? `<strong>Bairro:</strong> ${escapeHtml(order.district)}` : ""}
          ${order.district && order.city ? " · " : ""}
          ${order.city ? `<strong>Cidade:</strong> ${escapeHtml(order.city)}` : ""}
        </div>
        ${cep ? `<div class="cep"><strong>CEP:</strong> ${escapeHtml(cep)}</div>` : ""}
        ${reference ? `<div class="reference"><strong>Referência:</strong> ${escapeHtml(reference)}</div>` : ""}
      </section>

      <section class="items-block">
        <div class="section-title">
          <span>CONTEÚDO DO PEDIDO</span>
          <strong>${quantity} ${quantity === 1 ? "item" : "itens"}</strong>
        </div>
        <div class="items-list">${items || '<div class="empty">Sem itens informados</div>'}</div>
      </section>

      <section class="payment-grid">
        <div>
          <span class="mini-label">PAGAMENTO</span>
          <strong>${escapeHtml(order.paymentLabel || "Não informado")}</strong>
        </div>
        <div class="total-box">
          <span class="mini-label">TOTAL</span>
          <strong>${escapeHtml(money(order.total))}</strong>
        </div>
      </section>

      <section class="operation-grid">
        <div>
          <span class="mini-label">MOTOBOY</span>
          <strong>${escapeHtml(order.courierName || "Não atribuído")}</strong>
        </div>
        <div>
          <span class="mini-label">ENTREGA PROGRAMADA</span>
          <strong>${escapeHtml(formatDate(order.scheduledFor) || "Hoje / conforme rota")}</strong>
        </div>
      </section>

      ${
        notes
          ? `<section class="notes"><span class="mini-label">OBSERVAÇÕES</span><div>${escapeHtml(notes).replace(/\n/g, "<br/>")}</div></section>`
          : ""
      }

      <section class="receiver">
        <div><span>Recebido por</span><i></i></div>
        <div><span>Assinatura</span><i></i></div>
      </section>

      <footer class="label-footer">
        <strong>${escapeHtml(storeName)}</strong>
        <span>Etiqueta de entrega · 10 × 15 cm</span>
        <b>#${escapeHtml(orderNo)}</b>
      </footer>
    </article>`;
}

export function openShippingLabels({
  storeName,
  logoUrl,
  orders,
  autoPrint = true,
}: ShippingLabelOptions) {
  if (typeof window === "undefined" || orders.length === 0) return false;

  const popup = window.open("", "_blank", "width=650,height=920");
  if (!popup) return false;

  const pages = orders.map((order) => labelPage(order, storeName || "Loja", logoUrl)).join("");
  const title = orders.length === 1 ? `Etiqueta #${shortOrderNumber(orders[0].id)}` : `${orders.length} etiquetas`;

  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; color: #050505; }
    body { background: #e8e8e8; padding: 16px 0 40px; }
    .print-toolbar { position: sticky; top: 0; z-index: 50; width: 100mm; margin: 0 auto 12px; padding: 10px; display: flex; gap: 8px; background: #111; border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.2); }
    .print-toolbar button { flex: 1; min-height: 42px; border: 0; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; }
    .print-toolbar .primary { background: #13d94a; color: #061108; }
    .print-toolbar .secondary { background: #fff; color: #111; }
    .print-help { width: 100mm; margin: -4px auto 12px; text-align: center; font-size: 11px; color: #555; }

    .label-page { width: 100mm; height: 150mm; margin: 0 auto 14px; padding: 4mm; background: #fff; border: 1px solid #bbb; overflow: hidden; display: flex; flex-direction: column; break-after: page; page-break-after: always; }
    .label-page:last-child { break-after: auto; page-break-after: auto; }
    .label-header { min-height: 20mm; display: flex; align-items: center; justify-content: space-between; gap: 4mm; padding-bottom: 2.5mm; border-bottom: 1.2mm solid #000; }
    .store-brand { flex: 1; min-width: 0; display: flex; align-items: center; }
    .store-brand img { max-width: 47mm; max-height: 16mm; object-fit: contain; object-position: left center; }
    .store-name { font-size: 18pt; font-weight: 900; line-height: 1; text-transform: uppercase; }
    .order-code { min-width: 31mm; text-align: right; line-height: 1.05; }
    .order-code span { display: block; font-size: 7.5pt; font-weight: 800; letter-spacing: .8px; }
    .order-code strong { display: block; font-size: 17pt; font-family: 'Courier New', monospace; letter-spacing: .4px; }
    .order-code small { display: block; margin-top: 1mm; font-size: 7.5pt; }

    .section-kicker, .mini-label { display: block; font-size: 7pt; line-height: 1; font-weight: 900; letter-spacing: .7px; color: #333; }
    .destination { padding: 3mm 0; border-bottom: .7mm solid #000; }
    .customer { margin-top: 1.2mm; font-size: 15pt; font-weight: 900; line-height: 1.05; text-transform: uppercase; }
    .phone { margin-top: 1mm; font-size: 8.5pt; font-weight: 700; }
    .address-main { margin-top: 2mm; font-size: 12pt; font-weight: 900; line-height: 1.15; }
    .address-secondary, .cep, .reference { margin-top: 1mm; font-size: 8.5pt; line-height: 1.2; }
    .reference { padding: 1mm 1.5mm; background: #f0f0f0; border-left: 1mm solid #000; }

    .items-block { padding: 2.5mm 0; border-bottom: .7mm solid #000; }
    .section-title { display: flex; align-items: center; justify-content: space-between; gap: 2mm; font-size: 7pt; font-weight: 900; letter-spacing: .5px; }
    .section-title strong { font-size: 8pt; white-space: nowrap; }
    .items-list { margin-top: 1.5mm; display: grid; gap: .8mm; }
    .item-row { display: grid; grid-template-columns: 10mm 1fr; gap: 1mm; align-items: start; font-size: 9pt; line-height: 1.15; }
    .item-qty { font-weight: 900; }
    .item-name { font-weight: 700; }
    .many-items .item-row { font-size: 7.5pt; line-height: 1.05; }
    .many-items .items-list { gap: .45mm; }
    .empty { font-size: 8pt; color: #555; }

    .payment-grid, .operation-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: .55mm solid #000; }
    .payment-grid > div, .operation-grid > div { min-height: 13mm; padding: 2mm 1.5mm; }
    .payment-grid > div + div, .operation-grid > div + div { border-left: .45mm solid #000; }
    .payment-grid strong, .operation-grid strong { display: block; margin-top: 1.2mm; font-size: 9pt; line-height: 1.15; }
    .payment-grid .total-box strong { font-size: 13pt; }

    .notes { padding: 1.8mm 0; border-bottom: .45mm solid #000; font-size: 7.5pt; line-height: 1.15; }
    .notes div { margin-top: 1mm; }
    .receiver { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; padding: 2mm 0; margin-top: auto; }
    .receiver div { display: flex; align-items: flex-end; gap: 2mm; font-size: 7pt; font-weight: 800; }
    .receiver i { flex: 1; height: 5mm; border-bottom: .4mm solid #000; }
    .label-footer { min-height: 9mm; border-top: .8mm solid #000; padding-top: 1.5mm; display: grid; grid-template-columns: 1fr auto; align-items: center; column-gap: 2mm; }
    .label-footer strong { font-size: 8pt; text-transform: uppercase; }
    .label-footer span { grid-column: 1; font-size: 6.5pt; color: #555; }
    .label-footer b { grid-column: 2; grid-row: 1 / span 2; font-size: 10pt; font-family: 'Courier New', monospace; }

    @page { size: 100mm 150mm; margin: 0; }
    @media print {
      html, body { width: 100mm; margin: 0 !important; padding: 0 !important; background: #fff; }
      .print-toolbar, .print-help { display: none !important; }
      .label-page { width: 100mm; height: 150mm; margin: 0; border: 0; padding: 4mm; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <button class="primary" onclick="window.print()">Imprimir / Salvar PDF</button>
    <button class="secondary" onclick="window.close()">Fechar</button>
  </div>
  <div class="print-help">Formato térmico 10 × 15 cm · 1 etiqueta por página · ${orders.length} ${orders.length === 1 ? "etiqueta" : "etiquetas"}</div>
  ${pages}
  <script>
    (function(){
      if (!${autoPrint ? "true" : "false"}) return;
      var images = Array.prototype.slice.call(document.images || []);
      Promise.all(images.map(function(img){
        if (img.complete) return Promise.resolve();
        return new Promise(function(resolve){ img.onload = img.onerror = resolve; });
      })).then(function(){ setTimeout(function(){ window.print(); }, 250); });
    })();
  </script>
</body>
</html>`);
  popup.document.close();
  return true;
}
