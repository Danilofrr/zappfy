import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { listPayments, listClients, registerPayment } from "@/lib/admin.functions";
import { brl } from "@/lib/format";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/pagamentos")({ component: PaymentsPage });

const statusColors: Record<string, string> = {
  pago: "bg-green-500/15 text-green-500 border-green-500/30",
  pendente: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  vencido: "bg-red-500/15 text-red-500 border-red-500/30",
  cancelado: "bg-secondary text-muted-foreground border-border",
};

function PaymentsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPayments);
  const clientsFn = useServerFn(listClients);
  const regFn = useServerFn(registerPayment);
  const { data: payments = [], isLoading } = useQuery({ queryKey: ["admin-payments"], queryFn: () => listFn() });
  const { data: clients = [] } = useQuery({ queryKey: ["admin-clients"], queryFn: () => clientsFn() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ userId: "", amount: "", method: "pix", status: "pago", notes: "", renewDays: "30" });

  const register = useMutation({
    mutationFn: () => regFn({ data: { userId: form.userId, amount: Number(form.amount), method: form.method, status: form.status as any, notes: form.notes, renewDays: Number(form.renewDays) } }),
    onSuccess: () => { toast.success("Pagamento registrado"); setOpen(false); setForm({ userId: "", amount: "", method: "pix", status: "pago", notes: "", renewDays: "30" }); qc.invalidateQueries({ queryKey: ["admin-payments"] }); qc.invalidateQueries({ queryKey: ["admin-clients"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AdminShell title="Pagamentos" subtitle="Histórico financeiro dos clientes"
      actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Registrar pagamento</Button>}>
      {isLoading ? <div className="text-muted-foreground">Carregando...</div> : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left p-3">Cliente</th><th className="text-left p-3">Plano</th><th className="text-left p-3">Valor</th><th className="text-left p-3">Método</th><th className="text-left p-3">Status</th><th className="text-left p-3">Data</th></tr>
            </thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-3">{p.fullName || "—"}</td>
                  <td className="p-3">{p.subscriptions?.plans?.name || "—"}</td>
                  <td className="p-3 font-medium">{brl(Number(p.amount))}</td>
                  <td className="p-3 capitalize">{p.method}</td>
                  <td className="p-3"><Badge variant="outline" className={statusColors[p.status]}>{p.status}</Badge></td>
                  <td className="p-3 text-xs">{new Date(p.created_at).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum pagamento registrado</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Cliente</Label>
              <Select value={form.userId} onValueChange={(v) => setForm({ ...form, userId: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.fullName || c.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Método</Label>
                <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Renovar (dias)</Label><Input type="number" value={form.renewDays} onChange={(e) => setForm({ ...form, renewDays: e.target.value })} /></div>
            </div>
            <div><Label>Observação</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => register.mutate()} disabled={register.isPending || !form.userId || !form.amount}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
