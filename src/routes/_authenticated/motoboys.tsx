import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  Loader2,
  Bike,
  Power,
  Copy,
  ExternalLink,
  QrCode,
  Package,
  Eye,
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

const VEHICLES = [
  { v: "moto", l: "Moto" },
  { v: "carro", l: "Carro" },
  { v: "bike", l: "Bike" },
  { v: "a-pe", l: "A pé" },
];

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const normalizeCourierPhone = (value: string) => {
  const digits = normalizePhone(value);
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
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
  const centralUrl =
    typeof window !== "undefined" && activeStore?.slug
      ? `${window.location.origin}/entregas-zappfy/${encodeURIComponent(activeStore.slug)}`
      : "";

  async function load() {
    if (!activeStoreId) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data, error }, { data: loadData }] = await Promise.all([
      (supabase as any).rpc("list_couriers_for_store", { _store_id: activeStoreId }),
      (supabase as any).rpc("get_courier_loads", { _store_id: activeStoreId }),
    ]);
    if (error) toast.error(error.message);
    setList((data as Courier[]) || []);
    setLoads(Array.isArray(loadData) ? loadData : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [activeStoreId]);

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
        load,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeStoreId]);

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

  return (
    <AppShell
      title="Motoboys"
      subtitle="Cadastre os motoboys que poderão acessar sua Central de Entregas Zappfy"
      actions={
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo motoboy
        </Button>
      }
    >
      <section className="mb-6 rounded-2xl border border-primary/30 bg-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Bike className="h-5 w-5 text-primary" />
              Central de Entregas
            </div>
            <p className="mt-1 break-all text-sm text-muted-foreground">
              {centralUrl || "Cadastre um slug para a loja."}
            </p>
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
              <Copy className="mr-1 h-4 w-4" />
              Copiar link
            </Button>
            <Button
              disabled={!centralUrl}
              onClick={() => window.open(centralUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="mr-1 h-4 w-4" />
              Abrir Central
            </Button>
          </div>
        </div>
        {centralUrl && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">
              <QrCode className="mr-1 inline h-4 w-4" />
              QR Code
            </summary>
            <img
              className="mt-3 h-48 w-48 rounded-xl bg-white p-2"
              alt="QR Code da Central"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(centralUrl)}`}
            />
          </details>
        )}
      </section>

      <h2 className="mb-3 text-lg font-semibold">Carga dos motoboys</h2>
      <div className="mb-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loads.map((l) => (
          <div key={l.courier_id} className="rounded-2xl border bg-card p-4">
            <div className="font-bold">{l.name}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <span>{l.orders_in_possession} pedidos em posse</span>
              <span>{l.products_in_possession} produtos em posse</span>
              <span>{l.delivered_today} entregues hoje</span>
              <span>{l.products_delivered_today} produtos entregues</span>
              <span>{l.failed} não entregues</span>
              <span>{l.returned} devolução(ões)</span>
            </div>
            <div className="mt-3 font-semibold text-primary">
              {brl(Number(l.value_in_possession))} em mercadorias
            </div>
            <Button
              className="mt-3 w-full"
              variant="outline"
              onClick={() => {
                const c = list.find((x) => x.id === l.courier_id);
                if (c) openLoad(c);
              }}
            >
              <Eye className="mr-1 h-4 w-4" />
              Ver carga
            </Button>
          </div>
        ))}
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Bike className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum motoboy cadastrado ainda.</p>
          <Button className="mt-3" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Cadastrar motoboy
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {c.name}
                    {!c.active && (
                      <span className="text-[10px] uppercase rounded px-1.5 py-0.5 bg-destructive/15 text-destructive">
                        Inativo
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.phone}</div>
                  <div className="text-xs text-muted-foreground capitalize mt-0.5">
                    {VEHICLES.find((v) => v.v === c.vehicle_type)?.l || "Moto"}
                    {c.plate ? ` · ${c.plate}` : ""}
                  </div>
                  {c.last_login_at && (
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Último acesso: {new Date(c.last_login_at).toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setResetting(c);
                    setResetPwd("");
                  }}
                >
                  <KeyRound className="h-3.5 w-3.5 mr-1" /> Senha
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleActive(c)}>
                  <Power className="h-3.5 w-3.5 mr-1" /> {c.active ? "Desativar" : "Ativar"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => remove(c)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>WhatsApp (login) *</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="5581999990000"
              />
            </div>
            {!editing && (
              <div>
                <Label>Senha *</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="mínimo 6 caracteres"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Veículo</Label>
                <Select
                  value={form.vehicle_type}
                  onValueChange={(v) => setForm({ ...form, vehicle_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLES.map((v) => (
                      <SelectItem key={v.v} value={v.v}>
                        {v.l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Placa</Label>
                <Input
                  value={form.plate}
                  onChange={(e) => setForm({ ...form, plate: e.target.value })}
                  placeholder="opcional"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium">Ativo</div>
                <div className="text-xs text-muted-foreground">
                  Quando desativado, o motoboy não consegue entrar.
                </div>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetting} onOpenChange={(v) => !v && setResetting(null)}>
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
              onChange={(e) => setResetPwd(e.target.value)}
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
      <Dialog open={!!detailCourier} onOpenChange={(v) => !v && setDetailCourier(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carga de {detailCourier?.name}</DialogTitle>
            <DialogDescription>
              Pedidos, produtos em posse e histórico operacional.
            </DialogDescription>
          </DialogHeader>
          <div>
            <h3 className="mb-2 font-semibold">Produtos em posse</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {(detail?.products || []).map((p: any) => (
                <div key={p.name} className="rounded-lg border p-3 text-sm">
                  <Package className="mr-2 inline h-4 w-4 text-primary" />
                  {p.name} — <b>{p.quantity} un.</b>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 mt-4 font-semibold">Pedidos da carga</h3>
            <div className="space-y-2">
              {(detail?.orders || []).map((d: any) => (
                <div key={d.id} className="rounded-xl border p-3 text-sm">
                  <b>Pedido #{String(d.order.id).slice(0, 8)}</b> · {d.order.customer}
                  <div className="text-muted-foreground">
                    {(d.order.items || []).map((i: any) => `${i.qty}x ${i.name}`).join(", ")}
                  </div>
                  <div>
                    {d.order.district} · {brl(Number(d.order.total))} · {d.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-2 mt-4 font-semibold">Histórico</h3>
            <div className="space-y-1 text-sm">
              {(detail?.events || []).map((e: any) => (
                <div key={e.id} className="border-l-2 border-primary pl-3">
                  {new Date(e.created_at).toLocaleString("pt-BR")} — {e.event_type}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
