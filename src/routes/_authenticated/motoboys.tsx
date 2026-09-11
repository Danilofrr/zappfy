import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Bike,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  History,
  KeyRound,
  Loader2,
  Package,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  Power,
  QrCode,
  RefreshCw,
  RotateCcw,
  Route as RouteIcon,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { useActiveStore } from "@/lib/active-store";
import type { CourierLoad } from "@/lib/delivery-load";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/motoboys")({
  component: MotoboysPage,
});

type Courier = {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string | null;
  plate: string | null;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
};

type PeriodKey = "today" | "yesterday" | "7d" | "30d" | "custom";

type CourierHistory = {
  raw: any;
  deliveredOrders: any[];
  deliveredProducts: number;
  failed: number;
  returned: number;
  transportedValue: number;
  eventsInPeriod: any[];
};

const VEHICLES = [
  { v: "moto", l: "Moto" },
  { v: "carro", l: "Carro" },
  { v: "bike", l: "Bike" },
  { v: "a-pe", l: "A pé" },
];

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "yesterday", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "custom", label: "Personalizado" },
];

const EVENT_LABELS: Record<string, string> = {
  assigned: "Pedido atribuído",
  transferred: "Pedido transferido",
  accepted: "Entrega aceita",
  started: "Entrega iniciada",
  delivered: "Pedido entregue",
  delivery_failed: "Não entregue",
  return_started: "Retornando para a loja",
  returned: "Devolvido à loja",
};

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const normalizeCourierPhone = (value: string) => {
  const digits = normalizePhone(value);
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
};

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const endOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
};

const getPeriodRange = (period: PeriodKey, customFrom: string, customTo: string) => {
  const now = new Date();
  let start = startOfDay(now);
  let end = endOfDay(now);

  if (period === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    start = startOfDay(yesterday);
    end = endOfDay(yesterday);
  } else if (period === "7d") {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  } else if (period === "30d") {
    start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
  } else if (period === "custom") {
    const from = customFrom ? startOfDay(new Date(`${customFrom}T00:00:00`)) : start;
    const to = customTo ? endOfDay(new Date(`${customTo}T00:00:00`)) : end;
    start = from <= to ? from : startOfDay(to);
    end = from <= to ? to : endOfDay(from);
  }

  return { start, end };
};

const isWithin = (value: string | null | undefined, start: Date, end: Date) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= start.getTime() && time <= end.getTime();
};

const totalItems = (items: any[] | null | undefined) =>
  (items || []).reduce((total, item) => total + Number(item?.qty ?? item?.quantity ?? 0), 0);

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    aguardando_motoboy: "Aguardando motoboy",
    saiu_para_entrega: "Em rota",
    entregue: "Entregue",
    nao_entregue: "Não entregue",
    retornando: "Retornando",
    devolvido: "Devolvido à loja",
    cancelado: "Cancelado",
  };
  return labels[status] || status.replaceAll("_", " ");
};

function MotoboysPage() {
  const { activeStoreId, activeStore } = useActiveStore();
  const [list, setList] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Courier | null>(null);
  const [resetting, setResetting] = useState<Courier | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    vehicle_type: "moto",
    plate: "",
    active: true,
  });
  const [saving, setSaving] = useState(false);
  const [loads, setLoads] = useState<CourierLoad[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [detailCourier, setDetailCourier] = useState<Courier | null>(null);
  const [activeTab, setActiveTab] = useState("load");
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [customFrom, setCustomFrom] = useState(() => toDateInput(new Date()));
  const [customTo, setCustomTo] = useState(() => toDateInput(new Date()));
  const [historyByCourier, setHistoryByCourier] = useState<Record<string, CourierHistory>>({});
  const [historyLoading, setHistoryLoading] = useState(false);

  const centralUrl =
    typeof window !== "undefined" && activeStore?.slug
      ? `${window.location.origin}/entregas-zappfy/${encodeURIComponent(activeStore.slug)}`
      : "";

  const range = useMemo(
    () => getPeriodRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  const periodLabel = useMemo(() => {
    if (period === "today") return "Hoje";
    if (period === "yesterday") return "Ontem";
    if (period === "7d") return "Últimos 7 dias";
    if (period === "30d") return "Últimos 30 dias";
    return `${range.start.toLocaleDateString("pt-BR")} até ${range.end.toLocaleDateString("pt-BR")}`;
  }, [period, range]);

  async function load() {
    if (!activeStoreId) {
      setList([]);
      setLoads([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data, error }, { data: loadData, error: loadError }] = await Promise.all([
      (supabase as any).rpc("list_couriers_for_store", { _store_id: activeStoreId }),
      (supabase as any).rpc("get_courier_loads", { _store_id: activeStoreId }),
    ]);
    if (error) toast.error(error.message);
    if (loadError) toast.error(loadError.message);
    setList((data as Courier[]) || []);
    setLoads(Array.isArray(loadData) ? loadData : []);
    setLoading(false);
  }

  async function loadHistory(couriers = list) {
    if (!activeStoreId || couriers.length === 0) {
      setHistoryByCourier({});
      return;
    }

    setHistoryLoading(true);
    try {
      const results = await Promise.all(
        couriers.map(async (courier) => {
          const { data, error } = await (supabase as any).rpc("get_courier_load_detail", {
            _store_id: activeStoreId,
            _courier_id: courier.id,
          });
          if (error) throw error;

          const orders = Array.isArray(data?.orders) ? data.orders : [];
          const events = Array.isArray(data?.events) ? data.events : [];
          const deliveredOrders = orders.filter(
            (delivery: any) =>
              delivery.status === "entregue" &&
              isWithin(delivery.completed_at, range.start, range.end),
          );
          const eventsInPeriod = events.filter((event: any) =>
            isWithin(event.created_at, range.start, range.end),
          );

          return {
            courierId: courier.id,
            history: {
              raw: data,
              deliveredOrders,
              deliveredProducts: deliveredOrders.reduce(
                (sum: number, delivery: any) => sum + totalItems(delivery.order?.items),
                0,
              ),
              failed: eventsInPeriod.filter((event: any) => event.event_type === "delivery_failed")
                .length,
              returned: eventsInPeriod.filter((event: any) => event.event_type === "returned")
                .length,
              transportedValue: deliveredOrders.reduce(
                (sum: number, delivery: any) => sum + Number(delivery.order?.total || 0),
                0,
              ),
              eventsInPeriod,
            } satisfies CourierHistory,
          };
        }),
      );

      setHistoryByCourier(
        Object.fromEntries(results.map((result) => [result.courierId, result.history])),
      );
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível carregar o histórico dos motoboys");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [activeStoreId]);

  useEffect(() => {
    if (activeTab !== "load" || list.length === 0) return;
    loadHistory(list);
  }, [activeTab, list, period, customFrom, customTo]);

  useEffect(() => {
    if (!activeStoreId) return;
    const channel = supabase
      .channel(`motoboy_loads_${activeStoreId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_tracking",
          filter: `store_id=eq.${activeStoreId}`,
        },
        () => load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_events",
          filter: `store_id=eq.${activeStoreId}`,
        },
        () => {
          if (activeTab === "load") loadHistory();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStoreId, activeTab, list, period, customFrom, customTo]);

  async function openLoad(c: Courier) {
    if (!activeStoreId) return;
    const { data, error } = await (supabase as any).rpc("get_courier_load_detail", {
      _store_id: activeStoreId,
      _courier_id: c.id,
    });
    if (error) return toast.error(error.message);
    setDetail(data);
    setDetailCourier(c);
  }

  function openCreate() {
    setEditing(null);
    setForm({ name: "", phone: "", password: "", vehicle_type: "moto", plate: "", active: true });
    setOpen(true);
  }

  function openEdit(c: Courier) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone,
      password: "",
      vehicle_type: c.vehicle_type || "moto",
      plate: c.plate || "",
      active: c.active,
    });
    setOpen(true);
  }

  async function submit() {
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Nome e WhatsApp obrigatórios");
      return;
    }
    const phone = normalizeCourierPhone(form.phone);
    if (phone.length < 10) {
      toast.error("Informe um WhatsApp válido com DDD");
      return;
    }
    if (!activeStoreId) {
      toast.error("Selecione uma loja ativa");
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await (supabase as any).rpc("update_courier_for_store", {
        _id: editing.id,
        _store_id: activeStoreId,
        _name: form.name.trim(),
        _phone: phone,
        _vehicle: form.vehicle_type,
        _plate: form.plate.trim() || null,
        _active: form.active,
      });
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success("Motoboy atualizado");
    } else {
      if (!form.password || form.password.length < 6) {
        toast.error("Senha do motoboy deve ter ao menos 6 caracteres");
        setSaving(false);
        return;
      }
      const { data: created, error } = await (supabase as any).rpc("create_courier_for_store", {
        _store_id: activeStoreId,
        _name: form.name.trim(),
        _phone: phone,
        _password: form.password,
        _vehicle: form.vehicle_type,
        _plate: form.plate.trim() || null,
        _active: form.active,
      });
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      if (
        !created?.id ||
        created.store_id !== activeStoreId ||
        created.phone !== phone ||
        created.active !== form.active
      ) {
        toast.error(
          "Motoboy salvo com dados inconsistentes. Revise o cadastro antes de usar o login.",
        );
        setSaving(false);
        return;
      }
      toast.success("Motoboy cadastrado com sucesso");
    }
    setSaving(false);
    setOpen(false);
    load();
  }

  async function toggleActive(c: Courier) {
    if (!activeStoreId) return;
    const { error } = await (supabase as any).rpc("update_courier_for_store", {
      _id: c.id,
      _store_id: activeStoreId,
      _name: c.name,
      _phone: c.phone,
      _vehicle: c.vehicle_type || "moto",
      _plate: c.plate || null,
      _active: !c.active,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(c.active ? "Motoboy desativado" : "Motoboy ativado");
    load();
  }

  async function remove(c: Courier) {
    if (!confirm(`Excluir motoboy "${c.name}"?`)) return;
    if (!activeStoreId) return;
    const { error } = await (supabase as any).rpc("delete_courier_for_store", {
      _id: c.id,
      _store_id: activeStoreId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Motoboy excluído");
    load();
  }

  async function confirmReset() {
    if (!resetting) return;
    if (resetPwd.length < 6) {
      toast.error("Senha do motoboy deve ter ao menos 6 caracteres");
      return;
    }
    if (!activeStoreId) return;
    const { error } = await (supabase as any).rpc("reset_courier_password_for_store", {
      _id: resetting.id,
      _store_id: activeStoreId,
      _password: resetPwd,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha redefinida");
    setResetting(null);
    setResetPwd("");
  }

  const detailHistory = detailCourier ? historyByCourier[detailCourier.id] : undefined;
  const activeDetailOrders = (detail?.orders || []).filter(
    (delivery: any) => !["entregue", "devolvido", "cancelado"].includes(delivery.status),
  );
  const modalDeliveredOrders = (detail?.orders || []).filter(
    (delivery: any) =>
      delivery.status === "entregue" && isWithin(delivery.completed_at, range.start, range.end),
  );
  const modalEvents = (detail?.events || []).filter((event: any) =>
    isWithin(event.created_at, range.start, range.end),
  );

  return (
    <AppShell
      title="Motoboys"
      subtitle="Controle de carga, histórico de entregas, acessos e Central de Entregas"
      actions={
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Novo motoboy
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl border bg-card p-2 sm:grid-cols-3">
          <TabsTrigger
            value="load"
            className="h-11 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <PackageCheck className="h-4 w-4" />
            Carga e entregas
          </TabsTrigger>
          <TabsTrigger
            value="access"
            className="h-11 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <Users className="h-4 w-4" />
            Motoboys e acessos
          </TabsTrigger>
          <TabsTrigger
            value="central"
            className="h-11 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <RouteIcon className="h-4 w-4" />
            Central de Entregas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="load" className="space-y-5">
          <section className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <History className="h-5 w-5 text-primary" />
                  Controle de carga e histórico
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Veja a carga atual e confira quantas entregas cada motoboy realizou por período.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  await load();
                  await loadHistory();
                }}
                disabled={loading || historyLoading}
              >
                <RefreshCw className={`mr-1 h-4 w-4 ${loading || historyLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {PERIODS.map((item) => (
                <Button
                  key={item.key}
                  size="sm"
                  variant={period === item.key ? "default" : "outline"}
                  onClick={() => setPeriod(item.key)}
                >
                  <CalendarDays className="mr-1 h-3.5 w-3.5" />
                  {item.label}
                </Button>
              ))}
            </div>

            {period === "custom" && (
              <div className="mt-4 grid gap-3 rounded-xl border bg-background/40 p-4 sm:grid-cols-2 lg:max-w-xl">
                <div>
                  <Label htmlFor="courier-history-from">Data inicial</Label>
                  <Input
                    id="courier-history-from"
                    type="date"
                    value={customFrom}
                    onChange={(event) => setCustomFrom(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="courier-history-to">Data final</Label>
                  <Input
                    id="courier-history-to"
                    type="date"
                    value={customTo}
                    onChange={(event) => setCustomTo(event.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4 text-primary" />
              Período selecionado: <b className="text-foreground">{periodLabel}</b>
              {historyLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </section>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando motoboys…
            </div>
          ) : loads.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma carga de motoboy disponível.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {loads.map((loadItem) => {
                const history = historyByCourier[loadItem.courier_id];
                const courier = list.find((item) => item.id === loadItem.courier_id);
                return (
                  <div
                    key={loadItem.courier_id}
                    className="overflow-hidden rounded-2xl border bg-card transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between gap-3 border-b p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Bike className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-bold">{loadItem.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {courier?.active === false ? "Acesso inativo" : "Motoboy ativo"}
                          </div>
                        </div>
                      </div>
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                        {periodLabel}
                      </span>
                    </div>

                    <div className="p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Carga atual
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border bg-background/40 p-3">
                          <Package className="mb-1 h-4 w-4 text-primary" />
                          <div className="text-xl font-bold">{loadItem.orders_in_possession}</div>
                          <div className="text-xs text-muted-foreground">pedidos em posse</div>
                        </div>
                        <div className="rounded-xl border bg-background/40 p-3">
                          <PackageCheck className="mb-1 h-4 w-4 text-primary" />
                          <div className="text-xl font-bold">{loadItem.products_in_possession}</div>
                          <div className="text-xs text-muted-foreground">produtos em posse</div>
                        </div>
                      </div>

                      <div className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Resultado no período
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span>
                            <b>{history?.deliveredOrders.length ?? 0}</b> entregas
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <PackageCheck className="h-4 w-4 text-primary" />
                          <span>
                            <b>{history?.deliveredProducts ?? 0}</b> produtos
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                          <span>
                            <b>{history?.failed ?? 0}</b> não entregues
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <RotateCcw className="h-4 w-4 text-orange-500" />
                          <span>
                            <b>{history?.returned ?? 0}</b> devoluções
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs text-muted-foreground">Mercadoria em posse</div>
                            <div className="font-semibold text-primary">
                              {brl(Number(loadItem.value_in_possession))}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Entregue no período</div>
                            <div className="font-semibold">
                              {brl(history?.transportedValue ?? 0)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Button
                        className="mt-4 w-full"
                        variant="outline"
                        onClick={() => {
                          const found = list.find((item) => item.id === loadItem.courier_id);
                          if (found) openLoad(found);
                        }}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        Ver carga e histórico
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="access" className="space-y-5">
          <section className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Motoboys e acessos</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Gerencie cadastro, usuário de acesso, senha, veículo e situação de cada motoboy.
                  </p>
                </div>
              </div>
              <Button onClick={openCreate}>
                <Plus className="mr-1 h-4 w-4" /> Cadastrar motoboy
              </Button>
            </div>
          </section>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <Bike className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum motoboy cadastrado ainda.</p>
              <Button className="mt-3" onClick={openCreate}>
                <Plus className="mr-1 h-4 w-4" /> Cadastrar motoboy
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {list.map((courier) => (
                <div key={courier.id} className="rounded-2xl border bg-card p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{courier.name}</h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              courier.active
                                ? "bg-primary/10 text-primary"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {courier.active ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{courier.phone}</span>
                            <span className="text-xs">· usuário de acesso</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Bike className="h-3.5 w-3.5" />
                            <span>
                              {VEHICLES.find((vehicle) => vehicle.v === courier.vehicle_type)?.l || "Moto"}
                              {courier.plate ? ` · ${courier.plate}` : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock3 className="h-3.5 w-3.5" />
                            <span>
                              Último acesso: {courier.last_login_at
                                ? new Date(courier.last_login_at).toLocaleString("pt-BR")
                                : "Ainda não acessou"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => openEdit(courier)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setResetting(courier);
                        setResetPwd("");
                      }}
                    >
                      <KeyRound className="mr-1 h-3.5 w-3.5" /> Senha
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleActive(courier)}>
                      <Power className="mr-1 h-3.5 w-3.5" />
                      {courier.active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => remove(courier)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="central" className="space-y-5">
          <section className="rounded-2xl border border-primary/30 bg-card p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <RouteIcon className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Central de Entregas</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Compartilhe este endereço com os motoboys. O link é gerado pelo domínio atual da Zappfy.
                  </p>
                  <p className="mt-3 break-all rounded-lg border bg-background/50 px-3 py-2 text-sm">
                    {centralUrl || "Cadastre um slug para a loja."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!centralUrl}
                  onClick={() => {
                    navigator.clipboard.writeText(centralUrl);
                    toast.success("Link da Central de Entregas copiado!");
                  }}
                >
                  <Copy className="mr-1 h-4 w-4" /> Copiar link
                </Button>
                <Button
                  disabled={!centralUrl}
                  onClick={() => window.open(centralUrl, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="mr-1 h-4 w-4" /> Abrir Central
                </Button>
              </div>
            </div>

            {centralUrl && (
              <div className="mt-6 grid gap-5 border-t pt-5 md:grid-cols-[auto_1fr] md:items-center">
                <img
                  className="h-52 w-52 rounded-2xl bg-white p-3"
                  alt="QR Code da Central de Entregas"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(centralUrl)}`}
                />
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    <QrCode className="h-5 w-5 text-primary" /> QR Code de acesso
                  </div>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    O motoboy pode escanear o QR Code pelo celular para abrir a Central. A autenticação individual continua obrigatória.
                  </p>
                  <div className="mt-4 flex items-center gap-2 rounded-xl border bg-background/40 p-3 text-sm">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Cada motoboy acessa somente as entregas permitidas para sua conta e loja.
                  </div>
                </div>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar motoboy" : "Novo motoboy"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Atualize os dados do motoboy."
                : "Cadastre um novo motoboy com login próprio."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div>
              <Label>WhatsApp (login) *</Label>
              <Input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="5581999990000"
              />
            </div>
            {!editing && (
              <div>
                <Label>Senha *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder="mínimo 6 caracteres"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Veículo</Label>
                <Select
                  value={form.vehicle_type}
                  onValueChange={(value) => setForm({ ...form, vehicle_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLES.map((vehicle) => (
                      <SelectItem key={vehicle.v} value={vehicle.v}>
                        {vehicle.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Placa</Label>
                <Input
                  value={form.plate}
                  onChange={(event) => setForm({ ...form, plate: event.target.value })}
                  placeholder="opcional"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Ativo</div>
                <div className="text-xs text-muted-foreground">
                  Quando desativado, o motoboy não consegue entrar.
                </div>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(value) => setForm({ ...form, active: value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetting} onOpenChange={(value) => !value && setResetting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>{resetting?.name}</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Nova senha</Label>
            <Input
              type="password"
              value={resetPwd}
              onChange={(event) => setResetPwd(event.target.value)}
              placeholder="mínimo 6 caracteres"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetting(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmReset}>Redefinir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailCourier} onOpenChange={(value) => !value && setDetailCourier(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bike className="h-5 w-5 text-primary" />
              {detailCourier?.name}
            </DialogTitle>
            <DialogDescription>
              Carga atual e histórico operacional de {periodLabel.toLowerCase()}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border p-3">
              <Package className="mb-2 h-4 w-4 text-primary" />
              <div className="text-xl font-bold">{activeDetailOrders.length}</div>
              <div className="text-xs text-muted-foreground">pedidos em posse</div>
            </div>
            <div className="rounded-xl border p-3">
              <CheckCircle2 className="mb-2 h-4 w-4 text-primary" />
              <div className="text-xl font-bold">{modalDeliveredOrders.length}</div>
              <div className="text-xs text-muted-foreground">entregues no período</div>
            </div>
            <div className="rounded-xl border p-3">
              <PackageCheck className="mb-2 h-4 w-4 text-primary" />
              <div className="text-xl font-bold">
                {modalDeliveredOrders.reduce(
                  (sum: number, delivery: any) => sum + totalItems(delivery.order?.items),
                  0,
                )}
              </div>
              <div className="text-xs text-muted-foreground">produtos entregues</div>
            </div>
            <div className="rounded-xl border p-3">
              <WalletCards className="mb-2 h-4 w-4 text-primary" />
              <div className="text-base font-bold">
                {brl(
                  modalDeliveredOrders.reduce(
                    (sum: number, delivery: any) => sum + Number(delivery.order?.total || 0),
                    0,
                  ),
                )}
              </div>
              <div className="text-xs text-muted-foreground">valor entregue</div>
            </div>
          </div>

          <Tabs defaultValue="current" className="mt-2">
            <TabsList className="grid h-auto w-full grid-cols-3">
              <TabsTrigger value="current" className="gap-1.5">
                <Package className="h-4 w-4" /> Carga atual
              </TabsTrigger>
              <TabsTrigger value="deliveries" className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> Entregas
              </TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5">
                <History className="h-4 w-4" /> Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="space-y-5 pt-3">
              <div>
                <h3 className="mb-2 font-semibold">Produtos em posse</h3>
                {(detail?.products || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                    Nenhum produto em posse deste motoboy.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(detail?.products || []).map((product: any) => (
                      <div key={product.name} className="rounded-lg border p-3 text-sm">
                        <Package className="mr-2 inline h-4 w-4 text-primary" />
                        {product.name} — <b>{product.quantity} un.</b>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Pedidos em posse</h3>
                {activeDetailOrders.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                    Nenhum pedido está atualmente em posse deste motoboy.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeDetailOrders.map((delivery: any) => (
                      <div key={delivery.id} className="rounded-xl border p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <b>Pedido #{String(delivery.order.id).slice(0, 8)}</b>
                          <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                            {statusLabel(delivery.status)}
                          </span>
                        </div>
                        <div className="mt-1 font-medium">{delivery.order.customer}</div>
                        <div className="text-muted-foreground">
                          {(delivery.order.items || [])
                            .map((item: any) => `${item.qty ?? item.quantity ?? 0}x ${item.name}`)
                            .join(", ")}
                        </div>
                        <div className="mt-1">
                          {delivery.order.district} · {brl(Number(delivery.order.total))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="deliveries" className="pt-3">
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                Entregas concluídas em <b className="text-foreground">{periodLabel}</b>
              </div>
              {modalDeliveredOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhuma entrega concluída neste período.
                </div>
              ) : (
                <div className="space-y-2">
                  {modalDeliveredOrders.map((delivery: any) => (
                    <div key={delivery.id} className="rounded-xl border p-3 text-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <b>Pedido #{String(delivery.order.id).slice(0, 8)}</b>
                          <div className="mt-1 font-medium">{delivery.order.customer}</div>
                          <div className="text-muted-foreground">
                            {(delivery.order.items || [])
                              .map((item: any) => `${item.qty ?? item.quantity ?? 0}x ${item.name}`)
                              .join(", ")}
                          </div>
                          <div className="mt-1">
                            {delivery.order.district} · {brl(Number(delivery.order.total))}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground sm:text-right">
                          <div className="font-medium text-primary">Entregue</div>
                          {delivery.completed_at
                            ? new Date(delivery.completed_at).toLocaleString("pt-BR")
                            : "Horário não informado"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="pt-3">
              {modalEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum evento operacional neste período.
                </div>
              ) : (
                <div className="space-y-2">
                  {modalEvents.map((event: any) => (
                    <div key={event.id} className="flex gap-3 rounded-xl border p-3 text-sm">
                      <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                      <div>
                        <div className="font-medium">
                          {EVENT_LABELS[event.event_type] || event.event_type}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleString("pt-BR")}
                          {event.order_id ? ` · Pedido #${String(event.order_id).slice(0, 8)}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {detailHistory && (
            <div className="mt-2 rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
              Os indicadores deste período são calculados a partir das entregas e eventos reais já registrados na Zappfy.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
