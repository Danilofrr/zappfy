import { createFileRoute } from "@tanstack/react-router";
import { AppShell, StatCard } from "@/components/AppShell";
import { useMemo, useState } from "react";
import { brl } from "@/lib/format";
import { Calculator, Percent, DollarSign, TrendingUp, RotateCcw, Target, Megaphone } from "lucide-react";

export const Route = createFileRoute("/_authenticated/precificacao")({
  head: () => ({ meta: [{ title: "Calculadora de Precificação — ZappFy" }] }),
  component: Page,
});

type Mode = "markup" | "margin" | "manual";

function num(v: string) {
  const n = parseFloat(v.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function Page() {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const [freight, setFreight] = useState("");
  const [packaging, setPackaging] = useState("");
  const [otherCost, setOtherCost] = useState("");

  const [taxPct, setTaxPct] = useState("");
  const [cardPct, setCardPct] = useState("");
  const [platformPct, setPlatformPct] = useState("");
  const [adsPct, setAdsPct] = useState("");
  const [adsTaxPct, setAdsTaxPct] = useState("17.65");
  const [otherPct, setOtherPct] = useState("");

  const [mode, setMode] = useState<Mode>("markup");
  const [markup, setMarkup] = useState("2");
  const [margin, setMargin] = useState("30");
  const [manualPrice, setManualPrice] = useState("");
  const [targetMargin, setTargetMargin] = useState("20");

  const data = useMemo(() => {
    const realCost = num(cost) + num(freight) + num(packaging) + num(otherCost);
    const adsEffectivePct = num(adsPct) * (1 + num(adsTaxPct) / 100);
    const variablePct = (num(taxPct) + num(cardPct) + num(platformPct) + adsEffectivePct + num(otherPct)) / 100;

    let price = 0;
    if (mode === "markup") {
      price = realCost * Math.max(num(markup), 0);
    } else if (mode === "margin") {
      const m = Math.min(Math.max(num(margin), 0), 99.9) / 100;
      const denom = 1 - m - variablePct;
      price = denom > 0 ? realCost / denom : 0;
    } else {
      price = num(manualPrice);
    }

    const adsSpend = price * (num(adsPct) / 100);
    const adsTaxValue = adsSpend * (num(adsTaxPct) / 100);
    const adsCost = adsSpend + adsTaxValue;
    const variableCost = price * variablePct;
    const otherVariableCost = variableCost - adsCost;
    const profit = price - realCost - variableCost;
    const marginPct = price > 0 ? (profit / price) * 100 : 0;
    const markupCalc = realCost > 0 ? price / realCost : 0;
    const breakEven = realCost / Math.max(1 - variablePct, 0.0001);

    // CPA: considera despesas variáveis SEM ads (CPA já é o gasto real). Mantém imposto sobre o CPA.
    const variablePctNoAds = variablePct - adsEffectivePct / 100;
    const variableCostNoAds = price * variablePctNoAds;
    const grossPerSale = price - realCost - variableCostNoAds; // disponível pra ads + imposto + lucro
    const taxMult = 1 + num(adsTaxPct) / 100;
    const cpaMax = Math.max(grossPerSale / taxMult, 0); // break-even em ads (já descontando imposto)
    const tMargin = Math.min(Math.max(num(targetMargin), 0), 99) / 100;
    const cpaIdeal = Math.max((grossPerSale - price * tMargin) / taxMult, 0);
    const roasMin = cpaMax > 0 ? price / cpaMax : 0;
    const roasIdeal = cpaIdeal > 0 ? price / cpaIdeal : 0;

    return { realCost, variablePct, price, variableCost, otherVariableCost, adsSpend, adsTaxValue, adsCost, profit, marginPct, markupCalc, breakEven, cpaMax, cpaIdeal, roasMin, roasIdeal };
  }, [cost, freight, packaging, otherCost, taxPct, cardPct, platformPct, adsPct, adsTaxPct, otherPct, mode, markup, margin, manualPrice, targetMargin]);

  function reset() {
    setName(""); setCost(""); setFreight(""); setPackaging(""); setOtherCost("");
    setTaxPct(""); setCardPct(""); setPlatformPct(""); setAdsPct(""); setAdsTaxPct("17.65"); setOtherPct("");
    setMarkup("2"); setMargin("30"); setManualPrice(""); setMode("markup"); setTargetMargin("20");
  }

  

  return (
    <AppShell
      title="Calculadora de Precificação"
      subtitle="Calcule o preço ideal de venda com base em custo real, markup e margem"
      actions={
        <button onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary">
          <RotateCcw className="h-4 w-4" /> Limpar
        </button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-4 mb-4">
        <StatCard label="Preço de Venda" value={brl(data.price)} icon={DollarSign} neon="34 211 238" />
        <StatCard label="Lucro Líquido" value={brl(data.profit)} icon={TrendingUp} neon="168 85 247" />
        <StatCard label="Margem" value={`${data.marginPct.toFixed(1)}%`} icon={Percent} neon="244 114 182" />
        <StatCard label="Markup" value={`${data.markupCalc.toFixed(2)}x`} icon={Calculator} neon="251 191 36" />
      </div>

      <div className="grid gap-4 lg:grid-cols-4 mb-6">
        <StatCard label="CPA Máximo (break-even)" value={brl(data.cpaMax)} icon={Megaphone} neon="239 68 68" hint="Acima disso, você tem prejuízo" />
        <StatCard label="CPA Ideal" value={brl(data.cpaIdeal)} icon={Target} neon="34 197 94" hint={`Mantendo ${num(targetMargin).toFixed(0)}% de margem`} />
        <StatCard label="ROAS Mínimo" value={`${data.roasMin.toFixed(2)}x`} icon={TrendingUp} neon="249 115 22" />
        <StatCard label="ROAS Ideal" value={`${data.roasIdeal.toFixed(2)}x`} icon={TrendingUp} neon="59 130 246" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Custos */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold tracking-tight">Produto & Custos</h2>
          <div className="space-y-3">
            <Field label="Nome do produto (opcional)">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Camiseta Premium" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Custo do produto (R$)">
                <input className="input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="Frete de entrada (R$)">
                <input className="input" inputMode="decimal" value={freight} onChange={(e) => setFreight(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="Embalagem (R$)">
                <input className="input" inputMode="decimal" value={packaging} onChange={(e) => setPackaging(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="Outros custos (R$)">
                <input className="input" inputMode="decimal" value={otherCost} onChange={(e) => setOtherCost(e.target.value)} placeholder="0,00" />
              </Field>
            </div>
            <div className="rounded-lg bg-secondary/40 px-3 py-2 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Custo real total</span>
              <span className="font-semibold">{brl(data.realCost)}</span>
            </div>
          </div>
        </section>

        {/* Despesas variáveis */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold tracking-tight">Despesas Variáveis (% sobre venda)</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Imposto (%)">
              <input className="input" inputMode="decimal" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Taxa cartão / gateway (%)">
              <input className="input" inputMode="decimal" value={cardPct} onChange={(e) => setCardPct(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Comissão plataforma (%)">
              <input className="input" inputMode="decimal" value={platformPct} onChange={(e) => setPlatformPct(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Custo de tráfego/ads (%)">
              <input className="input" inputMode="decimal" value={adsPct} onChange={(e) => setAdsPct(e.target.value)} placeholder="0" />
            </Field>
            <Field label="Imposto sobre Ads (%)">
              <input className="input" inputMode="decimal" value={adsTaxPct} onChange={(e) => setAdsTaxPct(e.target.value)} placeholder="17,65" />
            </Field>
            <Field label="Outras taxas (%)">
              <input className="input" inputMode="decimal" value={otherPct} onChange={(e) => setOtherPct(e.target.value)} placeholder="0" />
            </Field>
          </div>
          <div className="rounded-lg bg-secondary/40 px-3 py-2 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Total variável</span>
            <span className="font-semibold">{(data.variablePct * 100).toFixed(2)}%</span>
          </div>
        </section>

        {/* Modo de cálculo */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-4 lg:col-span-2">
          <h2 className="font-semibold tracking-tight">Forma de Precificação</h2>
          <div className="grid grid-cols-3 gap-2">
            {(["markup", "margin", "manual"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  mode === m ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-secondary"
                }`}
              >
                {m === "markup" ? "Por Markup" : m === "margin" ? "Por Margem" : "Preço Manual"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {mode === "markup" && (
              <Field label="Markup (multiplicador)">
                <input className="input" inputMode="decimal" value={markup} onChange={(e) => setMarkup(e.target.value)} placeholder="2" />
              </Field>
            )}
            {mode === "margin" && (
              <Field label="Margem desejada (%)">
                <input className="input" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} placeholder="30" />
              </Field>
            )}
            {mode === "manual" && (
              <Field label="Preço de venda (R$)">
                <input className="input" inputMode="decimal" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} placeholder="0,00" />
              </Field>
            )}
            <Field label="Margem alvo para CPA Ideal (%)">
              <input className="input" inputMode="decimal" value={targetMargin} onChange={(e) => setTargetMargin(e.target.value)} placeholder="20" />
            </Field>
          </div>

          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <h3 className="text-sm font-semibold mb-3">Resumo</h3>
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <Row label="Preço sugerido" value={brl(data.price)} strong />
              <Row label="Custo real do produto" value={brl(data.realCost)} />
              <Row label="Custo de marketing (Facebook Ads)" value={brl(data.adsCost)} tone="bad" />
              <Row label="Outras despesas variáveis" value={brl(data.otherVariableCost)} />
              <Row label="Despesas variáveis totais" value={brl(data.variableCost)} />
              <Row label="Lucro líquido" value={brl(data.profit)} strong tone={data.profit >= 0 ? "ok" : "bad"} />
              <Row label="Margem de lucro" value={`${data.marginPct.toFixed(2)}%`} />
              <Row label="Markup real" value={`${data.markupCalc.toFixed(2)}x`} />
              <Row label="Ponto de equilíbrio (preço mínimo)" value={brl(data.breakEven)} />
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "ok" | "bad" }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-card px-3 py-2 border border-border">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${strong ? "font-bold" : "font-medium"} ${tone === "ok" ? "text-primary" : tone === "bad" ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}
