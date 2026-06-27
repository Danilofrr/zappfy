import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, KeyRound, Loader2, Bike, Power } from "lucide-react";
import { toast } from "sonner";
import bcrypt from "bcryptjs";

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

function MotoboysPage() {
  const [list, setList] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Courier | null>(null);
  const [resetting, setResetting] = useState<Courier | null>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", password: "", vehicle_type: "moto", plate: "", active: true });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("couriers")
      .select("id, store_id, name, phone, vehicle_type, plate, active, last_login_at, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setList((data as Courier[]) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", phone: "", password: "", vehicle_type: "moto", plate: "", active: true });
    setOpen(true);
  }

  function openEdit(c: Courier) {
    setEditing(c);
    setForm({ name: c.name, phone: c.phone, password: "", vehicle_type: c.vehicle_type || "moto", plate: c.plate || "", active: c.active });
    setOpen(true);
  }

  async function submit() {
    if (!form.name.trim() || !form.phone.trim()) { toast.error("Nome e WhatsApp obrigatórios"); return; }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { toast.error("Sessão expirada"); setSaving(false); return; }
    if (editing) {
      const { error } = await (supabase as any)
        .from("couriers")
        .update({
          name: form.name.trim(),
          phone: form.phone.trim(),
          vehicle_type: form.vehicle_type,
          plate: form.plate.trim() || null,
          active: form.active,
        })
        .eq("id", editing.id)
        .eq("store_id", uid);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Motoboy atualizado");
    } else {
      if (!form.password || form.password.length < 6) { toast.error("Senha do motoboy deve ter ao menos 6 caracteres"); setSaving(false); return; }
      const password_hash = await bcrypt.hash(form.password, 10);
      const { error } = await (supabase as any).from("couriers").insert({
        store_id: uid,
        name: form.name.trim(),
        phone: form.phone.trim(),
        password_hash,
        vehicle_type: form.vehicle_type,
        plate: form.plate.trim() || null,
        active: form.active,
      });
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Motoboy cadastrado com sucesso");
    }
    setSaving(false);
    setOpen(false);
    load();
  }

  async function toggleActive(c: Courier) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { error } = await (supabase as any)
      .from("couriers")
      .update({ active: !c.active })
      .eq("id", c.id)
      .eq("store_id", uid);
    if (error) { toast.error(error.message); return; }
    load();
  }

  async function remove(c: Courier) {
    if (!confirm(`Excluir motoboy "${c.name}"?`)) return;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { error } = await (supabase as any)
      .from("couriers")
      .delete()
      .eq("id", c.id)
      .eq("store_id", uid);
    if (error) { toast.error(error.message); return; }
    toast.success("Motoboy excluído");
    load();
  }

  async function confirmReset() {
    if (!resetting) return;
    if (resetPwd.length < 6) { toast.error("Senha do motoboy deve ter ao menos 6 caracteres"); return; }
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const password_hash = await bcrypt.hash(resetPwd, 10);
    const { error } = await (supabase as any)
      .from("couriers")
      .update({ password_hash })
      .eq("id", resetting.id)
      .eq("store_id", uid);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha redefinida");
    setResetting(null); setResetPwd("");
  }

  return (
    <AppShell
      title="Motoboys"
      subtitle="Cadastre os motoboys que poderão acessar sua Central de Entregas Zappfy"
      actions={<Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Novo motoboy</Button>}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Bike className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum motoboy cadastrado ainda.</p>
          <Button className="mt-3" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Cadastrar motoboy</Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {c.name}
                    {!c.active && <span className="text-[10px] uppercase rounded px-1.5 py-0.5 bg-destructive/15 text-destructive">Inativo</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.phone}</div>
                  <div className="text-xs text-muted-foreground capitalize mt-0.5">
                    {(VEHICLES.find(v => v.v === c.vehicle_type)?.l) || "Moto"}
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
                <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>
                <Button size="sm" variant="outline" onClick={() => { setResetting(c); setResetPwd(""); }}><KeyRound className="h-3.5 w-3.5 mr-1" /> Senha</Button>
                <Button size="sm" variant="outline" onClick={() => toggleActive(c)}><Power className="h-3.5 w-3.5 mr-1" /> {c.active ? "Desativar" : "Ativar"}</Button>
                <Button size="sm" variant="destructive" onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir</Button>
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
              {editing ? "Atualize os dados do motoboy." : "Cadastre um novo motoboy com login próprio."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>WhatsApp (login) *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="5581999990000" /></div>
            {!editing && (
              <div><Label>Senha *</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="mínimo 4 caracteres" /></div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Veículo</Label>
                <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VEHICLES.map(v => <SelectItem key={v.v} value={v.v}>{v.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Placa</Label><Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} placeholder="opcional" /></div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="text-sm font-medium">Ativo</div>
                <div className="text-xs text-muted-foreground">Quando desativado, o motoboy não consegue entrar.</div>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
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
            <Input type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} placeholder="mínimo 4 caracteres" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetting(null)}>Cancelar</Button>
            <Button onClick={confirmReset}>Redefinir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
