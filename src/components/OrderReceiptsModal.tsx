import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Paperclip, Trash2, Eye, Download, Loader2, FileText, FileImage, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { brl, fmtDate } from "@/lib/format";
import { useStore } from "@/lib/store";

type OrderReceipt = {
  id: string;
  order_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
};

interface OrderReceiptsModalProps {
  order: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReceiptsChange?: () => void;
}

export function OrderReceiptsModal({ order, open, onOpenChange, onReceiptsChange }: OrderReceiptsModalProps) {
  const { user } = useStore();
  const [receipts, setReceipts] = useState<OrderReceipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);

  useEffect(() => {
    if (open && order?.id) {
      loadReceipts();
    }
  }, [open, order?.id]);

  async function loadReceipts() {
    if (!order?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("order_receipts")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReceipts(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar comprovantes:", error);
      toast.error("Não foi possível carregar os comprovantes.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !order?.id || !user?.id) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 10MB.");
      return;
    }

    const allowedTypes = ["image/png", "image/jpeg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Apenas PNG, JPG e PDF são permitidos.");
      return;
    }

    setUploading(true);
    try {
      const storeId = order.store_id || user.id;
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${storeId}/${order.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("order-receipts")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from("order_receipts").insert({
        order_id: order.id,
        store_id: storeId,
        user_id: user.id,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
      });

      if (dbError) throw dbError;

      toast.success("Comprovante enviado com sucesso!");
      loadReceipts();
      onReceiptsChange?.();
    } catch (error: any) {
      console.error("Erro no upload:", error);
      toast.error("Erro ao enviar comprovante.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(receipt: OrderReceipt) {
    if (!confirm("Deseja realmente excluir este comprovante?")) return;

    try {
      const { error: storageError } = await supabase.storage
        .from("order-receipts")
        .remove([receipt.file_path]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("order_receipts")
        .delete()
        .eq("id", receipt.id);

      if (dbError) throw dbError;

      toast.success("Comprovante excluído.");
      loadReceipts();
      onReceiptsChange?.();
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir comprovante.");
    }
  }

  async function handleView(receipt: OrderReceipt) {
    try {
      const { data, error } = await supabase.storage
        .from("order-receipts")
        .createSignedUrl(receipt.file_path, 60);

      if (error) throw error;
      
      if (receipt.file_type === "application/pdf") {
        window.open(data.signedUrl, "_blank");
      } else {
        setPreviewUrl(data.signedUrl);
        setPreviewType(receipt.file_type);
      }
    } catch (error: any) {
      console.error("Erro ao visualizar:", error);
      toast.error("Erro ao abrir arquivo.");
    }
  }

  async function handleDownload(receipt: OrderReceipt) {
    try {
      const { data, error } = await supabase.storage
        .from("order-receipts")
        .createSignedUrl(receipt.file_path, 60, { download: true });

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error: any) {
      console.error("Erro ao baixar:", error);
      toast.error("Erro ao baixar arquivo.");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-primary" />
              Comprovantes do Pedido
            </DialogTitle>
          </DialogHeader>

          {order && (
            <div className="bg-secondary/20 rounded-lg p-3 text-sm space-y-1 mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{order.customer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pedido:</span>
                <span className="font-medium">#{order.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data:</span>
                <span className="font-medium">{fmtDate(order.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor:</span>
                <span className="font-medium text-primary">{brl(order.total)}</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Anexos ({receipts.length})</h3>
              <div className="relative">
                <input
                  type="file"
                  id="receipt-upload"
                  className="hidden"
                  accept=".png,.jpg,.jpeg,.pdf"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
                <Button 
                  asChild 
                  variant="outline" 
                  size="sm" 
                  className="cursor-pointer"
                  disabled={uploading}
                >
                  <label htmlFor="receipt-upload">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Paperclip className="h-4 w-4 mr-2" />
                    )}
                    Adicionar comprovante
                  </label>
                </Button>
              </div>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : receipts.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhum comprovante anexado.</p>
                </div>
              ) : (
                receipts.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-secondary/10 transition-colors">
                    <div className="h-10 w-10 rounded-lg bg-secondary/30 flex items-center justify-center shrink-0">
                      {r.file_type.startsWith("image/") ? (
                        <FileImage className="h-5 w-5 text-primary" />
                      ) : (
                        <FileText className="h-5 w-5 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" title={r.file_name}>{r.file_name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {fmtDate(r.created_at)} · {(r.file_size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleView(r)} className="p-1.5 hover:text-primary transition-colors" title="Visualizar">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDownload(r)} className="p-1.5 hover:text-primary transition-colors" title="Baixar">
                        <Download className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(r)} className="p-1.5 hover:text-destructive transition-colors" title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal for Images */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => !open && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none">
          <div className="relative w-full h-[80vh] flex items-center justify-center">
            <img loading="lazy" decoding="async"
              src={previewUrl || ""} 
              alt="Preview" 
              className="max-w-full max-h-full object-contain"
            />
            <button 
              onClick={() => setPreviewUrl(null)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
