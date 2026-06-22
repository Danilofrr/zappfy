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
  login_logo_url: string | null;
  login_icon_url: string | null;
  login_bg_color: string;
  login_card_color: string;
  login_border_color: string;
  login_text_color: string;
  login_title_color: string;
  login_button_color: string;
  login_button_text_color: string;
  login_glow_color: string;
  login_title_text: string;
  login_subtitle_text: string;
  login_footer_text: string;
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
  login_logo_url: null,
  login_icon_url: null,
  login_bg_color: "#05070d",
  login_card_color: "#0b1220",
  login_border_color: "#1f2937",
  login_text_color: "#e5e7eb",
  login_title_color: "#ffffff",
  login_button_color: "#10b981",
  login_button_text_color: "#04140b",
  login_glow_color: "#10b981",
  login_title_text: "Entrar na sua conta",
  login_subtitle_text: "Acesse a Central de Entregas",
  login_footer_text: "Zappfy Entregas · © 2026",
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

  function LogoField({
    value,
    size,
    onChangeUrl,
    onChangeSize,
  }: {
    value: string | null;
    size: number;
    onChangeUrl: (v: string | null) => void;
    onChangeSize: (v: number) => void;
  }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);

    async function handleFile(file?: File | null) {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx 5MB)"); return; }
      setBusy(true);
      try {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as string);
          fr.onerror = () => reject(new Error("Falha ao ler arquivo"));
          fr.readAsDataURL(file);
        });
        // resize for storage
        const resized = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const MAX = 512;
            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("Canvas indisponível"));
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/png"));
          };
          img.onerror = () => reject(new Error("Imagem inválida"));
          img.src = dataUrl;
        });
        onChangeUrl(resized);
      } catch (e: any) {
        toast.error(e.message ?? "Erro ao processar imagem");
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="space-y-3">
        <Label className="text-xs">Logo da Central</Label>
        <div className="flex items-center gap-3">
          <div
            className="rounded-lg border border-border bg-muted/30 grid place-items-center overflow-hidden shrink-0"
            style={{ height: 80, width: 80 }}
          >
            {value ? (
              <img src={value} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <Bike className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
                <Upload className="h-4 w-4 mr-1" />
                {busy ? "Processando..." : value ? "Trocar logo" : "Enviar logo"}
              </Button>
              {value && (
                <Button type="button" size="sm" variant="ghost" onClick={() => onChangeUrl(null)}>
                  <X className="h-4 w-4 mr-1" /> Remover
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">PNG/JPG · será redimensionada para até 512px.</p>
          </div>
        </div>
        <div>
          <Label className="text-xs">Ou cole uma URL</Label>
          <Input
            value={value && value.startsWith("data:") ? "" : (value ?? "")}
            onChange={(e) => onChangeUrl(e.target.value || null)}
            placeholder="https://..."
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Tamanho do logo ({size}px)</Label>
          <input
            type="range" min={24} max={120} value={size}
            onChange={(e) => onChangeSize(Number(e.target.value))}
            className="w-full mt-1"
          />
        </div>
      </div>
    );
  }

  function IconField({
    value,
    onChangeUrl,
  }: {
    value: string | null;
    onChangeUrl: (v: string | null) => void;
  }) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);

    async function handleFile(file?: File | null) {
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande (máx 5MB)"); return; }
      setBusy(true);
      try {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as string);
          fr.onerror = () => reject(new Error("Falha ao ler arquivo"));
          fr.readAsDataURL(file);
        });
        const resized = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const MAX = 256;
            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx) return reject(new Error("Canvas indisponível"));
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/png"));
          };
          img.onerror = () => reject(new Error("Imagem inválida"));
          img.src = dataUrl;
        });
        onChangeUrl(resized);
      } catch (e: any) {
        toast.error(e.message ?? "Erro ao processar imagem");
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="space-y-3">
        <Label className="text-xs">Ícone principal (com brilho)</Label>
        <div className="flex items-center gap-3">
          <div
            className="rounded-lg border border-border bg-muted/30 grid place-items-center overflow-hidden shrink-0"
            style={{ height: 64, width: 64 }}
          >
            {value ? (
              <img src={value} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <Bike className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
                <Upload className="h-4 w-4 mr-1" />
                {busy ? "Processando..." : value ? "Trocar ícone" : "Enviar ícone"}
              </Button>
              {value && (
                <Button type="button" size="sm" variant="ghost" onClick={() => onChangeUrl(null)}>
                  <X className="h-4 w-4 mr-1" /> Remover
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">PNG transparente recomendado · até 256px.</p>
          </div>
        </div>
        <div>
          <Label className="text-xs">Ou cole uma URL</Label>
          <Input
            value={value && value.startsWith("data:") ? "" : (value ?? "")}
            onChange={(e) => onChangeUrl(e.target.value || null)}
            placeholder="https://..."
            className="mt-1"
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

            <Card>
              <CardHeader><CardTitle className="text-base">Tela de Login do Motoboy</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <LogoField
                  value={theme.login_logo_url}
                  size={theme.logo_size}
                  onChangeUrl={(v) => set("login_logo_url", v)}
                  onChangeSize={(v) => set("logo_size", v)}
                />
                <IconField
                  value={theme.login_icon_url}
                  onChangeUrl={(v) => set("login_icon_url", v)}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Color k="login_bg_color" label="Cor de fundo" />
                  <Color k="login_card_color" label="Cor do card" />
                  <Color k="login_border_color" label="Cor da borda" />
                  <Color k="login_text_color" label="Cor dos textos" />
                  <Color k="login_title_color" label="Cor do título" />
                  <Color k="login_button_color" label="Cor do botão" />
                  <Color k="login_button_text_color" label="Texto do botão" />
                  <Color k="login_glow_color" label="Brilho do ícone" />
                </div>
                <div>
                  <Label className="text-xs">Texto do título</Label>
                  <Input value={theme.login_title_text} onChange={(e) => set("login_title_text", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Subtítulo</Label>
                  <Input value={theme.login_subtitle_text} onChange={(e) => set("login_subtitle_text", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Rodapé</Label>
                  <Input value={theme.login_footer_text} onChange={(e) => set("login_footer_text", e.target.value)} />
                </div>
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

            <div className="flex items-center gap-2 text-sm font-semibold pt-2"><Eye className="h-4 w-4" /> Login do Motoboy</div>
            <div
              className="rounded-2xl overflow-hidden border border-border relative"
              style={{
                background: `radial-gradient(120% 80% at 50% -10%, color-mix(in oklab, ${theme.login_glow_color} 22%, transparent), transparent 60%), ${theme.login_bg_color}`,
                color: theme.login_text_color,
                minHeight: 480,
              }}
            >
              <div className="p-5 flex flex-col items-center gap-4">
                {(theme.login_logo_url || theme.logo_url) ? (
                  <img src={theme.login_logo_url || theme.logo_url || ""} alt="" style={{ height: 28 }} className="object-contain" />
                ) : (
                  <div className="text-xs font-bold" style={{ color: theme.login_title_color }}>{theme.brand_name}</div>
                )}

                <div
                  className="w-full rounded-2xl p-5 space-y-4 border backdrop-blur"
                  style={{
                    background: theme.login_card_color,
                    borderColor: theme.login_border_color,
                    boxShadow: `0 30px 60px -30px ${theme.login_glow_color}66`,
                  }}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-2xl blur-xl opacity-70" style={{ background: theme.login_glow_color }} />
                      <div
                        className="relative grid h-12 w-12 place-items-center rounded-2xl"
                        style={{
                          background: theme.login_button_color,
                          color: theme.login_button_text_color,
                          boxShadow: `0 8px 20px -6px ${theme.login_glow_color}`,
                        }}
                      >
                        {theme.login_icon_url ? (
                          <img src={theme.login_icon_url} alt="" className="h-7 w-7 object-contain" />
                        ) : (
                          <Bike className="h-6 w-6" />
                        )}
                      </div>
                    </div>
                    <div className="text-base font-bold" style={{ color: theme.login_title_color }}>{theme.login_title_text}</div>
                    <div className="text-[11px] opacity-70">{theme.login_subtitle_text}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[10px] uppercase opacity-60">WhatsApp</div>
                    <div className="h-9 rounded-md px-3 flex items-center text-xs" style={{ background: `color-mix(in oklab, ${theme.login_bg_color} 60%, #ffffff 6%)`, boxShadow: `0 0 0 1px ${theme.login_border_color} inset`, color: theme.login_title_color }}>5581999990000</div>
                    <div className="text-[10px] uppercase opacity-60 pt-1">Senha</div>
                    <div className="h-9 rounded-md px-3 flex items-center text-xs" style={{ background: `color-mix(in oklab, ${theme.login_bg_color} 60%, #ffffff 6%)`, boxShadow: `0 0 0 1px ${theme.login_border_color} inset`, color: theme.login_title_color }}>••••••••</div>
                  </div>

                  <button className="w-full h-10 rounded-xl text-sm font-bold" style={{ background: theme.login_button_color, color: theme.login_button_text_color, boxShadow: `0 10px 22px -10px ${theme.login_glow_color}` }}>
                    Entrar
                  </button>
                </div>

                <div className="text-[10px] opacity-50 text-center">{theme.login_footer_text}</div>
              </div>

            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
