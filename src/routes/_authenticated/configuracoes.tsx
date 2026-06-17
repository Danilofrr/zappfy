import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Moon, Sun, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — LucroTrack" }] }),
  component: Page,
});

function Page() {
  const { state, updateSettings, resetSeed } = useStore();
  const [f, setF] = useState(state.settings);

  // Keep local form in sync when settings load asynchronously.
  useEffect(() => { setF(state.settings); }, [state.settings]);

  return (
    <AppShell
      title="Configurações"
      subtitle="Personalize sua loja, o checkout e suas metas"
      actions={
        <Button
          variant="outline"
          onClick={() => {
            if (confirm("Carregar dados de exemplo? Eles serão somados aos seus dados atuais.")) {
              resetSeed();
              toast.success("Dados de exemplo carregados");
            }
          }}
        >
          <RotateCcw className="mr-2 h-4 w-4" />Carregar exemplos
        </Button>
      }
    >
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Dados da loja">
          <Field label="Nome da Loja"><Input value={f.storeName} onChange={(e) => setF({ ...f, storeName: e.target.value })} /></Field>
          <Field label="WhatsApp (com DDI, só números)"><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="5581999990000" /></Field>
          <Field label="Chave PIX"><Input value={f.pixKey} onChange={(e) => setF({ ...f, pixKey: e.target.value })} /></Field>
          <Field label="Endereço"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        </Card>

        <Card title="Metas e operação">
          <Field label="Taxa de entrega padrão (R$)">
            <Input type="number" step="0.01" value={f.deliveryFee} onChange={(e) => setF({ ...f, deliveryFee: Number(e.target.value) })} />
          </Field>
          <Field label="Meta mensal de faturamento (R$)">
            <Input type="number" step="0.01" value={f.monthlyRevenueGoal} onChange={(e) => setF({ ...f, monthlyRevenueGoal: Number(e.target.value) })} />
          </Field>
          <Field label="Meta mensal de lucro (R$)">
            <Input type="number" step="0.01" value={f.monthlyProfitGoal} onChange={(e) => setF({ ...f, monthlyProfitGoal: Number(e.target.value) })} />
          </Field>
        </Card>

        <Card title="Personalização do checkout">
          <Field label="URL do logo (opcional)">
            <Input
              value={f.checkoutLogoUrl}
              onChange={(e) => setF({ ...f, checkoutLogoUrl: e.target.value })}
              placeholder="https://..."
            />
          </Field>

          <Field label="Cor de fundo do checkout">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={f.checkoutBgColor || "#0a0a0a"}
                onChange={(e) => setF({ ...f, checkoutBgColor: e.target.value })}
                className="h-10 w-14 rounded-md border border-border bg-transparent cursor-pointer"
              />
              <Input
                value={f.checkoutBgColor}
                onChange={(e) => setF({ ...f, checkoutBgColor: e.target.value })}
                placeholder="#0a0a0a"
              />
            </div>
          </Field>

          <Field label="Tema do checkout">
            <div className="grid grid-cols-2 gap-2">
              {(["dark", "light"] as const).map((t) => {
                const active = f.checkoutTheme === t;
                const Icon = t === "dark" ? Moon : Sun;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setF({ ...f, checkoutTheme: t })}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {t === "dark" ? "Escuro" : "Claro"}
                  </button>
                );
              })}
            </div>
          </Field>
        </Card>

        <Card title="Pré-visualização do checkout">
          <div
            className={`rounded-xl border border-border p-5 ${f.checkoutTheme === "light" ? "light" : "dark"}`}
            style={{ backgroundColor: f.checkoutBgColor || "#0a0a0a", color: f.checkoutTheme === "light" ? "#0f172a" : "#f8fafc" }}
          >
            <div className="flex items-center gap-3">
              {f.checkoutLogoUrl ? (
                <img src={f.checkoutLogoUrl} alt="logo" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-primary/30 grid place-items-center">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <div>
                <div className="font-bold">{f.storeName || "Sua loja"}</div>
                <div className="text-xs opacity-70">Checkout rápido</div>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-border/60 p-3 text-sm opacity-90">
              Resumo do pedido · Total destacado em neon
            </div>
          </div>
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
    <div className="rounded-2xl border border-border bg-card p-5 lg:p-6 card-neon">
      <div className="text-sm font-semibold mb-4">{title}</div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
