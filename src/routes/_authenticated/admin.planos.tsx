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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { listPlans, savePlan, deletePlan } from "@/lib/admin.functions";
import { Plus, Edit, Trash2 } from "lucide-react";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/planos")({ component: PlansPage });

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
    <AdminShell title="Planos" subtitle="Gerencie os planos disponíveis"
      actions={<Button onClick={() => setEditing({ name: "", description: "", price_monthly: 0, price_yearly: 0, features: "", is_active: true, sort_order: 0 })}><Plus className="h-4 w-4 mr-1" />Novo plano</Button>}>
      {isLoading ? <div className="text-muted-foreground">Carregando...</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p: any) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
                {p.is_active ? <span className="text-xs px-2 py-1 bg-green-500/15 text-green-500 rounded">Ativo</span> : <span className="text-xs px-2 py-1 bg-secondary rounded">Inativo</span>}
              </div>
              <div className="mt-3 text-2xl font-bold text-primary">{brl(Number(p.price_monthly))}<span className="text-xs text-muted-foreground">/mês</span></div>
              <div className="text-xs text-muted-foreground">{brl(Number(p.price_yearly))}/ano</div>
              <ul className="mt-3 space-y-1 text-sm">
                {(p.features || []).map((f: string, i: number) => <li key={i}>• {f}</li>)}
              </ul>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...p, features: (p.features || []).join("\n") })}><Edit className="h-3 w-3 mr-1" />Editar</Button>
                <Button size="sm" variant="ghost" onClick={async () => { if (confirm(`Excluir ${p.name}?`)) { await delFn({ data: { id: p.id } }); toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["admin-plans"] }); } }}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar plano" : "Novo plano"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div><Label>Nome</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Descrição</Label><Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Preço mensal (R$)</Label><Input type="number" step="0.01" value={editing.price_monthly} onChange={(e) => setEditing({ ...editing, price_monthly: Number(e.target.value) })} /></div>
                <div><Label>Preço anual (R$)</Label><Input type="number" step="0.01" value={editing.price_yearly} onChange={(e) => setEditing({ ...editing, price_yearly: Number(e.target.value) })} /></div>
              </div>
              <div><Label>Recursos (um por linha)</Label><Textarea value={editing.features} onChange={(e) => setEditing({ ...editing, features: e.target.value })} /></div>

              <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
                <div>
                  <div className="text-sm font-semibold">Integração Kiwify</div>
                  <p className="text-xs text-muted-foreground">Cole o ID do produto da Kiwify para cada ciclo. O webhook usa esses IDs para liberar o acesso automaticamente.</p>
                </div>
                <div className="grid gap-3">
                  <div>
                    <Label>ID produto Kiwify — Mensal (30 dias)</Label>
                    <Input
                      placeholder="ex: 12ab34cd-56ef-..."
                      value={editing.kiwify_product_id_monthly ?? ""}
                      onChange={(e) => setEditing({ ...editing, kiwify_product_id_monthly: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>ID produto Kiwify — Trimestral (90 dias)</Label>
                    <Input
                      placeholder="ex: 12ab34cd-56ef-..."
                      value={editing.kiwify_product_id_quarterly ?? ""}
                      onChange={(e) => setEditing({ ...editing, kiwify_product_id_quarterly: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>ID produto Kiwify — Anual (365 dias)</Label>
                    <Input
                      placeholder="ex: 12ab34cd-56ef-..."
                      value={editing.kiwify_product_id_yearly ?? ""}
                      onChange={(e) => setEditing({ ...editing, kiwify_product_id_yearly: e.target.value })}
                    />
                  </div>
                </div>
              </div>

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
