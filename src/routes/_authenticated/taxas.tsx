import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Truck, Bike, Calculator, Percent } from "lucide-react";

export const Route = createFileRoute("/_authenticated/taxas")({
  head: () => ({ meta: [{ title: "Taxas — ZappFy" }] }),
  component: Page,
});

function Page() {
  const { state, updateSettings } = useStore();
  const [f, setF] = useState(state.settings);

  useEffect(() => { setF(state.settings); }, [state.settings]);

  function save() {
    updateSettings({
      deliveryLabel: f.deliveryLabel,
      deliveryFee: Number(f.deliveryFee) || 0,
      motoboyFee: Number(f.motoboyFee) || 0,
    });
    toast.success("Taxas salvas");
  }

  return (
    <AppShell
      title="Taxas"
      subtitle="Centralize aqui todas as taxas e custos operacionais da sua loja"
    >
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Taxa de entrega" icon={Truck} description="Valor cobrado do cliente pela entrega do pedido.">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome da entrega">
              <Input
                value={f.deliveryLabel}
                onChange={(e) => setF({ ...f, deliveryLabel: e.target.value })}
                placeholder="Motoboy, Correios..."
              />
            </Field>
            <Field label="Valor (R$)">
              <Input
                type="number"
                step="0.01"
                value={f.deliveryFee}
                onChange={(e) => setF({ ...f, deliveryFee: Number(e.target.value) })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Taxa do motoboy" icon={Bike} description="Quanto você paga ao motoboy por entrega. Descontado automaticamente do lucro.">
          <Field label="Valor por entrega (R$)">
            <Input
              type="number"
              step="0.01"
              value={f.motoboyFee}
              onChange={(e) => setF({ ...f, motoboyFee: Number(e.target.value) })}
              placeholder="Ex: 10.00"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Esse valor é descontado do lucro líquido em todos os relatórios.
            </p>
          </Field>
        </Card>

        <Card
          title="Impostos e taxas percentuais"
          icon={Percent}
          description="Impostos, taxa de cartão, taxa da plataforma e taxas sobre Ads são configurados na Precificação."
        >
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p>• Imposto (%)</p>
            <p>• Taxa cartão / gateway (%)</p>
            <p>• Taxa da plataforma (%)</p>
            <p>• Imposto sobre Ads (%)</p>
            <p>• Outras taxas (%)</p>
          </div>
          <Link
            to="/precificacao"
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:opacity-90 w-fit"
          >
            <Calculator className="h-4 w-4" /> Abrir Precificação
          </Link>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={save}>Salvar taxas</Button>
      </div>
    </AppShell>
  );
}

function Card({ title, icon: Icon, description, children }: { title: string; icon: any; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 lg:p-6 card-neon">
      <div className="flex items-start gap-3 mb-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20 shrink-0">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          {description && <div className="text-[11px] text-muted-foreground mt-0.5">{description}</div>}
        </div>
      </div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
