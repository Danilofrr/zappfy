import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listPlans, savePlan, deletePlan } from "@/lib/admin.functions";
import { Plus, Edit, Trash2 } from "lucide-react";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/planos")({ component: PlansPage });

const CYCLES: Record<string, { label: string; days: number; suffix: string }> = {
  mensal: { label: "Mensal", days: 30, suffix: "/mês" },
  trimestral: { label: "Trimestral", days: 90, suffix: "/trimestre" },
  anual: { label: "Anual", days: 365, suffix: "/ano" },
};

function emptyPlan() {
  return {
    name: "",
    description: "",
    billing_cycle: "mensal",
    price: 0,
    duration_days: 30,
    kiwify_product_id: "",
    features: "",
    is_active: true,
    sort_order: 0,
  };
}

function PlansPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPlans);
  const saveFn = useServerFn(savePlan);
  const delFn = useServerFn(deletePlan);
  const { data: plans = [], isLoading } = useQuery({ queryKey: ["admin-plans"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<any | null>(null);

  const save = useMutation({
    mutationFn: (p: any) => saveFn({ data: { ...p, features: typeof p.features === "string" ? p.features.split("\n").filter(Boolean) : p.features } }),
    onSuccess: () => { toast.success("Plano salvo"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-plans"] }); qc.invalidateQueries({ queryKey: ["admin-clients"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AdminShell title="Planos" subtitle="Cadastre um plano por ciclo (Mensal, Trimestral, Anual) com seu próprio ID Kiwify"
      actions={<Button onClick={() => setEditing(emptyPlan())}><Plus className="h-4 w-4 mr-1" />Novo plano</Button>}>
      {isLoading ? <div className="text-muted-foreground">Carregando...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p: any) => {
            const cycle = CYCLES[p.billing_cycle as string] ?? CYCLES.mensal;
            const displayPrice = Number(p.price ?? p.price_monthly ?? 0);
            return (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold truncate">{p.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/15 text-primary">{cycle.label}</span>
                    {p.is_active
                      ? <span className="text-[10px] px-2 py-0.5 bg-green-500/15 text-green-500 rounded">Ativo</span>
                      : <span className="text-[10px] px-2 py-0.5 bg-secondary rounded">Inativo</span>}
                  </div>
                </div>
                <div className="mt-3 text-2xl font-bold text-primary">
                  {brl(displayPrice)}<span className="text-xs text-muted-foreground">{cycle.suffix}</span>
                </div>
                <div className="text-xs text-muted-foreground">{p.duration_days ?? cycle.days} dias de acesso</div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Kiwify ID: <span className="font-mono">{p.kiwify_product_id || "—"}</span>
                </div>
                <ul className="mt-3 space-y-1 text-sm">
                  {(p.features || []).map((f: string, i: number) => <li key={i}>• {f}</li>)}
                </ul>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing({
                    ...emptyPlan(),
                    ...p,
                    price: Number(p.price ?? p.price_monthly ?? 0),
                    duration_days: p.duration_days ?? CYCLES[p.billing_cycle as string]?.days ?? 30,
                    billing_cycle: p.billing_cycle ?? "mensal",
                    kiwify_product_id: p.kiwify_product_id ?? "",
                    features: (p.features || []).join("\n"),
                  })}>
                    <Edit className="h-3 w-3 mr-1" />Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (confirm(`Excluir ${p.name}?`)) { await delFn({ data: { id: p.id } }); toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["admin-plans"] }); } }}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div><Label>Nome do produto</Label><Input placeholder="Ex: Zappfy Mensal" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Descrição</Label><Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Ciclo</Label>
                  <Select
                    value={editing.billing_cycle}
                    onValueChange={(v) => setEditing({ ...editing, billing_cycle: v, duration_days: CYCLES[v]?.days ?? editing.duration_days })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CYCLES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
                <div><Label>Dias de acesso</Label><Input type="number" value={editing.duration_days} onChange={(e) => setEditing({ ...editing, duration_days: Number(e.target.value) })} /></div>
              </div>

              <div>
                <Label>ID do produto na Kiwify</Label>
                <Input
                  placeholder="ex: 12ab34cd-56ef-..."
                  value={editing.kiwify_product_id ?? ""}
                  onChange={(e) => setEditing({ ...editing, kiwify_product_id: e.target.value })}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">O webhook usa esse ID para identificar o plano comprado e liberar o acesso pelos dias informados.</p>
              </div>

              <div><Label>Recursos (um por linha)</Label><Textarea value={editing.features} onChange={(e) => setEditing({ ...editing, features: e.target.value })} /></div>

              <div className="flex items-center gap-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Plano ativo</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing?.name}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
