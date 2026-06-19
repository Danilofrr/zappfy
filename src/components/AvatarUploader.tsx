import { useRef, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

const MAX_DIM = 256;
const MAX_BYTES = 1024 * 1024; // ~1MB on-disk source

async function fileToDataUrl(file: File): Promise<string> {
  if (file.size > MAX_BYTES * 5) throw new Error("Imagem muito grande (máx ~5MB)");
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("Falha ao ler arquivo"));
    fr.readAsDataURL(file);
  });
  // resize via canvas
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas indisponível"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Imagem inválida"));
    img.src = dataUrl;
  });
}

export function AvatarUploader({
  value,
  onChange,
  name,
  email,
  size = 80,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  name?: string | null;
  email?: string | null;
  size?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file?: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange(dataUrl);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao processar imagem");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <UserAvatar name={name} email={email} url={value} size={size} />
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
            {busy ? "Processando..." : value ? "Trocar foto" : "Enviar foto"}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
              <X className="h-4 w-4 mr-1" />
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG/PNG · será redimensionada para 256px.</p>
      </div>
    </div>
  );
}
