from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


# ---------- Orders ----------
p = Path("src/routes/_authenticated/pedidos.tsx")
s = p.read_text()

helper_anchor = "function PedidosPage() {"
helpers = '''function deliveryDateKey(date = new Date()) {
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

function PedidosPage() {'''
s = replace_once(s, helper_anchor, helpers, "orders helpers")

s = replace_once(
    s,
    '  const [targetCourier, setTargetCourier] = useState("");\n  const [courierFilter, setCourierFilter] = useState("all");',
    '  const [targetCourier, setTargetCourier] = useState("");\n  const [assignmentDate, setAssignmentDate] = useState(() => deliveryDateKey());\n  const [courierFilter, setCourierFilter] = useState("all");',
    "assignment date state",
)

s = replace_once(
    s,
    '  async function assignSelected() {\n    if (!activeStoreId || !targetCourier || selected.size === 0) return;',
    '  async function assignSelected() {\n    if (!activeStoreId || !targetCourier || selected.size === 0) return;\n    if (!assignmentDate || assignmentDate < deliveryDateKey()) {\n      toast.error("Escolha hoje ou uma data futura para a entrega");\n      return;\n    }',
    "assignment validation",
)

s = replace_once(
    s,
    '    const { error } = await (supabase as any).rpc("assign_orders_to_courier", {\n      _store_id: activeStoreId,\n      _order_ids: [...selected],\n      _courier_id: targetCourier,\n    });',
    '    const { error } = await (supabase as any).rpc("assign_orders_to_courier_scheduled", {\n      _store_id: activeStoreId,\n      _order_ids: [...selected],\n      _courier_id: targetCourier,\n      _scheduled_for: assignmentDate,\n    });',
    "scheduled assignment rpc",
)

s = replace_once(
    s,
    '    toast.success(`${selected.size} pedido(s) atribuído(s) a ${target?.name}`);',
    '    toast.success(`${selected.size} pedido(s) atribuído(s) a ${target?.name} para ${formatScheduledDeliveryDate(assignmentDate)}`);',
    "scheduled assignment toast",
)

count = s.count('onClick={() => setAssignOpen(true)}')
if count != 1:
    raise SystemExit(f"assignment dialog opener: expected 1 match, found {count}")
s = s.replace(
    'onClick={() => setAssignOpen(true)}',
    'onClick={() => { setAssignmentDate(deliveryDateKey()); setAssignOpen(true); }}',
    1,
)

mobile_old = '''                    <div className="mt-1 text-xs">
                      <Bike className="mr-1 inline h-3.5 w-3.5" />
                      {assignmentByOrder.get(o.id)?.courier_name || "Não atribuído"}
                    </div>'''
mobile_new = '''                    <div className="mt-1 text-xs">
                      <Bike className="mr-1 inline h-3.5 w-3.5" />
                      {assignmentByOrder.get(o.id)?.courier_name || "Não atribuído"}
                      {assignmentByOrder.get(o.id)?.scheduled_for && (
                        <span className="ml-2 inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                          <CalendarIcon className="mr-1 h-3 w-3" />
                          Entrega: {formatScheduledDeliveryDate(assignmentByOrder.get(o.id)?.scheduled_for)}
                        </span>
                      )}
                    </div>'''
s = replace_once(s, mobile_old, mobile_new, "mobile assignment date")

desktop_old = '''                          <td className="px-2 py-3 truncate text-xs">
                            {assignmentByOrder.get(o.id)?.courier_name || "Não atribuído"}
                          </td>'''
desktop_new = '''                          <td className="px-2 py-3 text-xs">
                            <div className="truncate">{assignmentByOrder.get(o.id)?.courier_name || "Não atribuído"}</div>
                            {assignmentByOrder.get(o.id)?.scheduled_for && (
                              <div className="mt-0.5 truncate text-[10px] font-medium text-primary">
                                {formatScheduledDeliveryDate(assignmentByOrder.get(o.id)?.scheduled_for)}
                              </div>
                            )}
                          </td>'''
s = replace_once(s, desktop_old, desktop_new, "desktop assignment date")

dialog_old = '''      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir ao motoboy</DialogTitle>
            <DialogDescription>
              Os pedidos entrarão imediatamente na carga do motoboy selecionado.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={!targetCourier} onClick={assignSelected}>
              Confirmar atribuição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>'''
dialog_new = '''      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
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
      </Dialog>'''
s = replace_once(s, dialog_old, dialog_new, "assignment dialog")
p.write_text(s)

# ---------- Delivery assignment type ----------
p = Path("src/lib/delivery-load.ts")
s = p.read_text()
s = replace_once(
    s,
    '  assigned_at: string | null;\n};',
    '  assigned_at: string | null;\n  scheduled_for: string | null;\n};',
    "delivery assignment scheduled_for type",
)
p.write_text(s)

# ---------- Courier Central ----------
p = Path("src/routes/entregas-zappfy.$storeSlug.index.tsx")
s = p.read_text()
s = replace_once(s, '  Bike,\n  CheckCircle2,', '  Bike,\n  CalendarDays,\n  CheckCircle2,', "central calendar import")
s = replace_once(
    s,
    '  status: string;\n  accepted_at: string | null;',
    '  status: string;\n  scheduled_for: string | null;\n  accepted_at: string | null;',
    "central delivery scheduled_for type",
)

central_anchor = 'function CentralPage() {'
central_helpers = '''function brazilDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatCentralScheduledDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function CentralPage() {'''
s = replace_once(s, central_anchor, central_helpers, "central date helpers")

summary_old = '''  const summary = [
    [
      "Para entregar",
      available.filter((d) => ["aguardando_motoboy", "preparando"].includes(d.status)).length,
    ],'''
summary_new = '''  const todayKey = brazilDateKey();
  const summary = [
    [
      "Para entregar",
      available.filter(
        (d) =>
          ["aguardando_motoboy", "preparando"].includes(d.status) &&
          (!d.scheduled_for || d.scheduled_for <= todayKey),
      ).length,
    ],
    [
      "Agendadas",
      available.filter(
        (d) =>
          ["aguardando_motoboy", "preparando"].includes(d.status) &&
          Boolean(d.scheduled_for && d.scheduled_for > todayKey),
      ).length,
    ],'''
s = replace_once(s, summary_old, summary_new, "central summary schedule")

decision_old = '''                const awaitingDecision =
                  !d.accepted_at && ["aguardando_motoboy", "preparando"].includes(d.status);'''
decision_new = '''                const isScheduledForFuture = Boolean(d.scheduled_for && d.scheduled_for > todayKey);
                const awaitingDecision =
                  !isScheduledForFuture &&
                  !d.accepted_at &&
                  ["aguardando_motoboy", "preparando"].includes(d.status);'''
s = replace_once(s, decision_old, decision_new, "central future decision")

address_anchor = '''                    <div className="flex items-start gap-2 text-sm">
                      <MapPin'''
schedule_banner = '''                    {d.scheduled_for && (
                      <div
                        className="rounded-lg border px-3 py-2 text-xs"
                        style={{
                          borderColor: isScheduledForFuture ? `${theme.button_color}88` : theme.card_border_color,
                          background: isScheduledForFuture ? `${theme.button_color}14` : `${theme.card_border_color}22`,
                        }}
                      >
                        <div className="flex items-center gap-2 font-semibold" style={{ color: isScheduledForFuture ? theme.button_color : theme.title_color }}>
                          <CalendarDays className="h-4 w-4" />
                          {isScheduledForFuture
                            ? `Agendada para ${formatCentralScheduledDate(d.scheduled_for)}`
                            : "Entrega programada para hoje"}
                        </div>
                        {isScheduledForFuture && (
                          <div className="mt-1 opacity-70">O botão Aceitar será liberado no dia programado.</div>
                        )}
                      </div>
                    )}

                    <div className="flex items-start gap-2 text-sm">
                      <MapPin'''
s = replace_once(s, address_anchor, schedule_banner, "central schedule banner")

s = replace_once(
    s,
    'awaitingDecision ? "col-span-2" : ""',
    'awaitingDecision || isScheduledForFuture ? "col-span-2" : ""',
    "central phone span",
)

action_anchor = '''                      {awaitingDecision && (
                        <>'''
future_actions = '''                      {isScheduledForFuture && !d.accepted_at && ["aguardando_motoboy", "preparando"].includes(d.status) && (
                        <>
                          <Button
                            disabled={busy}
                            variant="destructive"
                            onClick={() => action(d, "reject")}
                            className="h-11"
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Recusar
                          </Button>
                          <Button disabled variant="outline" className="h-11">
                            <CalendarDays className="mr-1 h-4 w-4" />
                            {formatCentralScheduledDate(d.scheduled_for)}
                          </Button>
                        </>
                      )}

                      {awaitingDecision && (
                        <>'''
s = replace_once(s, action_anchor, future_actions, "central future actions")
p.write_text(s)

# Ensure list_my_delivery_load keeps created_at for the UI's relative-time label.
p = Path("supabase/migrations/20260913210000_schedule_courier_deliveries.sql")
s = p.read_text()
s = replace_once(
    s,
    "        'scheduled_for', t.scheduled_for,\n        'assigned_at', t.assigned_at,",
    "        'scheduled_for', t.scheduled_for,\n        'created_at', t.created_at,\n        'assigned_at', t.assigned_at,",
    "migration created_at payload",
)
p.write_text(s)
