import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, ImageIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_DIMENSION = 640; // resize to keep payload small

async function fileToOptimizedDataUrl(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("Falha ao ler arquivo"));
    fr.readAsDataURL(file);
  });
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas indisponível"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Imagem inválida"));
    img.src = dataUrl;
  });
}

export function LogoUploader({
  value,
  onChange,
  hint,
  label = "Logo da Plataforma",
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  hint?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file?: File | null) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      return toast.error("Formato inválido. Use PNG, JPG, JPEG ou WEBP.");
    }
    if (file.size > MAX_BYTES) {
      return toast.error("Arquivo muito grande. Limite: 5MB.");
    }
    setBusy(true);
    try {
      const optimized = await fileToOptimizedDataUrl(file);
      onChange(optimized);
      toast.success("Logo carregada. Lembre de salvar as configurações.");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao processar imagem");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">{label}</div>

      {value ? (
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <div className="h-20 w-32 rounded-lg bg-background border border-border grid place-items-center overflow-hidden shrink-0">
            <img src={value} alt="logo" className="max-h-16 max-w-28 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground mb-2">Logo atual</div>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {busy ? "Processando..." : "Trocar logo"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Remover
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "group flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-all",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/20 hover:border-primary/60 hover:bg-muted/40",
          )}
        >
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/20 group-hover:bg-primary/20 transition-colors">
            <ImageIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="text-sm font-medium">
            {busy ? "Processando..." : "Clique para enviar ou arraste sua logo aqui"}
          </div>
          <div className="text-xs text-muted-foreground">PNG, JPG, JPEG ou WEBP — até 5MB</div>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
