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
};

const DEFAULTS: Settings = {
  logo_url: "",
  primary_color: "#10b981",
  secondary_color: "#0b1220",
  background_color: "#0b1220",
  button_color: "#10b981",
  text_color: "#ffffff",
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
    const payload = { ...f, store_id: userId, logo_url: f.logo_url || null, support_whatsapp: f.support_whatsapp || null };
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
      subtitle="Personalize cores, textos e o que aparece para o cliente"
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
              <ColorField label="Cor dos botões" value={f.button_color} onChange={(v) => up("button_color", v)} />
              <ColorField label="Cor do texto" value={f.text_color} onChange={(v) => up("text_color", v)} />
            </div>
          </Card>

          <Card title="Textos da página">
            <Field label="Título"><Input value={f.tracking_page_title} onChange={(e) => up("tracking_page_title", e.target.value)} /></Field>
            <Field label="Subtítulo"><Input value={f.tracking_page_subtitle} onChange={(e) => up("tracking_page_subtitle", e.target.value)} /></Field>
            <Field label="Mensagem inicial"><Textarea rows={2} value={f.welcome_message} onChange={(e) => up("welcome_message", e.target.value)} /></Field>
            <Field label="Mensagem de pedido entregue"><Textarea rows={2} value={f.delivered_message} onChange={(e) => up("delivered_message", e.target.value)} /></Field>
            <Field label="WhatsApp de suporte (com DDI)">
              <Input value={f.support_whatsapp || ""} onChange={(e) => up("support_whatsapp", e.target.value)} placeholder="5581999990000" />
            </Field>
          </Card>

          <Card title="O que mostrar ao cliente">
            <ToggleRow label="Mostrar logo da loja" value={f.show_store_logo} onChange={(v) => up("show_store_logo", v)} />
            <ToggleRow label="Mostrar nome do motoboy" value={f.show_courier_name} onChange={(v) => up("show_courier_name", v)} />
            <ToggleRow label="Mostrar telefone do motoboy" value={f.show_courier_phone} onChange={(v) => up("show_courier_phone", v)} />
            <ToggleRow label="Mostrar tempo estimado" value={f.show_estimated_time} onChange={(v) => up("show_estimated_time", v)} />
            <ToggleRow label="Mostrar distância" value={f.show_distance} onChange={(v) => up("show_distance", v)} />
          </Card>
        </div>

        {/* Live preview */}
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
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: f.background_color, color: f.text_color, minHeight: 420 }}>
      <div className="px-5 pt-6 pb-5 text-center" style={{ background: `linear-gradient(180deg, ${f.secondary_color}, transparent)` }}>
        {f.show_store_logo && f.logo_url && <img src={f.logo_url} alt="logo" className="h-12 w-auto mx-auto mb-2 object-contain" />}
        <div className="text-base font-bold">{f.tracking_page_title}</div>
        <div className="text-xs opacity-70">{f.tracking_page_subtitle}</div>
        <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium" style={{ background: `${f.primary_color}22`, color: f.primary_color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: f.primary_color }} /> Saiu para entrega
        </div>
      </div>
      <div className="px-4 space-y-3">
        <div className="rounded-xl p-4" style={{ background: f.secondary_color, border: `1px solid ${f.primary_color}33` }}>
          <div className="text-[10px] uppercase opacity-60">Pedido</div>
          <div className="font-bold">#A1B2C3D4</div>
          <p className="text-xs opacity-90 mt-2">{f.welcome_message}</p>
        </div>
        <div className="rounded-xl p-3 text-center text-xs font-semibold" style={{ background: f.button_color, color: "#fff" }}>
          Falar com a loja
        </div>
      </div>
    </div>
  );
}
