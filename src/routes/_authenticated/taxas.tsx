import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bike, Receipt, CreditCard, Building2, Megaphone, Percent, Calculator } from "lucide-react";

const MACHINE_BRANDS = ["VISA", "MASTERCARD", "ELO", "DÉBITO", "PIX", "DINHEIRO", "LINK"] as const;
const noInstallment = (brand: string) => brand === "DÉBITO" || brand === "PIX" || brand === "DINHEIRO";

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
      motoboyFee: Number(f.motoboyFee) || 0,
      taxPct: Number(f.taxPct) || 0,
      cardFeePct: Number(f.cardFeePct) || 0,
      platformFeePct: Number(f.platformFeePct) || 0,
      adsTaxPct: Number(f.adsTaxPct) || 0,
      otherFeesPct: Number(f.otherFeesPct) || 0,
      cardMachineFees: f.cardMachineFees ?? {},
      cardFeeMode: f.cardFeeMode === "absorb" ? "absorb" : "passthrough",
    });
    toast.success("Taxas salvas");
  }

  function setMachineFee(brand: string, parcela: number, value: number) {
    setF((prev) => ({
      ...prev,
      cardMachineFees: {
        ...(prev.cardMachineFees ?? {}),
        [brand]: { ...((prev.cardMachineFees ?? {})[brand] || {}), [parcela]: value },
      },
    }));
  }

  return (
    <AppShell
      title="Taxas"
      subtitle="Centralize aqui todas as taxas e custos operacionais da sua loja"
    >
      <div className="grid lg:grid-cols-2 gap-6">


        <Card title="Taxa do motoboy" icon={Bike} description="Quanto você paga ao motoboy por entrega. Descontado do lucro.">
          <Field label="Valor por entrega (R$)">
            <Input
              type="number"
              step="0.01"
              value={f.motoboyFee}
              onChange={(e) => setF({ ...f, motoboyFee: Number(e.target.value) })}
              placeholder="Ex: 10.00"
            />
          </Field>
        </Card>

        <Card title="Imposto" icon={Receipt} description="Imposto sobre faturamento — ex.: Simples Nacional.">
          <PercentField
            label="Alíquota (%)"
            value={f.taxPct}
            onChange={(v) => setF({ ...f, taxPct: v })}
            placeholder="Ex: 6"
          />
        </Card>

        <Card title="Taxa cartão / gateway" icon={CreditCard} description="Taxa cobrada pela maquininha ou gateway de pagamento.">
          <PercentField
            label="Alíquota (%)"
            value={f.cardFeePct}
            onChange={(v) => setF({ ...f, cardFeePct: v })}
            placeholder="Ex: 3.99"
          />
        </Card>

        <Card title="Taxa da plataforma" icon={Building2} description="Comissão de marketplace ou plataforma de vendas.">
          <PercentField
            label="Alíquota (%)"
            value={f.platformFeePct}
            onChange={(v) => setF({ ...f, platformFeePct: v })}
            placeholder="Ex: 12"
          />
        </Card>

        <Card title="Imposto sobre Meta Ads" icon={Megaphone} description="Imposto aplicado sobre o investimento em anúncios da Meta. Exibido no card do Meta Ads na Dashboard.">
          <PercentField
            label="Alíquota (%)"
            value={f.adsTaxPct}
            onChange={(v) => setF({ ...f, adsTaxPct: v })}
            placeholder="Ex: 17.65"
          />
        </Card>

        <Card title="Outras taxas" icon={Percent} description="Qualquer outra taxa percentual que incida sobre suas vendas.">
          <PercentField
            label="Alíquota (%)"
            value={f.otherFeesPct}
            onChange={(v) => setF({ ...f, otherFeesPct: v })}
            placeholder="Ex: 1"
          />
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Taxas da maquininha (Crédito / Débito)" icon={Calculator} description="Configure a taxa (%) por bandeira e por parcela. Ao criar um pedido com cartão, você escolhe a bandeira e em quantas parcelas — a taxa é aplicada automaticamente.">
          <div className="rounded-lg border border-border p-4 bg-muted/30">
            <div className="text-sm font-medium mb-1">Quem paga a taxa da maquininha?</div>
            <div className="text-[11px] text-muted-foreground mb-3">Define se a taxa configurada abaixo será somada ao valor no checkout (repassar ao cliente) ou descontada do seu lucro (loja absorve).</div>
            <div className="grid sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setF({ ...f, cardFeeMode: "passthrough" })}
                className={`text-left rounded-lg border p-3 transition ${
                  (f.cardFeeMode ?? "passthrough") === "passthrough"
                    ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="text-sm font-semibold">Repassar ao cliente</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">A taxa é somada ao total no checkout.</div>
              </button>
              <button
                type="button"
                onClick={() => setF({ ...f, cardFeeMode: "absorb" })}
                className={`text-left rounded-lg border p-3 transition ${
                  f.cardFeeMode === "absorb"
                    ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="text-sm font-semibold">Loja absorve</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">O cliente não paga a taxa — ela sai do seu lucro.</div>
              </button>
            </div>
          </div>
          <div className="overflow-x-auto -mx-2">

            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="text-left px-2 py-2 font-medium">Parcelas</th>
                  {MACHINE_BRANDS.map((b) => (
                    <th key={b} className="text-left px-2 py-2 font-medium">{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((parcela) => (
                  <tr key={parcela} className="border-t border-border">
                    <td className="px-2 py-2 text-muted-foreground font-medium whitespace-nowrap">{parcela}x</td>
                    {MACHINE_BRANDS.map((b) => {
                      if (parcela > 1 && noInstallment(b)) {
                        return <td key={b} className="px-2 py-2 text-muted-foreground text-center">—</td>;
                      }
                      const val = (f.cardMachineFees ?? {})[b]?.[parcela] ?? 0;
                      return (
                        <td key={b} className="px-2 py-2">
                          <div className="relative min-w-[90px]">
                            <Input
                              type="number" min={0} step="0.01"
                              value={val || ""}
                              onChange={(e) => setMachineFee(b, parcela, Number(e.target.value))}
                              className="h-8 pr-7 text-sm"
                              placeholder="0"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <Icon className="h-4 w-4 text-primary" />
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

function PercentField({ label, value, onChange, placeholder }: { label: string; value: number; onChange: (v: number) => void; placeholder?: string }) {
  return (
    <Field label={label}>
      <div className="relative">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={placeholder}
          className="pr-9"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </div>
    </Field>
  );
}
