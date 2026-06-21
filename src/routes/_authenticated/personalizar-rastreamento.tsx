import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Save, Loader2, Eye, MapPin, Bike, Phone } from "lucide-react";
import { toast } from "sonner";
import {
  PIN_COLORS,
  PIN_OPTIONS,
  STATUS_BADGE_DEFAULTS,
  STATUS_INFO,
  TIMELINE_STEPS,
  VEHICLE_COLORS,
  VEHICLE_OPTIONS,
  vehicleSvgPath,
  type DeliveryStatus,
  type StatusBadgeStyle,
} from "@/lib/tracking";

export const Route = createFileRoute("/_authenticated/personalizar-rastreamento")({
  head: () => ({ meta: [{ title: "Página de Rastreamento — ZappFy" }] }),
  component: Page,
});

type StatusStylesMap = Partial<Record<DeliveryStatus, Partial<StatusBadgeStyle>>>;

type Settings = {
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  button_color: string;
  text_color: string;
  title_color: string;
  card_color: string;
  card_border_color: string;
  card_opacity: number;
  card_glass: boolean;
  card_shadow: "none" | "sm" | "md" | "lg" | "xl";
  card_shadow_color: string;
  card_radius: number;
  border_intensity: number;
  status_color: string;
  status_styles: StatusStylesMap;
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
  background_color: "#020817",
  button_color: "#10b981",
  text_color: "#e5e7eb",
  title_color: "#ffffff",
  card_color: "#0f172a",
  card_border_color: "#1e293b",
  card_opacity: 1,
  card_glass: false,
  card_shadow: "md",
  card_shadow_color: "#000000",
  card_radius: 16,
  border_intensity: 1,
  status_color: "#10b981",
  status_styles: {},
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

const BG_PRESETS = [
  { name: "Preto", color: "#020817" },
  { name: "Azul escuro", color: "#0c1d3b" },
  { name: "Cinza", color: "#1f2937" },
  { name: "Branco", color: "#ffffff" },
  { name: "Gradiente", color: "linear-gradient(180deg,#0b1220 0%,#1a2a4a 100%)" },
];

const SHADOW_OPTIONS = [
  { value: "none", label: "Sem" },
  { value: "sm", label: "Sutil" },
  { value: "md", label: "Média" },
  { value: "lg", label: "Forte" },
  { value: "xl", label: "Intensa" },
] as const;

const BADGE_STATUSES: DeliveryStatus[] = [
  "aguardando_motoboy",
  "preparando",
  "saiu_para_entrega",
  "chegando",
  "entregue",
];

function Page() {
  const [f, setF] = useState<Settings>(DEFAULTS);
  const [useSeparateCard, setUseSeparateCard] = useState(true);
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
        const merged = { ...DEFAULTS, ...clean };
        if (!merged.status_styles || typeof merged.status_styles !== "object") merged.status_styles = {};
        setF(merged);
        setUseSeparateCard(merged.card_color.trim().toLowerCase() !== merged.background_color.trim().toLowerCase());
      }
      setLoading(false);
    })();
  }, []);

  async function save() {
    if (!userId) return;
    setSaving(true);
    const effective = useSeparateCard ? f : { ...f, card_color: f.background_color };
    const payload = {
      ...effective,
      store_id: userId,
      logo_url: f.logo_url || null,
      support_whatsapp: f.support_whatsapp || null,
      vehicle_custom_url: f.vehicle_custom_url || null,
      pin_custom_url: f.pin_custom_url || null,
      status_styles: f.status_styles ?? {},
    };
    const { error } = await supabase
      .from("delivery_tracking_settings")
      .upsert(payload, { onConflict: "store_id" });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Personalização salva!");
  }

  function up<K extends keyof Settings>(key: K, value: Settings[K]) { setF((p) => ({ ...p, [key]: value })); }

  function upBadge(status: DeliveryStatus, part: keyof StatusBadgeStyle, value: string) {
    setF((p) => ({
      ...p,
      status_styles: {
        ...p.status_styles,
        [status]: { ...(p.status_styles?.[status] ?? {}), [part]: value },
      },
    }));
  }

  function resetBadge(status: DeliveryStatus) {
    setF((p) => {
      const next = { ...(p.status_styles ?? {}) };
      delete next[status];
      return { ...p, status_styles: next };
    });
  }

  if (loading) {
    return (
      <AppShell title="Página de Rastreamento" subtitle="Personalize a página que o cliente vê">
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      </AppShell>
    );
  }

  const effective: Settings = useSeparateCard ? f : { ...f, card_color: f.background_color };

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
              <ColorField label="Cor dos botões" value={f.button_color} onChange={(v) => up("button_color", v)} />
            </div>
          </Card>

          <Card title="Cores da página">
            <div className="space-y-1">
              <Label className="text-xs">Cor do fundo da página</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {BG_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => up("background_color", p.color)}
                    className={`h-9 px-3 rounded-lg text-xs border transition ${f.background_color === p.color ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/40"}`}
                    style={{ background: p.color, color: p.color === "#ffffff" ? "#000" : "#fff" }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={f.background_color.startsWith("#") ? f.background_color : "#0b1220"} onChange={(e) => up("background_color", e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer" />
                <Input value={f.background_color} onChange={(e) => up("background_color", e.target.value)} className="h-9" placeholder="#020817 ou linear-gradient(...)" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div>
                <div className="text-sm font-medium">Usar cor diferente para os cards</div>
                <div className="text-xs text-muted-foreground">Diferencia o fundo da página dos cartões internos</div>
              </div>
              <Switch checked={useSeparateCard} onCheckedChange={setUseSeparateCard} />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <ColorField label="Cor dos títulos" value={f.title_color} onChange={(v) => up("title_color", v)} />
              <ColorField label="Cor dos textos" value={f.text_color} onChange={(v) => up("text_color", v)} />
              <ColorField label="Cor da timeline" value={f.timeline_color} onChange={(v) => up("timeline_color", v)} />
            </div>
          </Card>

          <Card title="Cards (independente do fundo)">
            <p className="text-xs text-muted-foreground -mt-2 mb-1">
              Estas configurações alteram apenas os cards internos (pedido, timeline, endereço, motoboy). Não afetam o fundo da página, badges ou botões.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Cor de fundo do card" value={f.card_color} onChange={(v) => up("card_color", v)} />
              <ColorField label="Cor da borda" value={f.card_border_color} onChange={(v) => up("card_border_color", v)} />
              <ColorField label="Cor da sombra" value={f.card_shadow_color} onChange={(v) => up("card_shadow_color", v)} />
            </div>


            <SliderField label={`Arredondamento dos cantos: ${f.card_radius}px`} min={0} max={32} step={1}
              value={f.card_radius} onChange={(v) => up("card_radius", v)} />

            <SliderField label={`Transparência dos cards: ${Math.round(f.card_opacity * 100)}%`} min={20} max={100} step={5}
              value={Math.round(f.card_opacity * 100)} onChange={(v) => up("card_opacity", v / 100)} />

            <SliderField label={`Intensidade da borda: ${Math.round(f.border_intensity * 100)}%`} min={0} max={200} step={10}
              value={Math.round(f.border_intensity * 100)} onChange={(v) => up("border_intensity", v / 100)} />

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="text-sm font-medium">Glassmorphism</div>
                <div className="text-xs text-muted-foreground">Vidro fosco translúcido</div>
              </div>
              <Switch checked={f.card_glass} onCheckedChange={(v) => up("card_glass", v)} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Intensidade da sombra</Label>
              <div className="grid grid-cols-5 gap-2">
                {SHADOW_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => up("card_shadow", s.value)}
                    className={`h-9 rounded-lg text-xs border transition ${f.card_shadow === s.value ? "border-primary ring-2 ring-primary/40 bg-primary/10" : "border-border hover:border-primary/40"}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Badges por Status">
            <p className="text-xs text-muted-foreground -mt-2 mb-1">
              Cada status tem identidade visual própria — fundo, borda, texto e ícone são configurados separadamente.
            </p>
            {BADGE_STATUSES.map((s) => {
              const info = STATUS_INFO[s];
              const def = STATUS_BADGE_DEFAULTS[s];
              const cur = f.status_styles?.[s] ?? {};
              const style: StatusBadgeStyle = {
                bg: cur.bg || def.bg,
                border: cur.border || def.border,
                text: cur.text || def.text,
                icon: cur.icon || def.icon,
              };
              const Icon = info.Icon;
              return (
                <div key={s} className="rounded-xl border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
                      style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: style.icon }} />
                      {info.label}
                    </div>
                    <button type="button" onClick={() => resetBadge(s)} className="text-[11px] text-muted-foreground hover:text-foreground underline">Restaurar</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <ColorField label="Fundo" value={style.bg} onChange={(v) => upBadge(s, "bg", v)} />
                    <ColorField label="Borda" value={style.border} onChange={(v) => upBadge(s, "border", v)} />
                    <ColorField label="Texto" value={style.text} onChange={(v) => upBadge(s, "text", v)} />
                    <ColorField label="Ícone" value={style.icon} onChange={(v) => upBadge(s, "icon", v)} />
                  </div>
                </div>
              );
            })}
          </Card>

          <Card title="Ícone do entregador">
            <div className="space-y-2">
              <Label className="text-xs">Selecione o veículo</Label>
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
              <Input
                value={f.vehicle_custom_url || ""}
                onChange={(e) => up("vehicle_custom_url", e.target.value)}
                placeholder="URL de PNG personalizado"
              />
            </div>

            <div className="space-y-2 pt-3">
              <Label className="text-xs">Marcador de destino</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
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
              <Input
                value={f.pin_custom_url || ""}
                onChange={(e) => up("pin_custom_url", e.target.value)}
                placeholder="URL de pino personalizado (PNG)"
              />
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
            <Field label="📦 Pedido Recebido"><Textarea rows={2} value={f.msg_aguardando} onChange={(e) => up("msg_aguardando", e.target.value)} /></Field>
            <Field label="👨‍🍳 Preparando Pedido"><Textarea rows={2} value={f.msg_preparando} onChange={(e) => up("msg_preparando", e.target.value)} /></Field>
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2"><Eye className="h-3.5 w-3.5" /> Pré-visualização em tempo real</div>
            <Preview f={effective} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ---------- Card style helpers (shared with rastreio public page) ----------
function hexWithAlpha(hex: string, alpha: number): string {
  if (!hex || !hex.startsWith("#")) return hex;
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  const suffix = a.toString(16).padStart(2, "0");
  if (hex.length === 7) return hex + suffix;
  return hex;
}
function shadowFor(level: string, color: string): string {
  const c = color || "#000000";
  switch (level) {
    case "none": return "none";
    case "sm": return `0 2px 8px ${hexWithAlpha(c, 0.18)}`;
    case "lg": return `0 18px 40px -10px ${hexWithAlpha(c, 0.55)}`;
    case "xl": return `0 30px 60px -16px ${hexWithAlpha(c, 0.7)}`;
    default: return `0 10px 24px -8px ${hexWithAlpha(c, 0.4)}`;
  }
}
export function cardStyle(f: {
  card_color: string; card_border_color: string; card_opacity: number;
  card_glass: boolean; card_shadow: string; border_intensity: number;
  card_shadow_color?: string; card_radius?: number;
}): React.CSSProperties {
  const bg = f.card_glass ? hexWithAlpha(f.card_color, Math.min(f.card_opacity, 0.6)) : hexWithAlpha(f.card_color, f.card_opacity);
  const borderAlpha = Math.max(0, Math.min(1, f.border_intensity));
  const style: React.CSSProperties = {
    background: bg,
    border: `1px solid ${hexWithAlpha(f.card_border_color, borderAlpha)}`,
    boxShadow: shadowFor(f.card_shadow, f.card_shadow_color || "#000000"),
    borderRadius: (f.card_radius ?? 16) + "px",
  };
  if (f.card_glass) {
    (style as any).backdropFilter = "blur(20px) saturate(140%)";
  }
  return style;
}

function VehicleSwatch({ type, color }: { type: "moto" | "carro"; color: string }) {
  const hex = VEHICLE_COLORS[color] ?? "#10b981";
  return (
    <div style={{ width: 40, height: 40, borderRadius: "50%", background: hex, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 12px ${hex}55` }}>
      <svg viewBox="0 0 24 24" width="26" height="26" dangerouslySetInnerHTML={{ __html: vehicleSvgPath(type) }} />
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
        <input type="color" value={value && value.startsWith("#") ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-9 w-12 rounded border border-border bg-transparent cursor-pointer" />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
      </div>
    </div>
  );
}

function SliderField({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0])} />
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
  const status: DeliveryStatus = "saiu_para_entrega";
  const info = STATUS_INFO[status];
  const def = STATUS_BADGE_DEFAULTS[status];
  const cur = f.status_styles?.[status] ?? {};
  const badge: StatusBadgeStyle = { bg: cur.bg || def.bg, border: cur.border || def.border, text: cur.text || def.text, icon: cur.icon || def.icon };
  const cs = useMemo(() => cardStyle(f), [f]);
  const isGradient = f.background_color.includes("gradient");
  const BadgeIcon = info.Icon;
  return (
    <div
      className="rounded-2xl overflow-hidden transition-colors"
      style={{
        background: f.background_color,
        backgroundImage: isGradient ? f.background_color : undefined,
        color: f.text_color,
        minHeight: 560,
      }}
    >
      <div className="px-5 pt-6 pb-5 text-center" style={{ background: `linear-gradient(180deg, ${hexWithAlpha(f.secondary_color, 0.5)}, transparent)` }}>
        {f.show_store_logo && f.logo_url && <img src={f.logo_url} alt="logo" className="h-12 w-auto mx-auto mb-2 object-contain" />}
        <div className="text-base font-bold" style={{ color: f.title_color }}>{f.tracking_page_title}</div>
        <div className="text-xs opacity-70">{f.tracking_page_subtitle}</div>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}>
          <BadgeIcon className="h-3.5 w-3.5" style={{ color: badge.icon }} /> {info.label}
        </div>
      </div>
      <div className="px-4 space-y-3">
        <div className="p-4" style={cs}>
          <div className="text-[10px] uppercase opacity-60">Pedido</div>
          <div className="font-bold" style={{ color: f.title_color }}>#A1B2C3D4</div>
          <p className="text-xs mt-2" style={{ color: f.text_color }}>{f.msg_saiu}</p>
        </div>
        <div className="p-4 flex items-center justify-around" style={cs}>
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
        <div className="p-4" style={cs}>
          <div className="text-xs font-semibold mb-3" style={{ color: f.title_color }}>Acompanhamento</div>
          <ol className="relative space-y-3 pl-6">
            <span className="absolute left-2.5 top-2 bottom-2 w-px" style={{ background: hexWithAlpha(f.timeline_color, 0.2) }} />
            {TIMELINE_STEPS.map((step, i) => {
              const filled = i <= 2;
              return (
                <li key={step.key} className="relative">
                  <span className="absolute -left-[22px] top-0.5 h-4 w-4 rounded-full" style={{ background: filled ? f.timeline_color : "transparent", border: `2px solid ${filled ? f.timeline_color : hexWithAlpha(f.timeline_color, 0.35)}` }} />
                  <div className="text-[11px]" style={{ color: filled ? f.timeline_color : f.text_color, opacity: filled ? 1 : 0.6 }}>{step.label}</div>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="p-3 flex items-start gap-2 text-xs" style={cs}>
          <MapPin className="h-3.5 w-3.5 mt-0.5" style={{ color: f.primary_color }} />
          <div>
            <div className="font-medium" style={{ color: f.title_color }}>Endereço de entrega</div>
            <div className="opacity-80">Rua Exemplo, 123 — Centro</div>
          </div>
        </div>
        <div className="p-3 flex items-center gap-3 text-xs" style={cs}>
          <Bike className="h-4 w-4" style={{ color: f.primary_color }} />
          <div className="flex-1">
            <div className="font-medium" style={{ color: f.title_color }}>João Motoboy</div>
            <div className="opacity-70 flex items-center gap-1"><Phone className="h-3 w-3" /> (81) 99999-0000</div>
          </div>
        </div>
        <div className="p-3 text-center text-xs font-semibold" style={{ background: f.button_color, color: "#fff", borderRadius: (f.card_radius ?? 16) + "px" }}>
          Falar com a loja
        </div>
      </div>
    </div>
  );
}
