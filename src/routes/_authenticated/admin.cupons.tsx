import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { listCoupons, saveCoupon, deleteCoupon } from "@/lib/admin.functions";
import { Plus, Trash2, Edit } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/cupons")({ component: CouponsPage });

function CouponsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCoupons);
  const saveFn = useServerFn(saveCoupon);
  const delFn = useServerFn(deleteCoupon);
  const { data: coupons = [], isLoading } = useQuery({ queryKey: ["admin-coupons"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<any | null>(null);

  const save = useMutation({
    mutationFn: (c: any) => saveFn({ data: { ...c, discount_value: Number(c.discount_value), max_uses: c.max_uses ? Number(c.max_uses) : null } }),
    onSuccess: () => { toast.success("Cupom salvo"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AdminShell title="Cupons" subtitle="Códigos de desconto"
      actions={<Button onClick={() => setEditing({ code: "", discount_type: "percent", discount_value: 10, is_active: true })}><Plus className="h-4 w-4 mr-1" />Novo cupom</Button>}>
      {isLoading ? <div className="text-muted-foreground">Carregando...</div> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left p-3">Código</th><th className="text-left p-3">Desconto</th><th className="text-left p-3">Usos</th><th className="text-left p-3">Validade</th><th className="text-left p-3">Status</th><th className="text-right p-3">Ações</th></tr>
            </thead>
            <tbody>
              {coupons.map((c: any) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3 font-mono">{c.code}</td>
                  <td className="p-3">{c.discount_type === "percent" ? `${c.discount_value}%` : `R$ ${c.discount_value}`}</td>
                  <td className="p-3">{c.uses}{c.max_uses ? `/${c.max_uses}` : ""}</td>
                  <td className="p-3 text-xs">{c.valid_until ? new Date(c.valid_until).toLocaleDateString("pt-BR") : "Sem validade"}</td>
                  <td className="p-3">{c.is_active ? "Ativo" : "Inativo"}</td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}><Edit className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Excluir cupom?")) { await delFn({ data: { id: c.id } }); toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["admin-coupons"] }); } }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum cupom cadastrado</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar cupom" : "Novo cupom"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div><Label>Código</Label><Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tipo</Label>
                  <Select value={editing.discount_type} onValueChange={(v) => setEditing({ ...editing, discount_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Porcentagem</SelectItem>
                      <SelectItem value="fixed">Valor fixo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Valor</Label><Input type="number" step="0.01" value={editing.discount_value} onChange={(e) => setEditing({ ...editing, discount_value: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Usos máximos</Label><Input type="number" value={editing.max_uses ?? ""} onChange={(e) => setEditing({ ...editing, max_uses: e.target.value })} /></div>
                <div><Label>Validade</Label><Input type="date" value={editing.valid_until ? editing.valid_until.slice(0, 10) : ""} onChange={(e) => setEditing({ ...editing, valid_until: e.target.value || null })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Ativo</Label></div>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={() => save.mutate(editing)} disabled={save.isPending || !editing?.code}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
