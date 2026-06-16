import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — LucroTrack" }] }),
  component: Page,
});

function Page() {
  const { state, updateSettings, resetSeed } = useStore();
  const [f, setF] = useState(state.settings);

  return (
    <AppShell
      title="Configurações"
      subtitle="Personalize sua loja e metas"
      actions={
        <Button variant="outline" onClick={() => { if (confirm("Restaurar dados de exemplo? Suas alterações serão perdidas.")) { resetSeed(); toast.success("Dados restaurados"); } }}>
          <RotateCcw className="mr-2 h-4 w-4"/>Restaurar exemplos
        </Button>
      }
    >
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Dados da loja">
          <Field label="Nome da Loja"><Input value={f.storeName} onChange={(e) => setF({...f, storeName: e.target.value})}/></Field>
          <Field label="WhatsApp (com DDI, só números)"><Input value={f.whatsapp} onChange={(e) => setF({...f, whatsapp: e.target.value})} placeholder="5581999990000"/></Field>
          <Field label="Chave PIX"><Input value={f.pixKey} onChange={(e) => setF({...f, pixKey: e.target.value})}/></Field>
          <Field label="Endereço"><Input value={f.address} onChange={(e) => setF({...f, address: e.target.value})}/></Field>
        </Card>

        <Card title="Metas e operação">
          <Field label="Taxa de entrega padrão (R$)">
            <Input type="number" step="0.01" value={f.deliveryFee} onChange={(e) => setF({...f, deliveryFee: Number(e.target.value)})}/>
          </Field>
          <Field label="Meta mensal de faturamento (R$)">
            <Input type="number" step="0.01" value={f.monthlyRevenueGoal} onChange={(e) => setF({...f, monthlyRevenueGoal: Number(e.target.value)})}/>
          </Field>
          <Field label="Meta mensal de lucro (R$)">
            <Input type="number" step="0.01" value={f.monthlyProfitGoal} onChange={(e) => setF({...f, monthlyProfitGoal: Number(e.target.value)})}/>
          </Field>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={() => { updateSettings(f); toast.success("Configurações salvas"); }}>Salvar alterações</Button>
      </div>
    </AppShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 lg:p-6 shadow-elegant">
      <div className="text-sm font-semibold mb-4">{title}</div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
