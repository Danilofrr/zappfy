import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  PackageCheck,
  PackagePlus,
  Search,
  Send,
  Tag,
  Truck,
  XCircle,
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

type ShippingStatus = "pendente_etiqueta" | "etiqueta_gerada" | "pronto_postagem" | "postado";
type ShippingMeta = {
  id: string;
  shipping_queue: boolean;
  shipping_carrier: string | null;
  shipping_status: ShippingStatus | null;
  shipping_due_date: string | null;
  shipping_added_at: string | null;
  shipping_label_at: string | null;
  shipping_posted_at: string | null;
  shipping_tracking_code: string | null;
};
type QueueEntry = { order: Order; meta: ShippingMeta };
type QueueFilter = "today" | "pending" | "label" | "posted" | "all";

const carrierLabels: Record<string, string> = {
  correios: "Correios",
  jadlog: "Jadlog",
  loggi: "Loggi",
  outro: "Outro",
};

const statusLabels: Record<ShippingStatus, string> = {
  pendente_etiqueta: "Gerar etiqueta",
  etiqueta_gerada: "Etiqueta gerada",
  pronto_postagem: "Pronto para postar",
  postado: "Postado",
};

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  if (value === dateKey()) return "Hoje";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function shortOrderId(id: string) {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function PedidosMelhorEnvioEnhancer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { state } = useStore();
  const { activeStoreId } = useActiveStore();
  const isPedidos = pathname === "/pedidos";

  const [shippingRows, setShippingRows] = useState<ShippingMeta[]>([]);
  const [tabHost, setTabHost] = useState<HTMLElement | null>(null);
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<QueueFilter>("today");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateSelected, setCandidateSelected] = useState<Set<string>>(new Set());
  const [candidateCarrier, setCandidateCarrier] = useState("correios");
  const [candidateDate, setCandidateDate] = useState(() => dateKey());
  const [saving, setSaving] = useState(false);

  const loadShippingRows = useCallback(async () => {
    if (!activeStoreId || !isPedidos) return;
    const { data, error } = await (supabase as any)
      .from("orders")
      .select(
        "id,shipping_queue,shipping_carrier,shipping_status,shipping_due_date,shipping_added_at,shipping_label_at,shipping_posted_at,shipping_tracking_code",
      )
      .eq("store_id", activeStoreId);
    if (error) {
      console.error("[Melhor Envio] erro ao carregar fila", error);
      return;
    }
    setShippingRows(Array.isArray(data) ? data : []);
  }, [activeStoreId, isPedidos]);

  useEffect(() => {
    if (!activeStoreId || !isPedidos) return;
    void loadShippingRows();
    const channel = supabase
      .channel(`pedidos_melhor_envio_${activeStoreId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${activeStoreId}` },
        () => void loadShippingRows(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStoreId, isPedidos, loadShippingRows]);

  const shippingByOrder = useMemo(
    () => new Map(shippingRows.map((row) => [row.id, row])),
    [shippingRows],
  );

  const queueEntries = useMemo<QueueEntry[]>(() => {
    return state.orders
      .map((order) => ({ order, meta: shippingByOrder.get(order.id) }))
      .filter((entry): entry is QueueEntry => Boolean(entry.meta?.shipping_queue))
      .sort((a, b) => {
        const dateA = a.meta.shipping_due_date || "9999-12-31";
        const dateB = b.meta.shipping_due_date || "9999-12-31";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return new Date(b.order.date).getTime() - new Date(a.order.date).getTime();
      });
  }, [shippingByOrder, state.orders]);

  const today = dateKey();
  const todayOpenCount = queueEntries.filter(
    ({ meta }) => meta.shipping_due_date === today && meta.shipping_status !== "postado",
  ).length;
  const pendingLabelCount = queueEntries.filter(({ meta }) => meta.shipping_status === "pendente_etiqueta").length;
  const labelReadyCount = queueEntries.filter(
    ({ meta }) => meta.shipping_status === "etiqueta_gerada" || meta.shipping_status === "pronto_postagem",
  ).length;
  const postedCount = queueEntries.filter(({ meta }) => meta.shipping_status === "postado").length;

  const visibleEntries = useMemo(() => {
    const q = normalizeText(search);
    return queueEntries.filter(({ order, meta }) => {
      if (filter === "today" && meta.shipping_due_date !== today) return false;
      if (filter === "pending" && meta.shipping_status !== "pendente_etiqueta") return false;
      if (
        filter === "label" &&
        meta.shipping_status !== "etiqueta_gerada" &&
        meta.shipping_status !== "pronto_postagem"
      )
        return false;
      if (filter === "posted" && meta.shipping_status !== "postado") return false;
      if (!q) return true;
      return normalizeText(
        `${order.customer} ${order.phone} ${order.address} ${order.district} ${order.city} ${order.items
          .map((item) => item.name)
          .join(" ")} ${meta.shipping_tracking_code || ""} ${carrierLabels[meta.shipping_carrier || ""] || ""}`,
      ).includes(q);
    });
  }, [filter, queueEntries, search, today]);

  const addCandidates = useMemo(() => {
    const q = normalizeText(candidateSearch);
    return state.orders
      .filter((order) => order.status !== "cancelado" && !shippingByOrder.get(order.id)?.shipping_queue)
      .filter((order) => {
        if (!q) return true;
        return normalizeText(
          `${order.customer} ${order.phone} ${order.address} ${order.district} ${order.city} ${order.items
            .map((item) => item.name)
            .join(" ")}`,
        ).includes(q);
      })
      .slice(0, 100);
  }, [candidateSearch, shippingByOrder, state.orders]);

  useEffect(() => {
    if (!isPedidos) {
      setOpen(false);
      setTabHost(null);
      setPanelHost(null);
      return;
    }

    let observer: MutationObserver | null = null;
    let raf = 0;

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
        if (!statusRow) return;

        let nextTabHost = statusRow.querySelector<HTMLElement>("[data-zappfy-melhor-envio-tab-host]");
        if (!nextTabHost) {
          nextTabHost = document.createElement("span");
          nextTabHost.dataset.zappfyMelhorEnvioTabHost = "1";
          nextTabHost.style.display = "contents";
          statusRow.appendChild(nextTabHost);
        }
        setTabHost((current) => (current === nextTabHost ? current : nextTabHost));

        const parent = statusRow.parentElement;
        if (parent) {
          let nextPanelHost = parent.querySelector<HTMLElement>(":scope > [data-zappfy-melhor-envio-panel-host]");
          if (!nextPanelHost) {
            nextPanelHost = document.createElement("div");
            nextPanelHost.dataset.zappfyMelhorEnvioPanelHost = "1";
            statusRow.insertAdjacentElement("afterend", nextPanelHost);
          }
          setPanelHost((current) => (current === nextPanelHost ? current : nextPanelHost));
        }

        if (!statusRow.dataset.zappfyMelhorEnvioClickBound) {
          statusRow.dataset.zappfyMelhorEnvioClickBound = "1";
          statusRow.addEventListener("click", (event) => {
            const target = event.target as Node | null;
            const host = statusRow.querySelector("[data-zappfy-melhor-envio-tab-host]");
            if (target && host?.contains(target)) return;
            setOpen(false);
          });
        }
      });
    };

    observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });
    scan();

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(raf);
      document
        .querySelectorAll("[data-zappfy-melhor-envio-tab-host], [data-zappfy-melhor-envio-panel-host]")
        .forEach((node) => node.remove());
    };
  }, [isPedidos]);

  useEffect(() => {
    const statusRow = tabHost?.parentElement;
    const parent = statusRow?.parentElement;
    if (!statusRow || !parent || !panelHost) return;

    const originalButtons = Array.from(statusRow.children).filter(
      (child): child is HTMLButtonElement => child instanceof HTMLButtonElement,
    );
    const siblings = Array.from(parent.children) as HTMLElement[];
    const rowIndex = siblings.indexOf(statusRow);

    const restore = () => {
      for (const sibling of siblings) {
        if (!sibling.dataset.zappfyMelhorEnvioHidden) continue;
        const previous = sibling.dataset.zappfyMelhorEnvioPreviousDisplay;
        sibling.style.display = previous === "__empty__" ? "" : previous || "";
        delete sibling.dataset.zappfyMelhorEnvioHidden;
        delete sibling.dataset.zappfyMelhorEnvioPreviousDisplay;
      }
      for (const button of originalButtons) {
        if (button.dataset.zappfyMelhorEnvioPreviousOpacity !== undefined) {
          button.style.opacity = button.dataset.zappfyMelhorEnvioPreviousOpacity;
          delete button.dataset.zappfyMelhorEnvioPreviousOpacity;
        }
      }
    };

    restore();
    if (open) {
      originalButtons.forEach((button) => {
        button.dataset.zappfyMelhorEnvioPreviousOpacity = button.style.opacity || "";
        button.style.opacity = "0.58";
      });
      for (let index = rowIndex + 1; index < siblings.length; index += 1) {
        const sibling = siblings[index];
        if (sibling === panelHost) continue;
        sibling.dataset.zappfyMelhorEnvioPreviousDisplay = sibling.style.display || "__empty__";
        sibling.dataset.zappfyMelhorEnvioHidden = "1";
        sibling.style.display = "none";
      }
    }
    panelHost.style.display = open ? "block" : "none";
    return restore;
  }, [open, panelHost, tabHost]);

  async function addToQueue() {
    if (!activeStoreId || candidateSelected.size === 0) return;
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await (supabase as any)
      .from("orders")
      .update({
        shipping_queue: true,
        shipping_carrier: candidateCarrier,
        shipping_status: "pendente_etiqueta",
        shipping_due_date: candidateDate || today,
        shipping_added_at: now,
        shipping_label_at: null,
        shipping_posted_at: null,
        shipping_tracking_code: null,
      })
      .eq("store_id", activeStoreId)
      .in("id", [...candidateSelected]);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${candidateSelected.size} pedido(s) enviado(s) para Melhor Envio`);
    setCandidateSelected(new Set());
    setAddOpen(false);
    await loadShippingRows();
  }

  async function updateShipping(orderId: string, patch: Record<string, unknown>, success?: string) {
    if (!activeStoreId) return;
    const { error } = await (supabase as any)
      .from("orders")
      .update(patch)
      .eq("store_id", activeStoreId)
      .eq("id", orderId);
    if (error) return toast.error(error.message);
    if (success) toast.success(success);
    await loadShippingRows();
  }

  async function advanceStatus(entry: QueueEntry) {
    const current = entry.meta.shipping_status || "pendente_etiqueta";
    const now = new Date().toISOString();
    if (current === "pendente_etiqueta") {
      await updateShipping(
        entry.order.id,
        { shipping_status: "etiqueta_gerada", shipping_label_at: now },
        "Etiqueta marcada como gerada",
      );
      return;
    }
    if (current === "etiqueta_gerada") {
      await updateShipping(entry.order.id, { shipping_status: "pronto_postagem" }, "Pedido pronto para postagem");
      return;
    }
    if (current === "pronto_postagem") {
      await updateShipping(
        entry.order.id,
        { shipping_status: "postado", shipping_posted_at: now },
        "Pedido marcado como postado",
      );
    }
  }

  async function removeFromQueue(orderId: string) {
    await updateShipping(
      orderId,
      {
        shipping_queue: false,
        shipping_carrier: null,
        shipping_status: null,
        shipping_due_date: null,
        shipping_added_at: null,
        shipping_label_at: null,
        shipping_posted_at: null,
        shipping_tracking_code: null,
      },
      "Pedido removido do Melhor Envio",
    );
  }

  const tab = tabHost
    ? createPortal(
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            open
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Truck className="h-3.5 w-3.5" />
          Melhor Envio
          <span className="font-semibold">{todayOpenCount}</span>
        </button>,
        tabHost,
      )
    : null;

  const panel = panelHost
    ? createPortal(
        <div className="mt-4 space-y-4 rounded-2xl border border-border bg-card/70 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-lg font-bold">
                <Truck className="h-5 w-5 text-primary" /> Melhor Envio
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Controle os pedidos que precisam de etiqueta e postagem por Correios, Jadlog, Loggi ou outra transportadora.
              </p>
            </div>
            <Button
              onClick={() => {
                setCandidateDate(today);
                setCandidateCarrier("correios");
                setCandidateSelected(new Set());
                setAddOpen(true);
              }}
            >
              <PackagePlus className="mr-2 h-4 w-4" /> Adicionar pedidos
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Para hoje" value={todayOpenCount} icon={<CalendarDays className="h-4 w-4" />} />
            <StatCard label="Gerar etiqueta" value={pendingLabelCount} icon={<Tag className="h-4 w-4" />} />
            <StatCard label="Etiqueta pronta" value={labelReadyCount} icon={<PackageCheck className="h-4 w-4" />} />
            <StatCard label="Postados" value={postedCount} icon={<CheckCircle2 className="h-4 w-4" />} />
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["today", `Hoje ${todayOpenCount}`],
                  ["pending", `Gerar etiqueta ${pendingLabelCount}`],
                  ["label", `Etiqueta pronta ${labelReadyCount}`],
                  ["posted", `Postados ${postedCount}`],
                  ["all", `Todos ${queueEntries.length}`],
                ] as [QueueFilter, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative w-full xl:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente, produto ou rastreio..."
                className="pl-9"
              />
            </div>
          </div>

          {visibleEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <Truck className="mx-auto h-8 w-8 text-muted-foreground" />
              <div className="mt-3 font-semibold">Nenhum pedido nesta visualização</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Use “Adicionar pedidos” para mandar pedidos para a fila do Melhor Envio.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {visibleEntries.map((entry) => {
                const status = entry.meta.shipping_status || "pendente_etiqueta";
                const nextLabel =
                  status === "pendente_etiqueta"
                    ? "Etiqueta gerada"
                    : status === "etiqueta_gerada"
                      ? "Pronto para postar"
                      : status === "pronto_postagem"
                        ? "Marcar postado"
                        : "Postado";
                return (
                  <div key={entry.order.id} className="rounded-xl border border-border bg-background/60 p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Pedido #{shortOrderId(entry.order.id)}
                          </span>
                          <StatusBadge status={status} />
                          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                            {formatDate(entry.meta.shipping_due_date)}
                          </span>
                        </div>
                        <div className="mt-2 text-base font-bold">{entry.order.customer}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {[entry.order.address, entry.order.district, entry.order.city].filter(Boolean).join(", ")}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{entry.order.items.map((item) => `${item.qty}x ${item.name}`).join(" · ")}</span>
                          <span>•</span>
                          <span className="font-semibold text-foreground">{brl(entry.order.total)}</span>
                        </div>
                      </div>

                      <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:w-[520px]">
                        <div>
                          <Label className="mb-1 block text-[11px] text-muted-foreground">Transportadora</Label>
                          <Select
                            value={entry.meta.shipping_carrier || "correios"}
                            onValueChange={(value) =>
                              void updateShipping(entry.order.id, { shipping_carrier: value }, "Transportadora atualizada")
                            }
                          >
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="correios">Correios</SelectItem>
                              <SelectItem value="jadlog">Jadlog</SelectItem>
                              <SelectItem value="loggi">Loggi</SelectItem>
                              <SelectItem value="outro">Outra</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="mb-1 block text-[11px] text-muted-foreground">Código de rastreio</Label>
                          <Input
                            defaultValue={entry.meta.shipping_tracking_code || ""}
                            placeholder="Opcional"
                            className="h-9"
                            onBlur={(event) => {
                              const value = event.target.value.trim() || null;
                              if (value === (entry.meta.shipping_tracking_code || null)) return;
                              void updateShipping(entry.order.id, { shipping_tracking_code: value }, "Rastreio salvo");
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                      <div className="text-xs text-muted-foreground">
                        {carrierLabels[entry.meta.shipping_carrier || ""] || "Transportadora não definida"} · {statusLabels[status]}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void removeFromQueue(entry.order.id)}
                        >
                          <XCircle className="mr-1.5 h-4 w-4" /> Remover
                        </Button>
                        <Button
                          size="sm"
                          disabled={status === "postado"}
                          onClick={() => void advanceStatus(entry)}
                        >
                          {status === "pronto_postagem" ? (
                            <Send className="mr-1.5 h-4 w-4" />
                          ) : status === "postado" ? (
                            <CheckCircle2 className="mr-1.5 h-4 w-4" />
                          ) : (
                            <PackageCheck className="mr-1.5 h-4 w-4" />
                          )}
                          {nextLabel}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>,
        panelHost,
      )
    : null;

  return (
    <>
      {tab}
      {panel}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Mandar pedidos para Melhor Envio</DialogTitle>
            <DialogDescription>
              Selecione os pedidos que precisam de etiqueta e defina a data prevista de postagem.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Transportadora</Label>
                <Select value={candidateCarrier} onValueChange={setCandidateCarrier}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correios">Correios</SelectItem>
                    <SelectItem value="jadlog">Jadlog</SelectItem>
                    <SelectItem value="loggi">Loggi</SelectItem>
                    <SelectItem value="outro">Outra / definir depois</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de postagem</Label>
                <Input
                  type="date"
                  className="mt-1.5"
                  min={today}
                  value={candidateDate}
                  onChange={(event) => setCandidateDate(event.target.value)}
                />
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={candidateSearch}
                onChange={(event) => setCandidateSearch(event.target.value)}
                placeholder="Buscar por cliente, endereço ou produto..."
                className="pl-9"
              />
            </div>

            <div className="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
              {addCandidates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Nenhum pedido disponível para adicionar.
                </div>
              ) : (
                addCandidates.map((order) => {
                  const checked = candidateSelected.has(order.id);
                  return (
                    <label
                      key={order.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                        checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setCandidateSelected((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(order.id);
                            else next.delete(order.id);
                            return next;
                          });
                        }}
                        className="mt-1 h-4 w-4 accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{order.customer}</span>
                          <span className="text-[11px] text-muted-foreground">#{shortOrderId(order.id)}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {[order.address, order.district, order.city].filter(Boolean).join(", ")}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {order.items.map((item) => `${item.qty}x ${item.name}`).join(" · ")} · {brl(order.total)}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button disabled={candidateSelected.size === 0 || saving} onClick={() => void addToQueue()}>
              <Truck className="mr-2 h-4 w-4" />
              {saving ? "Enviando..." : `Enviar ${candidateSelected.size || ""} para Melhor Envio`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ShippingStatus }) {
  const classes =
    status === "pendente_etiqueta"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
      : status === "etiqueta_gerada"
        ? "border-blue-500/30 bg-blue-500/10 text-blue-500"
        : status === "pronto_postagem"
          ? "border-violet-500/30 bg-violet-500/10 text-violet-500"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-500";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classes}`}>
      {status === "pendente_etiqueta" && <Clock3 className="mr-1 h-3 w-3" />}
      {statusLabels[status]}
    </span>
  );
}
