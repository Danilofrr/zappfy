import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import {
  Bike,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock3,
  MapPin,
  Package,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useActiveStore } from "@/lib/active-store";
import { useStore, type Order } from "@/lib/store";
import { brl } from "@/lib/format";
import type { DeliveryAssignment } from "@/lib/delivery-load";

type Courier = { id: string; name: string; active: boolean };
type ScheduledEntry = { order: Order; assignment: DeliveryAssignment };
type DateFilter = "all" | "tomorrow" | "week" | "custom";

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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
  const date = new Date();
  date.setDate(date.getDate() + days);
  return deliveryDateKey(date);
}

function formatScheduledDate(value: string | null | undefined) {
  if (!value) return "";
  if (value === deliveryDateKey()) return "Hoje";
  if (value === deliveryDatePlusDays(1)) return "Amanhã";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatGroupDate(value: string) {
  if (value === deliveryDatePlusDays(1)) return "Amanhã";
  if (value === deliveryDatePlusDays(5)) return "Daqui a 5 dias";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function setNativeDateValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function PedidosSchedulingEnhancer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { state } = useStore();
  const { activeStoreId } = useActiveStore();
  const [assignments, setAssignments] = useState<DeliveryAssignment[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [tabHost, setTabHost] = useState<HTMLElement | null>(null);
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDate, setCustomDate] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ScheduledEntry | null>(null);
  const [editCourier, setEditCourier] = useState("");
  const [editDate, setEditDate] = useState("");
  const [saving, setSaving] = useState(false);

  const isPedidos = pathname === "/pedidos";

  const loadAssignments = useCallback(async () => {
    if (!activeStoreId || !isPedidos) return;
    const [{ data: assignmentData, error: assignmentError }, { data: courierData, error: courierError }] =
      await Promise.all([
        (supabase as any).rpc("list_order_assignments", { _store_id: activeStoreId }),
        (supabase as any).rpc("list_couriers_for_store", { _store_id: activeStoreId }),
      ]);

    if (!assignmentError) setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
    if (!courierError) {
      setCouriers((Array.isArray(courierData) ? courierData : []).filter((courier: Courier) => courier.active));
    }
  }, [activeStoreId, isPedidos]);

  useEffect(() => {
    if (!isPedidos || !activeStoreId) return;
    void loadAssignments();
    const channel = supabase
      .channel(`pedidos_agendados_enhancer_${activeStoreId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_tracking",
          filter: `store_id=eq.${activeStoreId}`,
        },
        () => void loadAssignments(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStoreId, isPedidos, loadAssignments]);

  const scheduledEntries = useMemo<ScheduledEntry[]>(() => {
    if (!isPedidos) return [];
    const today = deliveryDateKey();
    const orderById = new Map(state.orders.map((order) => [order.id, order]));
    const finalStatuses = new Set(["entregue", "devolvido", "cancelado"]);

    return assignments
      .filter(
        (assignment) =>
          Boolean(assignment.scheduled_for && assignment.scheduled_for > today) &&
          !finalStatuses.has(String(assignment.status || "").toLowerCase()) &&
          Boolean(assignment.courier_id),
      )
      .map((assignment) => ({ order: orderById.get(assignment.order_id), assignment }))
      .filter((entry): entry is ScheduledEntry => Boolean(entry.order))
      .sort((a, b) => {
        const byDate = String(a.assignment.scheduled_for).localeCompare(String(b.assignment.scheduled_for));
        if (byDate !== 0) return byDate;
        return new Date(b.order.date).getTime() - new Date(a.order.date).getTime();
      });
  }, [assignments, isPedidos, state.orders]);

  const visibleScheduled = useMemo(() => {
    const q = normalizeText(search);
    const tomorrow = deliveryDatePlusDays(1);
    const weekEnd = deliveryDatePlusDays(7);

    return scheduledEntries.filter(({ order, assignment }) => {
      const scheduled = assignment.scheduled_for || "";
      if (dateFilter === "tomorrow" && scheduled !== tomorrow) return false;
      if (dateFilter === "week" && (scheduled < tomorrow || scheduled > weekEnd)) return false;
      if (dateFilter === "custom" && (!customDate || scheduled !== customDate)) return false;
      if (!q) return true;
      return normalizeText(
        `${order.customer} ${order.phone} ${order.address} ${order.district} ${order.city} ${order.items
          .map((item) => item.name)
          .join(" ")} ${assignment.courier_name || ""}`,
      ).includes(q);
    });
  }, [customDate, dateFilter, scheduledEntries, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ScheduledEntry[]>();
    for (const entry of visibleScheduled) {
      const key = entry.assignment.scheduled_for || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visibleScheduled]);

  useEffect(() => {
    if (!isPedidos) {
      setScheduledOpen(false);
      setTabHost(null);
      setPanelHost(null);
      return;
    }

    let observer: MutationObserver | null = null;
    let raf = 0;

    const enhanceAssignmentDialog = () => {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>("[role='dialog']"));
      const dialog = dialogs.find((item) => normalizeText(item.textContent).includes("dia planejado da entrega"));
      if (!dialog) return;

      const title = Array.from(dialog.querySelectorAll<HTMLElement>("h2, [data-slot='dialog-title']")).find((item) =>
        normalizeText(item.textContent).includes("atribuir ao motoboy"),
      );
      if (title && title.textContent !== "Atribuir e agendar entrega") title.textContent = "Atribuir e agendar entrega";

      const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"));
      const todayButton = buttons.find((button) => normalizeText(button.textContent) === "hoje");
      const tomorrowButton = buttons.find((button) => normalizeText(button.textContent) === "amanha");
      const quickGrid = tomorrowButton?.parentElement as HTMLElement | null;
      if (!quickGrid || !todayButton || !tomorrowButton) return;

      quickGrid.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";
      let fiveButton = quickGrid.querySelector<HTMLButtonElement>("[data-zappfy-five-days]");
      if (!fiveButton) {
        fiveButton = document.createElement("button");
        fiveButton.type = "button";
        fiveButton.dataset.zappfyFiveDays = "1";
        fiveButton.textContent = "+5 dias";
        fiveButton.className =
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2";
        fiveButton.addEventListener("click", () => {
          const input = dialog.querySelector<HTMLInputElement>("input[type='date']");
          if (input) setNativeDateValue(input, deliveryDatePlusDays(5));
        });
        quickGrid.appendChild(fiveButton);
      }
    };

    const scan = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const candidates = Array.from(document.querySelectorAll<HTMLElement>("main div.flex.flex-wrap.gap-2"));
        const statusRow = candidates.find((row) => {
          const directButtons = Array.from(row.children).filter(
            (child): child is HTMLButtonElement => child instanceof HTMLButtonElement,
          );
          const labels = directButtons.map((button) => normalizeText(button.textContent));
          return labels.includes("todos") && labels.includes("aguardando pagamento") && labels.includes("pago");
        });

        if (statusRow) {
          let nextTabHost = statusRow.querySelector<HTMLElement>("[data-zappfy-scheduled-tab-host]");
          if (!nextTabHost) {
            nextTabHost = document.createElement("span");
            nextTabHost.dataset.zappfyScheduledTabHost = "1";
            nextTabHost.style.display = "contents";
            statusRow.appendChild(nextTabHost);
          }
          setTabHost((current) => (current === nextTabHost ? current : nextTabHost));

          const parent = statusRow.parentElement;
          if (parent) {
            let nextPanelHost = parent.querySelector<HTMLElement>(":scope > [data-zappfy-scheduled-panel-host]");
            if (!nextPanelHost) {
              nextPanelHost = document.createElement("div");
              nextPanelHost.dataset.zappfyScheduledPanelHost = "1";
              statusRow.insertAdjacentElement("afterend", nextPanelHost);
            }
            setPanelHost((current) => (current === nextPanelHost ? current : nextPanelHost));
          }

          if (!statusRow.dataset.zappfyScheduledClickBound) {
            statusRow.dataset.zappfyScheduledClickBound = "1";
            statusRow.addEventListener("click", (event) => {
              const target = event.target as Node | null;
              const host = statusRow.querySelector("[data-zappfy-scheduled-tab-host]");
              if (target && host?.contains(target)) return;
              setScheduledOpen(false);
            });
          }
        }

        enhanceAssignmentDialog();
      });
    };

    observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    scan();

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(raf);
      document.querySelectorAll("[data-zappfy-scheduled-tab-host], [data-zappfy-scheduled-panel-host]").forEach((node) =>
        node.remove(),
      );
    };
  }, [isPedidos]);

  useEffect(() => {
    const statusRow = tabHost?.parentElement;
    const parent = statusRow?.parentElement;
    if (!statusRow || !parent || !panelHost) return;

    const originalButtons = Array.from(statusRow.children).filter(
      (child): child is HTMLButtonElement =>
        child instanceof HTMLButtonElement && !child.closest("[data-zappfy-scheduled-tab-host]"),
    );

    const siblings = Array.from(parent.children) as HTMLElement[];
    const rowIndex = siblings.indexOf(statusRow);

    const restore = () => {
      for (const sibling of siblings) {
        if (!sibling.dataset.zappfyScheduledHidden) continue;
        const previous = sibling.dataset.zappfyPreviousDisplay;
        sibling.style.display = previous === "__empty__" ? "" : previous || "";
        delete sibling.dataset.zappfyScheduledHidden;
        delete sibling.dataset.zappfyPreviousDisplay;
      }
      for (const button of originalButtons) {
        if (button.dataset.zappfyPreviousOpacity !== undefined) {
          button.style.opacity = button.dataset.zappfyPreviousOpacity;
          delete button.dataset.zappfyPreviousOpacity;
        }
      }
    };

    restore();

    if (scheduledOpen) {
      originalButtons.forEach((button) => {
        button.dataset.zappfyPreviousOpacity = button.style.opacity || "";
        button.style.opacity = "0.58";
      });
      for (let index = rowIndex + 1; index < siblings.length; index += 1) {
        const sibling = siblings[index];
        if (sibling === panelHost) continue;
        sibling.dataset.zappfyPreviousDisplay = sibling.style.display || "__empty__";
        sibling.dataset.zappfyScheduledHidden = "1";
        sibling.style.display = "none";
      }
    }

    panelHost.style.display = scheduledOpen ? "block" : "none";
    return restore;
  }, [panelHost, scheduledOpen, tabHost]);

  function openReschedule(entry: ScheduledEntry) {
    setEditing(entry);
    setEditCourier(entry.assignment.courier_id || "");
    setEditDate(entry.assignment.scheduled_for || deliveryDatePlusDays(1));
  }

  async function saveReschedule() {
    if (!editing || !activeStoreId || !editCourier || !editDate) return;
    if (editDate < deliveryDateKey()) {
      toast.error("Escolha hoje ou uma data futura");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("assign_orders_to_courier_scheduled", {
      _store_id: activeStoreId,
      _order_ids: [editing.order.id],
      _courier_id: editCourier,
      _scheduled_for: editDate,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Entrega reagendada para ${formatScheduledDate(editDate)}`);
    setEditing(null);
    await loadAssignments();
  }

  if (!isPedidos) return null;

  const tab = tabHost
    ? createPortal(
        <button
          type="button"
          onClick={() => setScheduledOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
            scheduledOpen
              ? "border-primary bg-primary/15 text-primary"
              : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
          }`}
          title="Ver entregas programadas para datas futuras"
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Agendadas
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
            {scheduledEntries.length}
          </span>
        </button>,
        tabHost,
      )
    : null;

  const panel = panelHost
    ? createPortal(
        <div className="mb-6 mt-1 space-y-4">
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 lg:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-base font-bold">
                  <CalendarClock className="h-5 w-5 text-primary" /> Entregas agendadas
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pedidos programados para dias futuros. As datas mais próximas aparecem primeiro.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadAssignments()}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Atualizar
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" variant={dateFilter === "all" ? "default" : "outline"} onClick={() => setDateFilter("all")}>
                Todas ({scheduledEntries.length})
              </Button>
              <Button
                size="sm"
                variant={dateFilter === "tomorrow" ? "default" : "outline"}
                onClick={() => setDateFilter("tomorrow")}
              >
                Amanhã
              </Button>
              <Button size="sm" variant={dateFilter === "week" ? "default" : "outline"} onClick={() => setDateFilter("week")}>
                Próximos 7 dias
              </Button>
              <Button size="sm" variant={dateFilter === "custom" ? "default" : "outline"} onClick={() => setDateFilter("custom")}>
                Escolher dia
              </Button>
              {dateFilter === "custom" && (
                <Input
                  type="date"
                  min={deliveryDatePlusDays(1)}
                  value={customDate}
                  onChange={(event) => setCustomDate(event.target.value)}
                  className="h-9 w-auto"
                />
              )}
              <div className="relative min-w-[220px] flex-1 lg:ml-auto lg:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar cliente, produto ou motoboy..."
                  className="h-9 pl-9"
                />
              </div>
            </div>
          </div>

          {grouped.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div className="mt-4 font-bold">Nenhuma entrega agendada</div>
              <div className="mt-1 max-w-md text-sm text-muted-foreground">
                Selecione um ou mais pedidos, clique em “Atribuir ao motoboy” e escolha Amanhã, +5 dias ou uma data personalizada.
              </div>
            </div>
          ) : (
            grouped.map(([date, entries]) => (
              <section key={date} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/25 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold capitalize">{formatGroupDate(date)}</div>
                      <div className="text-[11px] text-muted-foreground">{new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")}</div>
                    </div>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">
                    {entries.length} {entries.length === 1 ? "pedido" : "pedidos"}
                  </span>
                </div>

                <div className="divide-y divide-border">
                  {entries.map(({ order, assignment }) => (
                    <div key={assignment.id} className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="truncate text-sm">{order.customer}</strong>
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-500">
                            Agendada
                          </span>
                        </div>
                        <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{[order.address, order.district, order.city].filter(Boolean).join(", ") || "Endereço não informado"}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" /> {order.items.map((item) => `${item.qty}x ${item.name}`).join(", ")}</span>
                          <strong className="text-foreground">{brl(order.total)}</strong>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                        <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2">
                          <Bike className="h-4 w-4 text-primary" />
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Motoboy</div>
                            <div className="truncate text-xs font-semibold">{assignment.courier_name || "Não atribuído"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                          <Clock3 className="h-4 w-4 text-primary" />
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Entrega</div>
                            <div className="text-xs font-bold text-primary">{formatScheduledDate(assignment.scheduled_for)}</div>
                          </div>
                        </div>
                      </div>

                      <Button variant="outline" className="w-full lg:w-auto" onClick={() => openReschedule({ order, assignment })}>
                        Reagendar <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}

          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.025] p-4 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Para criar um novo agendamento: volte para <b className="text-foreground">Todos</b>, marque o pedido, clique em <b className="text-foreground">Atribuir ao motoboy</b> e escolha a data. O mesmo agendamento aparece automaticamente na Central de Entregas do motoboy.
              </span>
            </div>
          </div>
        </div>,
        panelHost,
      )
    : null;

  return (
    <>
      {tab}
      {panel}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar entrega</DialogTitle>
            <DialogDescription>
              Altere o dia da entrega de {editing?.order.customer}. Você também pode trocar o motoboy antes da saída.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Motoboy</Label>
              <Select value={editCourier} onValueChange={setEditCourier}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o motoboy" />
                </SelectTrigger>
                <SelectContent>
                  {couriers.map((courier) => (
                    <SelectItem key={courier.id} value={courier.id}>
                      {courier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Dia planejado da entrega</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Button type="button" variant={editDate === deliveryDateKey() ? "default" : "outline"} onClick={() => setEditDate(deliveryDateKey())}>
                  Hoje
                </Button>
                <Button type="button" variant={editDate === deliveryDatePlusDays(1) ? "default" : "outline"} onClick={() => setEditDate(deliveryDatePlusDays(1))}>
                  Amanhã
                </Button>
                <Button type="button" variant={editDate === deliveryDatePlusDays(5) ? "default" : "outline"} onClick={() => setEditDate(deliveryDatePlusDays(5))}>
                  +5 dias
                </Button>
              </div>
              <Input type="date" min={deliveryDateKey()} value={editDate} onChange={(event) => setEditDate(event.target.value)} className="mt-3" />
              {editDate && (
                <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Nova data: </span>
                  <b className="text-primary">{formatScheduledDate(editDate)}</b>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={saving || !editCourier || !editDate} onClick={() => void saveReschedule()}>
              {saving ? "Salvando..." : "Salvar agendamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
