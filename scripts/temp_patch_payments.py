from pathlib import Path

# PEDIDOS
path = Path("src/routes/_authenticated/pedidos.tsx")
text = path.read_text()

if 'from "@/lib/order-payments"' not in text:
    marker = '} from "@/lib/order-financials";\n'
    if marker not in text:
        raise SystemExit("pedidos import marker not found")
    text = text.replace(marker, marker + 'import {\n  attachPaymentBreakdownToItems,\n  buildPaymentBreakdown,\n  formatPaymentBreakdown,\n  normalizePaymentBreakdown,\n  paymentMethodLabel,\n} from "@/lib/order-payments";\n', 1)

text = text.replace('pagamento: o.payment.toUpperCase(),', 'pagamento: formatPaymentBreakdown(o),')
text = text.replace('{String(o.payment ?? "").toUpperCase()}', '{formatPaymentBreakdown(o)}')
text = text.replace('${htmlEscape(paymentLabels[o.payment] || o.payment)}</td></tr>', '${htmlEscape(formatPaymentBreakdown(o))}</td></tr>')

edit_scope = text.split('function NewOrderDialog', 1)[0]
if 'const [secondPayment, setSecondPayment] = useState<string>("none");' not in edit_scope:
    marker = '  const [orderDate, setOrderDate] = useState<Date | undefined>(undefined);\n'
    if marker not in text:
        raise SystemExit("edit state marker not found")
    text = text.replace(marker, marker + '  const [secondPayment, setSecondPayment] = useState<string>("none");\n  const [secondPaymentValue, setSecondPaymentValue] = useState<number>(0);\n', 1)

text = text.replace('        payment: order.payment as any,', '        payment: (normalizePaymentBreakdown(order)[0]?.method || order.payment) as any,', 1)

edit_load_marker = '      setOrderDate(order.date ? new Date(order.date) : new Date());\n'
edit_load_insert = '''      setOrderDate(order.date ? new Date(order.date) : new Date());
      const paymentParts = normalizePaymentBreakdown(order);
      const secondPart = paymentParts.length > 1 ? paymentParts[1] : null;
      setSecondPayment(secondPart?.method || "none");
      setSecondPaymentValue(secondPart?.amount || 0);
'''
if 'const secondPart = paymentParts.length > 1 ? paymentParts[1] : null;' not in text:
    if edit_load_marker not in text:
        raise SystemExit("edit load marker not found")
    text = text.replace(edit_load_marker, edit_load_insert, 1)

edit_total_marker = '            <div className="grid grid-cols-2 gap-3">\n              <Field label={`Total (R$)${totalEdited ? " — manual" : ""}`}>\n'
if 'Pagamento dividido (opcional)' not in text.split('function Chip', 1)[0]:
    if edit_total_marker not in text:
        raise SystemExit("edit total marker not found")
    split_ui = '''            <div className="rounded-lg border border-border/60 bg-secondary/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <Wallet className="h-3.5 w-3.5" /> Pagamento dividido (opcional)
              </div>
              <div className="grid grid-cols-[1fr_150px] gap-2">
                <Field label="2ª FORMA">
                  <Select value={secondPayment} onValueChange={setSecondPayment}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <Input type="number" min={0} step="0.01" value={secondPaymentValue} disabled={secondPayment === "none"} onChange={(e) => setSecondPaymentValue(Math.max(0, Number(e.target.value) || 0))} />
                </Field>
              </div>
              {secondPayment !== "none" && secondPaymentValue > 0 && (
                <div className="text-xs text-muted-foreground">
                  {paymentMethodLabel(form.payment)}: <b className="text-foreground">{brl(Math.max(0, total - secondPaymentValue))}</b> · {paymentMethodLabel(secondPayment)}: <b className="text-foreground">{brl(secondPaymentValue)}</b>
                </div>
              )}
            </div>

'''
    text = text.replace(edit_total_marker, split_ui + edit_total_marker, 1)

edit_save_marker = '              // Recalcula metadados da taxa do cartão se aplicável.\n'
if 'A segunda forma de pagamento deve ser diferente da primeira.' not in text:
    validation = '''              if (secondPayment !== "none") {
                if (secondPayment === form.payment) {
                  toast.error("A segunda forma de pagamento deve ser diferente da primeira.");
                  return;
                }
                if (secondPaymentValue <= 0 || secondPaymentValue >= total) {
                  toast.error("No pagamento dividido, informe um valor da 2ª parte maior que zero e menor que o total.");
                  return;
                }
              }
'''
    if edit_save_marker not in text:
        raise SystemExit("edit save marker not found")
    text = text.replace(edit_save_marker, validation + edit_save_marker, 1)

edit_patch_marker = '              const patch: any = { ...form, items: nextItems, total };\n'
if 'const paymentBreakdown = buildPaymentBreakdown(' not in text.split('function Chip', 1)[0]:
    attach = '''              const paymentBreakdown = buildPaymentBreakdown(
                form.payment,
                total,
                secondPayment,
                secondPaymentValue,
              );
              nextItems = attachPaymentBreakdownToItems(nextItems, paymentBreakdown);
'''
    if edit_patch_marker not in text:
        raise SystemExit("edit patch marker not found")
    text = text.replace(edit_patch_marker, attach + edit_patch_marker, 1)

text = text.replace('payment: "pix" as "pix" | "cartao" | "dinheiro",', 'payment: "pix" as "pix" | "cartao" | "debito" | "dinheiro",', 1)

fees_button_marker = '''              <button
                type="button"
                onClick={() => setFeesOpen(true)}
'''
if 'A 1ª forma recebe automaticamente o restante do total.' not in text:
    split_summary = '''              {secondPayment !== "none" && secondPaymentValue > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs">
                  <div className="font-semibold text-foreground mb-1">Divisão do pagamento</div>
                  <div className="flex justify-between"><span>{paymentMethodLabel(form.payment)}</span><b>{brl(Math.max(0, total - secondPaymentValue))}</b></div>
                  <div className="flex justify-between"><span>{paymentMethodLabel(secondPayment)}</span><b>{brl(secondPaymentValue)}</b></div>
                  <div className="mt-1 text-[10px] text-muted-foreground">A 1ª forma recebe automaticamente o restante do total.</div>
                </div>
              )}

'''
    if fees_button_marker not in text:
        raise SystemExit("new split summary marker not found")
    text = text.replace(fees_button_marker, split_summary + fees_button_marker, 1)

new_raw_marker = '              const rawItems = lines.map((l) => {\n'
if 'No pagamento dividido, o valor da 2ª parte precisa ser maior que zero e menor que o total.' not in text:
    validation = '''              if (secondPayment !== "none") {
                if (secondPayment === form.payment) {
                  toast.error("Escolha uma forma diferente para o segundo pagamento.");
                  return;
                }
                if (secondPaymentValue <= 0 || secondPaymentValue >= total) {
                  toast.error("No pagamento dividido, o valor da 2ª parte precisa ser maior que zero e menor que o total.");
                  return;
                }
              }
'''
    if new_raw_marker not in text:
        raise SystemExit("new payment validation marker not found")
    text = text.replace(new_raw_marker, validation + new_raw_marker, 1)

text = text.replace('              const items = attachFeeMetaToItems(rawItems as any[], feeMeta);', '              let items = attachFeeMetaToItems(rawItems as any[], feeMeta);', 1)
new_items_marker = '              let items = attachFeeMetaToItems(rawItems as any[], feeMeta);\n'
if 'items = attachPaymentBreakdownToItems(items, buildPaymentBreakdown(' not in text:
    add = '''              items = attachPaymentBreakdownToItems(items, buildPaymentBreakdown(
                form.payment,
                total,
                secondPayment,
                secondPaymentValue,
              ));
'''
    if new_items_marker not in text:
        raise SystemExit("new items marker not found")
    text = text.replace(new_items_marker, new_items_marker + add, 1)

path.write_text(text)

# MOTOBOYS
path = Path("src/routes/_authenticated/motoboys.tsx")
text = path.read_text()
if 'from "@/lib/order-payments"' not in text:
    marker = 'import { brl } from "@/lib/format";\n'
    if marker not in text:
        raise SystemExit("motoboys import marker not found")
    text = text.replace(marker, marker + 'import { formatPaymentBreakdown, sumPaymentBreakdowns } from "@/lib/order-payments";\n', 1)

payment_total_marker = '                const mobileValue = mobileStock.reduce((sum, item) => sum + Number(item.sale_value || 0), 0);\n'
if 'const paymentTotals = sumPaymentBreakdowns(' not in text:
    addition = '''                const paymentTotals = sumPaymentBreakdowns(
                  (history?.deliveredOrders || []).map((delivery: any) => delivery.order || {}),
                );
'''
    if payment_total_marker not in text:
        raise SystemExit("motoboys totals marker not found")
    text = text.replace(payment_total_marker, payment_total_marker + addition, 1)

clients_marker = '                      {(history?.deliveredOrders.length ?? 0) > 0 && (\n'
if 'Valores recebidos nas entregas' not in text:
    totals_ui = '''                      {(history?.deliveredOrders.length ?? 0) > 0 && (
                        <div className="mt-4 rounded-xl border bg-background/30 p-3">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Valores recebidos nas entregas</div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground">Dinheiro</div><div className="text-xs font-bold text-foreground">{brl(paymentTotals.dinheiro)}</div></div>
                            <div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground">PIX</div><div className="text-xs font-bold text-foreground">{brl(paymentTotals.pix)}</div></div>
                            <div className="rounded-lg border p-2"><div className="text-[10px] text-muted-foreground">Cartão</div><div className="text-xs font-bold text-foreground">{brl(paymentTotals.cartao)}</div></div>
                          </div>
                        </div>
                      )}

'''
    if clients_marker not in text:
        raise SystemExit("motoboys clients marker not found")
    text = text.replace(clients_marker, totals_ui + clients_marker, 1)

client_order_marker = '<div className="text-[10px] text-muted-foreground">Pedido #{String(delivery.order?.id || delivery.order_id || "").slice(0, 8)}</div>'
if 'font-medium text-primary">{formatPaymentBreakdown(delivery.order)}' not in text:
    if client_order_marker not in text:
        raise SystemExit("motoboys client order marker not found")
    text = text.replace(client_order_marker, client_order_marker + '<div className="mt-0.5 text-[10px] font-medium text-primary">{formatPaymentBreakdown(delivery.order)}</div>', 1)

modal_marker = '<div className="mt-1">{delivery.order.district} · {brl(Number(delivery.order.total))}</div>'
if 'Pagamento: {formatPaymentBreakdown(delivery.order)}' not in text:
    text = text.replace(modal_marker, modal_marker + '<div className="mt-1 font-medium text-primary">Pagamento: {formatPaymentBreakdown(delivery.order)}</div>')

path.write_text(text)

# CENTRAL DE ENTREGAS
path = Path("src/routes/entregas-zappfy.$storeSlug.index.tsx")
text = path.read_text()
if 'from "@/lib/order-payments"' not in text:
    marker = 'import { formatRelative, orderShortNumber } from "@/lib/tracking";\n'
    if marker not in text:
        raise SystemExit("central import marker not found")
    text = text.replace(marker, marker + 'import { brl } from "@/lib/format";\nimport { normalizePaymentBreakdown, paymentMethodLabel } from "@/lib/order-payments";\n', 1)

busy_marker = '                const busy = busyTrackingCode === d.tracking_code;\n'
if 'const paymentParts = normalizePaymentBreakdown(d.order);' not in text:
    if busy_marker not in text:
        raise SystemExit("central busy marker not found")
    text = text.replace(busy_marker, busy_marker + '                const paymentParts = normalizePaymentBreakdown(d.order);\n', 1)

old_payment = '''                        {Number(d.order.total).toFixed(2)} ·{" "}
                        {String(d.order.payment || "").toUpperCase()}
'''
if old_payment in text:
    text = text.replace(old_payment, '                        {Number(d.order.total).toFixed(2)}\n', 1)

if 'Pagamento do cliente' not in text:
    payment_panel = '''                    <div className="rounded-lg border p-3 text-xs space-y-1.5" style={{ borderColor: `${theme.button_color}55`, background: `${theme.button_color}10` }}>
                      <div className="font-semibold" style={{ color: theme.title_color }}>Pagamento do cliente</div>
                      {paymentParts.map((part, index) => (
                        <div key={`${part.method}-${index}`} className="flex items-center justify-between gap-3">
                          <span>{paymentMethodLabel(part.method)}</span>
                          <strong style={{ color: theme.title_color }}>{brl(part.amount)}</strong>
                        </div>
                      ))}
                      <div className="flex items-center justify-between gap-3 border-t pt-1.5 font-semibold" style={{ borderColor: theme.card_border_color }}>
                        <span>Total do pedido</span><span>{brl(d.order.total)}</span>
                      </div>
                    </div>

'''
    product_anchor = '                    <div className="grid grid-cols-2 gap-2">\n'
    product_pos = text.find(product_anchor, text.find('{(d.order.items || []).map'))
    if product_pos < 0:
        raise SystemExit("central payment panel marker not found")
    text = text[:product_pos] + payment_panel + text[product_pos:]

path.write_text(text)

# ENTREGA INDIVIDUAL
path = Path("src/routes/entrega.$courierToken.tsx")
text = path.read_text()
if 'from "@/lib/order-payments"' not in text:
    marker = 'import { toast } from "sonner";\n'
    if marker not in text:
        raise SystemExit("courier import marker not found")
    text = text.replace(marker, marker + 'import { brl } from "@/lib/format";\nimport { normalizePaymentBreakdown, paymentMethodLabel } from "@/lib/order-payments";\n', 1)

soft_marker = '  const soft = `${t.primary_color}22`;\n'
if 'const paymentParts = normalizePaymentBreakdown(data.order);' not in text:
    if soft_marker not in text:
        raise SystemExit("courier soft marker not found")
    text = text.replace(soft_marker, soft_marker + '  const paymentParts = normalizePaymentBreakdown(data.order);\n', 1)

unfinished_marker = '        {!isFinished && (\n'
if 'Forma de pagamento' not in text:
    panel = '''        <section className="rounded-2xl p-4 space-y-2" style={cardStyle}>
          <div className="text-xs uppercase tracking-wider opacity-60">Forma de pagamento</div>
          {paymentParts.map((part, index) => (
            <div key={`${part.method}-${index}`} className="flex items-center justify-between gap-3 text-sm">
              <span>{paymentMethodLabel(part.method)}</span>
              <strong style={{ color: t.title_color }}>{brl(part.amount)}</strong>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3 border-t pt-2 text-sm font-semibold" style={{ borderColor: t.card_border_color }}>
            <span>Total</span><span style={{ color: t.primary_color }}>{brl(data.order.total)}</span>
          </div>
        </section>

'''
    if unfinished_marker not in text:
        raise SystemExit("courier payment panel marker not found")
    text = text.replace(unfinished_marker, panel + unfinished_marker, 1)

path.write_text(text)
