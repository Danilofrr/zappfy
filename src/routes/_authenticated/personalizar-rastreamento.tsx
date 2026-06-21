import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import {
  PIN_COLORS,
  PIN_OPTIONS,
  STATUS_INFO,
  TIMELINE_STEPS,
  VEHICLE_COLORS,
  VEHICLE_OPTIONS,
  vehicleSvgPath,
} from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/personalizar-rastreamento")({
  head: () => ({ meta: [{ title: "Página de Rastreamento — ZappFy" }] }),
  component: Page,
});

type Settings = {
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  button_color: string;
  text_color: string;
  card_color: string;
  timeline_color: string;
  tracking_page_title: string;
  tracking_page_subtitle: string;
  welcome_message: string;
  delivered_message: string;
  support_whatsapp: string | null;
  show_store_logo: boolean;
  show_courier_name: boolean;
  show_courier_phone: boolean;
  show_estimated_time: boolean;
  show_distance: boolean;
  vehicle_type: "moto" | "carro";
  vehicle_color: string;
  vehicle_custom_url: string | null;
  pin_color: string;
  pin_custom_url: string | null;
  msg_aguardando: string;
  msg_preparando: string;
  msg_saiu: string;
  msg_chegando: string;
  msg_entregue: string;
  msg_cancelado: string;
};

const DEFAULTS: Settings = {
  logo_url: "",
  primary_color: "#10b981",
  secondary_color: "#0b1220",
  background_color: "#0b1220",
  button_color: "#10b981",
  text_color: "#ffffff",
  card_color: "#0b1220",
  timeline_color: "#10b981",
  tracking_page_title: "Acompanhe sua entrega",
  tracking_page_subtitle: "Veja em tempo real onde está seu pedido",
  welcome_message: "Seu pedido está a caminho!",
  delivered_message: "Pedido entregue com sucesso. Obrigado pela preferência!",
  support_whatsapp: "",
  show_store_logo: true,
  show_courier_name: true,
  show_courier_phone: false,
  show_estimated_time: true,
  show_distance: true,
  vehicle_type: "moto",
  vehicle_color: "verde",
  vehicle_custom_url: "",
  pin_color: "verde",
  pin_custom_url: "",
  msg_aguardando: "Recebemos seu pedido e já estamos preparando tudo.",
  msg_preparando: "Seu pedido está sendo preparado com carinho.",
  msg_saiu: "Seu pedido já saiu para entrega e está a caminho.",
  msg_chegando: "Seu entregador está próximo do destino.",
  msg_entregue: "Pedido entregue com sucesso. Obrigado pela preferência.",
  msg_cancelado: "Este pedido foi cancelado.",
};

function Page() {
  const [f, setF] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id ?? null;
      setUserId(uid);
      if (!uid) { setLoading(false); return; }
      const { data } = await supabase
        .from("delivery_tracking_settings")
        .select("*")
        .eq("store_id", uid)
        .maybeSingle();
      if (data) {
        const clean: Partial<Settings> = {};
        for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) {
          const v = (data as any)[k];
          if (v !== null && v !== undefined) (clean as any)[k] = v;
        }
        setF({ ...DEFAULTS, ...clean });
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!userId) return;
    setSaving(true);
    const payload = {
      ...f,
      store_id: userId,
      logo_url: f.logo_url || null,
      support_whatsapp: f.support_whatsapp || null,
      vehicle_custom_url: f.vehicle_custom_url || null,
      pin_custom_url: f.pin_custom_url || null,
    };
    const { error } = await supabase
      .from("delivery_tracking_settings")
      .upsert(payload, { onConflict: "store_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Personalização salva!");
  }

  function up<K extends keyof Settings>(key: K, value: Settings[K]) { setF((p) => ({ ...p, [key]: value })); }

  if (loading) {
    return (
      <AppShell title="Página de Rastreamento" subtitle="Personalize a página que o cliente vê">
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Página de Rastreamento"
      subtitle="Personalize cores, textos, ícones e o que aparece para o cliente"
      actions={<Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Salvar</Button>}
    >
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card title="Identidade visual">
            <Field label="URL da logo">
              <Input value={f.logo_url || ""} onChange={(e) => up("logo_url", e.target.value)} placeholder="https://…" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Cor principal" value={f.primary_color} onChange={(v) => up("primary_color", v)} />
              <ColorField label="Cor secundária" value={f.secondary_color} onChange={(v) => up("secondary_color", v)} />
              <ColorField label="Cor de fundo" value={f.background_color} onChange={(v) => up("background_color", v)} />
              <ColorField label="Cor dos cards" value={f.card_color} onChange={(v) => up("card_color", v)} />
              <ColorField label="Cor dos botões" value={f.button_color} onChange={(v) => up("button_color", v)} />
              <ColorField label="Cor do texto" value={f.text_color} onChange={(v) => up("text_color", v)} />
              <ColorField label="Cor da timeline" value={f.timeline_color} onChange={(v) => up("timeline_color", v)} />
            </div>
          </Card>

          <Card title="Personalização do Mapa">
            <div className="space-y-2">
              <Label className="text-xs">Veículo do entregador</Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {VEHICLE_OPTIONS.map((opt) => {
                  const selected = !f.vehicle_custom_url && f.vehicle_type === opt.type && f.vehicle_color === opt.color;
                  return (
                    <button
                      key={`${opt.type}-${opt.color}`}
                      type="button"
                      onClick={() => { up("vehicle_type", opt.type as any); up("vehicle_color", opt.color); up("vehicle_custom_url", ""); }}
                      className={`rounded-xl border p-2 flex flex-col items-center gap-1 text-[10px] transition ${selected ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/40"}`}
                      title={opt.label}
                    >
                      <VehicleSwatch type={opt.type as any} color={opt.color} />
                      <span className="leading-tight text-center">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Input
                  value={f.vehicle_custom_url || ""}
                  onChange={(e) => up("vehicle_custom_url", e.target.value)}
                  placeholder="URL de ícone personalizado (PNG)"
                />
              </div>
            </div>

            <div className="space-y-2 pt-3">
              <Label className="text-xs">Marcador de destino</Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {PIN_OPTIONS.map((opt) => {
                  const selected = !f.pin_custom_url && f.pin_color === opt.color;
                  return (
                    <button
                      key={opt.color}
                      type="button"
                      onClick={() => { up("pin_color", opt.color); up("pin_custom_url", ""); }}
                      className={`rounded-xl border p-2 flex flex-col items-center gap-1 text-[10px] transition ${selected ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/40"}`}
                      title={opt.label}
                    >
                      <PinSwatch color={opt.color} />
                      <span className="leading-tight text-center">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Input
                  value={f.pin_custom_url || ""}
                  onChange={(e) => up("pin_custom_url", e.target.value)}
                  placeholder="URL de pino personalizado (PNG)"
                />
              </div>
            </div>
          </Card>

          <Card title="Textos da página">
            <Field label="Título"><Input value={f.tracking_page_title} onChange={(e) => up("tracking_page_title", e.target.value)} /></Field>
            <Field label="Subtítulo"><Input value={f.tracking_page_subtitle} onChange={(e) => up("tracking_page_subtitle", e.target.value)} /></Field>
            <Field label="WhatsApp de suporte (com DDI)">
              <Input value={f.support_whatsapp || ""} onChange={(e) => up("support_whatsapp", e.target.value)} placeholder="5581999990000" />
            </Field>
          </Card>

          <Card title="Mensagens por status">
            <Field label="🟡 Pedido Recebido"><Textarea rows={2} value={f.msg_aguardando} onChange={(e) => up("msg_aguardando", e.target.value)} /></Field>
            <Field label="🟠 Preparando Pedido"><Textarea rows={2} value={f.msg_preparando} onChange={(e) => up("msg_preparando", e.target.value)} /></Field>
            <Field label="🛵 Saiu para Entrega"><Textarea rows={2} value={f.msg_saiu} onChange={(e) => up("msg_saiu", e.target.value)} /></Field>
            <Field label="📍 Chegando"><Textarea rows={2} value={f.msg_chegando} onChange={(e) => up("msg_chegando", e.target.value)} /></Field>
            <Field label="✅ Entregue"><Textarea rows={2} value={f.msg_entregue} onChange={(e) => up("msg_entregue", e.target.value)} /></Field>
            <Field label="❌ Cancelado"><Textarea rows={2} value={f.msg_cancelado} onChange={(e) => up("msg_cancelado", e.target.value)} /></Field>
          </Card>

          <Card title="O que mostrar ao cliente">
            <ToggleRow label="Mostrar logo da loja" value={f.show_store_logo} onChange={(v) => up("show_store_logo", v)} />
            <ToggleRow label="Mostrar nome do motoboy" value={f.show_courier_name} onChange={(v) => up("show_courier_name", v)} />
            <ToggleRow label="Mostrar telefone do motoboy" value={f.show_courier_phone} onChange={(v) => up("show_courier_phone", v)} />
            <ToggleRow label="Mostrar tempo estimado" value={f.show_estimated_time} onChange={(v) => up("show_estimated_time", v)} />
            <ToggleRow label="Mostrar distância" value={f.show_distance} onChange={(v) => up("show_distance", v)} />
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 self-start">
          <div className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><Eye className="h-3.5 w-3.5" /> Pré-visualização</div>
            <Preview f={f} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function VehicleSwatch({ type, color }: { type: "moto" | "carro"; color: string }) {
  const hex = VEHICLE_COLORS[color] ?? "#10b981";
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", background: hex, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${hex}55` }}>
      <svg viewBox="0 0 24 24" width="22" height="22" dangerouslySetInnerHTML={{ __html: vehicleSvgPath(type) }} />
    </div>
  );
}

function PinSwatch({ color }: { color: string }) {
  const hex = PIN_COLORS[color] ?? "#10b981";
  return (
    <svg viewBox="0 0 24 32" width="26" height="32">
      <path d="M12 0C5.4 0 0 5.3 0 11.8 0 21 12 32 12 32s12-11 12-20.2C24 5.3 18.6 0 12 0Z" fill={hex} />
      <circle cx="12" cy="11.5" r="4.5" fill="white" />
    </svg>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>);
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function Preview({ f }: { f: Settings }) {
  const info = STATUS_INFO.saiu_para_entrega;
  const cardBg = f.card_color || f.secondary_color;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: f.background_color, color: f.text_color, minHeight: 520 }}>
      <div className="px-5 pt-6 pb-5 text-center" style={{ background: `linear-gradient(180deg, ${f.secondary_color}, transparent)` }}>
        {f.show_store_logo && f.logo_url && <img src={f.logo_url} alt="logo" className="h-12 w-auto mx-auto mb-2 object-contain" />}
        <div className="text-base font-bold">{f.tracking_page_title}</div>
        <div className="text-xs opacity-70">{f.tracking_page_subtitle}</div>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: `${f.primary_color}22`, color: f.primary_color, border: `1px solid ${f.primary_color}55` }}>
          <span>{info.emoji}</span> {info.label}
          <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: f.primary_color }} />
        </div>
      </div>
      <div className="px-4 space-y-3">
        <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${f.primary_color}33` }}>
          <div className="text-[10px] uppercase opacity-60">Pedido</div>
          <div className="font-bold">#A1B2C3D4</div>
          <p className="text-xs opacity-90 mt-2">{f.msg_saiu}</p>
        </div>
        <div className="rounded-xl p-4 flex items-center justify-around" style={{ background: cardBg, border: `1px solid ${f.primary_color}22` }}>
          <div className="flex flex-col items-center gap-1">
            <VehicleSwatch type={f.vehicle_type} color={f.vehicle_color} />
            <span className="text-[10px] opacity-70">Entregador</span>
          </div>
          <div className="opacity-40 text-2xl">→</div>
          <div className="flex flex-col items-center gap-1">
            <PinSwatch color={f.pin_color} />
            <span className="text-[10px] opacity-70">Destino</span>
          </div>
        </div>
        <div className="rounded-xl p-4" style={{ background: cardBg, border: `1px solid ${f.primary_color}22` }}>
          <div className="text-xs font-semibold mb-3">Acompanhamento</div>
          <ol className="relative space-y-3 pl-6">
            <span className="absolute left-2.5 top-2 bottom-2 w-px" style={{ background: `${f.timeline_color}33` }} />
            {TIMELINE_STEPS.map((step, i) => {
              const filled = i <= 2;
              return (
                <li key={step.key} className="relative">
                  <span className="absolute -left-[22px] top-0.5 h-4 w-4 rounded-full" style={{ background: filled ? f.timeline_color : "transparent", border: `2px solid ${filled ? f.timeline_color : `${f.timeline_color}55`}` }} />
                  <div className="text-[11px]" style={{ color: filled ? f.timeline_color : undefined, opacity: filled ? 1 : 0.6 }}>{step.label}</div>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="rounded-xl p-3 text-center text-xs font-semibold" style={{ background: f.button_color, color: "#fff" }}>
          Falar com a loja
        </div>
      </div>
    </div>
  );
}
