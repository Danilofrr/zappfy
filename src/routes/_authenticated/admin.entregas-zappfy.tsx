import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HexColorPicker } from "react-colorful";
import { Loader2, Save, Bike, Eye, Upload, X } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/entregas-zappfy")({
  component: Page,
});

type Theme = {
  id?: string;
  logo_url: string | null;
  logo_size: number;
  header_color: string;
  header_text_color: string;
  background_color: string;
  card_color: string;
  card_border_color: string;
  card_shadow_color: string;
  card_radius: number;
  text_color: string;
  title_color: string;
  button_color: string;
  button_text_color: string;
  icon_color: string;
  footer_text: string;
  brand_name: string;
};

const DEFAULT: Theme = {
  logo_url: null,
  logo_size: 48,
  header_color: "#0f172a",
  header_text_color: "#ffffff",
  background_color: "#0b1220",
  card_color: "#0f172a",
  card_border_color: "#1e293b",
  card_shadow_color: "#000000",
  card_radius: 16,
  text_color: "#e5e7eb",
  title_color: "#ffffff",
  button_color: "#10b981",
  button_text_color: "#ffffff",
  icon_color: "#10b981",
  footer_text: "Powered by Zappfy",
  brand_name: "Entregas Zappfy",
};

function Page() {
  const [theme, setTheme] = useState<Theme>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("zappfy_central_settings").select("*").limit(1).maybeSingle();
    if (data) setTheme({ ...DEFAULT, ...(data as Theme) });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const payload = { ...theme };
    const { error } = theme.id
      ? await supabase.from("zappfy_central_settings").update(payload).eq("id", theme.id)
      : await supabase.from("zappfy_central_settings").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Personalização salva!");
    load();
  }

  function set<K extends keyof Theme>(k: K, v: Theme[K]) { setTheme((t) => ({ ...t, [k]: v })); }

  function Color({ k, label }: { k: keyof Theme; label: string }) {
    const val = ((theme[k] as string) || "#000000").toString();
    const safe = /^#[0-9a-fA-F]{6}$/.test(val) ? val : "#000000";
    return (
      <div>
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-2 mt-1">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Escolher ${label}`}
                className="h-9 w-12 rounded border border-border shrink-0"
                style={{ background: safe }}
              />
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-3 z-[100]"
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="space-y-2" onPointerDown={(e) => e.stopPropagation()}>
                <HexColorPicker
                  color={safe}
                  onChange={(c) => set(k, c as any)}
                  style={{ width: 220, height: 180 }}
                />
                <Input
                  value={val}
                  onChange={(e) => set(k, e.target.value as any)}
                  className="font-mono text-xs h-8"
                />
              </div>
            </PopoverContent>
          </Popover>
          <Input
            value={val}
            onChange={(e) => set(k, e.target.value as any)}
            className="font-mono text-xs"
          />
        </div>
      </div>
    );
  }

  return (
    <AdminShell title="Entregas Zappfy" subtitle="Identidade visual exclusiva da Central de Entregas (somente admin master)">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_420px] gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Identidade</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs">Nome da marca</Label>
                  <Input value={theme.brand_name} onChange={(e) => set("brand_name", e.target.value)} />
                </div>
                <LogoField
                  value={theme.logo_url}
                  size={theme.logo_size}
                  onChangeUrl={(v) => set("logo_url", v)}
                  onChangeSize={(v) => set("logo_size", v)}
                />
                <div>
                  <Label className="text-xs">Texto do rodapé</Label>
                  <Input value={theme.footer_text} onChange={(e) => set("footer_text", e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Cores</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <Color k="header_color" label="Cabeçalho" />
                <Color k="header_text_color" label="Texto do cabeçalho" />
                <Color k="background_color" label="Fundo da página" />
                <Color k="card_color" label="Fundo do card" />
                <Color k="card_border_color" label="Borda do card" />
                <Color k="card_shadow_color" label="Sombra do card" />
                <Color k="text_color" label="Texto" />
                <Color k="title_color" label="Título" />
                <Color k="button_color" label="Botão" />
                <Color k="button_text_color" label="Texto do botão" />
                <Color k="icon_color" label="Ícones" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Cards</CardTitle></CardHeader>
              <CardContent>
                <Label className="text-xs">Arredondamento ({theme.card_radius}px)</Label>
                <input
                  type="range" min={0} max={32} value={theme.card_radius}
                  onChange={(e) => set("card_radius", Number(e.target.value))}
                  className="w-full mt-1"
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4" /> Pré-visualização</div>
            <div className="rounded-2xl overflow-hidden border border-border" style={{ background: theme.background_color, color: theme.text_color }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ background: theme.header_color, color: theme.header_text_color }}>
                {theme.logo_url ? (
                  <img
                    src={theme.logo_url}
                    alt=""
                    style={{ height: theme.logo_size, width: "auto" }}
                    className="object-contain"
                  />
                ) : (
                  <div
                    className="grid place-items-center rounded-lg"
                    style={{
                      height: theme.logo_size,
                      width: theme.logo_size,
                      background: theme.button_color,
                      color: theme.button_text_color,
                    }}
                  >
                    <Bike style={{ height: theme.logo_size * 0.5, width: theme.logo_size * 0.5 }} />
                  </div>
                )}
                <div className="leading-tight">
                  <div className="font-extrabold text-sm">{theme.brand_name}</div>
                  <div className="text-[10px] opacity-80">Central de Entregas</div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-xs opacity-70">Loja: <strong style={{ color: theme.title_color }}>Esparta Imports</strong></div>
                <div
                  className="p-3 space-y-2"
                  style={{
                    background: theme.card_color,
                    border: `1px solid ${theme.card_border_color}`,
                    boxShadow: `0 10px 26px -12px ${theme.card_shadow_color}88`,
                    borderRadius: theme.card_radius,
                  }}
                >
                  <div className="text-[10px] opacity-70">Pedido #ABC12345</div>
                  <div className="text-sm font-semibold" style={{ color: theme.title_color }}>Maria Silva</div>
                  <div className="text-xs">Av. das Flores, 123 — Centro</div>
                  <button className="w-full h-9 text-sm font-semibold rounded-lg" style={{ background: theme.button_color, color: theme.button_text_color }}>
                    Aceitar Entrega
                  </button>
                </div>
              </div>
              <div className="text-[10px] opacity-50 text-center py-3">{theme.footer_text}</div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
