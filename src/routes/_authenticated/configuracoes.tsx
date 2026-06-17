import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, Moon, Sun, Image as ImageIcon, Upload, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — LucroTrack" }] }),
  component: Page,
});

function Page() {
  const { state, updateSettings, resetSeed } = useStore();
  const [f, setF] = useState(state.settings);
  const [logoDims, setLogoDims] = useState<{ w: number; h: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onLogoFile(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem muito grande (máx 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setF((prev) => ({ ...prev, checkoutLogoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (!f.checkoutLogoUrl) { setLogoDims(null); return; }
    const img = new Image();
    img.onload = () => setLogoDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setLogoDims(null);
    img.src = f.checkoutLogoUrl;
  }, [f.checkoutLogoUrl]);

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
          <Field label="Logo da loja (upload do PC)">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) onLogoFile(file); }}
            />
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 rounded-lg border border-border bg-background/40 grid place-items-center overflow-hidden">
                {f.checkoutLogoUrl ? (
                  <img src={f.checkoutLogoUrl} alt="logo" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 grid gap-1.5">
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" />Enviar imagem
                  </Button>
                  {f.checkoutLogoUrl && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setF({ ...f, checkoutLogoUrl: "" })}>
                      <X className="mr-2 h-4 w-4" />Remover
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {logoDims ? `Tamanho real: ${logoDims.w} × ${logoDims.h}px` : "PNG, JPG ou WebP — até 2MB"}
                </p>
              </div>
            </div>
          </Field>

          <Field label="Ou cole uma URL de imagem">
            <Input
              value={f.checkoutLogoUrl.startsWith("data:") ? "" : f.checkoutLogoUrl}
              onChange={(e) => setF({ ...f, checkoutLogoUrl: e.target.value })}
              placeholder="https://..."
            />
          </Field>

          <Field label="WhatsApp da LOJA — recebe os pedidos (DDI + DDD, só números)">
            <Input
              value={f.whatsapp}
              onChange={(e) => setF({ ...f, whatsapp: e.target.value })}
              placeholder="5581999990000"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Cor de fundo" value={f.checkoutBgColor} onChange={(v) => setF({ ...f, checkoutBgColor: v })} />
            <ColorField label="Cor dos cards" value={f.checkoutCardColor} onChange={(v) => setF({ ...f, checkoutCardColor: v })} />
            <ColorField label="Cor das escritas" value={f.checkoutTextColor} onChange={(v) => setF({ ...f, checkoutTextColor: v })} />
            <ColorField label="Cor do neon" value={f.checkoutNeonColor} onChange={(v) => setF({ ...f, checkoutNeonColor: v })} />
          </div>

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
            className="rounded-xl p-5"
            style={{ backgroundColor: f.checkoutBgColor || "#0a0a0a", color: f.checkoutTextColor }}
          >
            <div className="flex items-center gap-3">
              {f.checkoutLogoUrl ? (
                <img src={f.checkoutLogoUrl} alt="logo" className="h-10 w-10 rounded-lg object-contain bg-white/5" />
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
            <div
              className="mt-4 rounded-lg p-3 text-sm"
              style={{
                backgroundColor: f.checkoutCardColor,
                boxShadow: `0 0 18px ${f.checkoutNeonColor}55, inset 0 0 0 1px ${f.checkoutNeonColor}55`,
              }}
            >
              Resumo do pedido · <span style={{ color: f.checkoutNeonColor, textShadow: `0 0 8px ${f.checkoutNeonColor}` }}>Total em neon</span>
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

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 rounded-md border border-border bg-transparent cursor-pointer shrink-0"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#000000" />
      </div>
    </Field>
  );
}
