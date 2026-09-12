import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download,
  Eye,
  FileImage,
  FileText,
  Loader2,
  Paperclip,
  Signature,
  Trash2,
} from "lucide-react";
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

type DeliveryEvidence = {
  proof_url: string | null;
  signature_url: string | null;
  completed_at: string | null;
  courier_name: string | null;
};

interface OrderReceiptsModalProps {
  order: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReceiptsChange?: () => void;
}

export function OrderReceiptsModal({
  order,
  open,
  onOpenChange,
  onReceiptsChange,
}: OrderReceiptsModalProps) {
  const { user } = useStore();
  const [receipts, setReceipts] = useState<OrderReceipt[]>([]);
  const [deliveryEvidence, setDeliveryEvidence] = useState<DeliveryEvidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  useEffect(() => {
    if (open && order?.id) loadAll();
  }, [open, order?.id]);

  async function loadAll() {
    if (!order?.id) return;
    setLoading(true);
    try {
      const [receiptsRes, deliveryRes] = await Promise.all([
        supabase
          .from("order_receipts")
          .select("*")
          .eq("order_id", order.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("delivery_tracking")
          .select("proof_url,signature_url,completed_at,courier_name")
          .eq("order_id", order.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (receiptsRes.error) throw receiptsRes.error;
      setReceipts((receiptsRes.data as OrderReceipt[]) || []);
      if (!deliveryRes.error && deliveryRes.data) {
        setDeliveryEvidence(deliveryRes.data as DeliveryEvidence);
      } else {
        setDeliveryEvidence(null);
      }
    } catch (error: any) {
      console.error("Erro ao carregar anexos:", error);
      toast.error("Não foi possível carregar os anexos do pedido.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !order?.id || !user?.id) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("O arquivo deve ter no máximo 10 MB.");
    if (!["image/png", "image/jpeg", "application/pdf"].includes(file.type)) {
      return toast.error("Apenas PNG, JPG e PDF são permitidos.");
    }

    setUploading(true);
    try {
      const storeId = order.store_id || user.id;
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = `${storeId}/${order.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from("order-receipts").upload(filePath, file);
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
      await loadAll();
      onReceiptsChange?.();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao enviar comprovante.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(receipt: OrderReceipt) {
    if (!confirm("Deseja realmente excluir este comprovante?")) return;
    try {
      const { error: storageError } = await supabase.storage.from("order-receipts").remove([receipt.file_path]);
      if (storageError) throw storageError;
      const { error: dbError } = await supabase.from("order_receipts").delete().eq("id", receipt.id);
      if (dbError) throw dbError;
      toast.success("Comprovante excluído.");
      await loadAll();
      onReceiptsChange?.();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir comprovante.");
    }
  }

  async function handleView(receipt: OrderReceipt) {
    try {
      const { data, error } = await supabase.storage.from("order-receipts").createSignedUrl(receipt.file_path, 60);
      if (error) throw error;
      if (receipt.file_type === "application/pdf") return window.open(data.signedUrl, "_blank");
      setPreviewTitle(receipt.file_name);
      setPreviewUrl(data.signedUrl);
    } catch {
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
    } catch {
      toast.error("Erro ao baixar arquivo.");
    }
  }

  const hasDeliveryProof = !!deliveryEvidence?.proof_url;
  const hasSignature = !!deliveryEvidence?.signature_url;
  const totalAttachments = receipts.length + (hasDeliveryProof ? 1 : 0) + (hasSignature ? 1 : 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-primary" /> Anexos do Pedido
            </DialogTitle>
          </DialogHeader>

          {order && (
            <div className="bg-secondary/20 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Cliente:</span><span className="font-medium text-right">{order.customer}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pedido:</span><span className="font-medium">#{order.id.slice(0, 8).toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Data:</span><span className="font-medium">{fmtDate(order.date)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valor:</span><span className="font-medium text-primary">{brl(order.total)}</span></div>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <div className="space-y-5">
              {(hasDeliveryProof || hasSignature) && (
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">Comprovação da entrega</h3>
                    <p className="text-xs text-muted-foreground">
                      Registrado pelo motoboy{deliveryEvidence?.courier_name ? ` ${deliveryEvidence.courier_name}` : ""}
                      {deliveryEvidence?.completed_at ? ` em ${fmtDate(deliveryEvidence.completed_at)}` : ""}.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {hasDeliveryProof && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewTitle("Comprovante de pagamento da entrega");
                          setPreviewUrl(deliveryEvidence!.proof_url);
                        }}
                        className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-left hover:bg-primary/10 transition"
                      >
                        <div className="flex items-center gap-2 font-medium"><FileImage className="h-4 w-4 text-primary" /> Comprovante de pagamento</div>
                        <img src={deliveryEvidence!.proof_url!} alt="Comprovante" className="mt-2 h-28 w-full rounded-lg object-cover bg-black/10" />
                        <div className="mt-2 text-xs text-muted-foreground">Toque para ampliar</div>
                      </button>
                    )}
                    {hasSignature && (
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewTitle("Assinatura do cliente");
                          setPreviewUrl(deliveryEvidence!.signature_url);
                        }}
                        className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-left hover:bg-primary/10 transition"
                      >
                        <div className="flex items-center gap-2 font-medium"><Signature className="h-4 w-4 text-primary" /> Assinatura do cliente</div>
                        <img src={deliveryEvidence!.signature_url!} alt="Assinatura" className="mt-2 h-28 w-full rounded-lg object-contain bg-white" />
                        <div className="mt-2 text-xs text-muted-foreground">Assinatura coletada na entrega</div>
                      </button>
                    )}
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Outros anexos ({totalAttachments})</h3>
                  <label className="inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-xs font-medium hover:bg-secondary/20">
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Paperclip className="h-4 w-4 mr-2" />}
                    Adicionar comprovante
                    <input type="file" className="hidden" accept=".png,.jpg,.jpeg,.pdf" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>

                {receipts.length === 0 ? (
                  <div className="text-center py-6 border-2 border-dashed border-border rounded-xl">
                    <FileText className="h-7 w-7 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-xs text-muted-foreground">Nenhum outro comprovante anexado.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {receipts.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                        <div className="h-10 w-10 rounded-lg bg-secondary/30 flex items-center justify-center shrink-0">
                          {r.file_type.startsWith("image/") ? <FileImage className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-blue-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{r.file_name}</div>
                          <div className="text-[10px] text-muted-foreground">{fmtDate(r.created_at)} · {(r.file_size / 1024).toFixed(0)} KB</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleView(r)} className="p-1.5 hover:text-primary" title="Visualizar"><Eye className="h-4 w-4" /></button>
                          <button onClick={() => handleDownload(r)} className="p-1.5 hover:text-primary" title="Baixar"><Download className="h-4 w-4" /></button>
                          <button onClick={() => handleDelete(r)} className="p-1.5 hover:text-destructive" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewUrl} onOpenChange={(next) => !next && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl bg-black/95 border-none text-white">
          <DialogHeader><DialogTitle>{previewTitle}</DialogTitle></DialogHeader>
          <div className="flex max-h-[75vh] items-center justify-center overflow-auto">
            <img src={previewUrl || ""} alt={previewTitle} className="max-h-[72vh] max-w-full object-contain" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
