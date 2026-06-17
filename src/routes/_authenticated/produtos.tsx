import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, type Product } from "@/lib/store";
import { brl, pct } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, AlertTriangle, Upload, X, Image as ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({ meta: [{ title: "Produtos — LucroTrack" }] }),
  component: ProdutosPage,
});

function ProdutosPage() {
  const { state, addProduct, updateProduct, deleteProduct } = useStore();
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <AppShell
      title="Produtos"
      subtitle="Cadastre seu catálogo e acompanhe margens de lucro"
      actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-2 h-4 w-4"/>Novo produto</Button>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {state.products.map((p) => {
          const margin = p.price ? ((p.price - p.cost) / p.price) * 100 : 0;
          const profit = p.price - p.cost;
          const low = p.stock <= p.minStock;
          return (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-5 shadow-elegant hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="h-14 w-14 rounded-lg object-cover shrink-0 border border-border" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg grid place-items-center bg-secondary/40 border border-border shrink-0">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{p.category}</div>
                    <div className="font-semibold truncate">{p.name}</div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => { setEditing(p); setOpen(true); }} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4"/></button>
                  <button onClick={() => { if (confirm("Excluir produto?")) deleteProduct(p.id); }} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4"/></button>
                </div>
              </div>
              {p.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{p.description}</p>}

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-[11px] uppercase text-muted-foreground">Custo</div><div className="font-medium">{brl(p.cost)}</div></div>
                <div><div className="text-[11px] uppercase text-muted-foreground">Venda</div><div className="font-medium">{brl(p.price)}</div></div>
                <div><div className="text-[11px] uppercase text-muted-foreground">Lucro/un</div><div className="font-semibold text-primary">{brl(profit)}</div></div>
                <div><div className="text-[11px] uppercase text-muted-foreground">Margem</div><div className="font-semibold text-primary">{pct(margin)}</div></div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Estoque: <span className="text-foreground font-medium">{p.stock}</span></span>
                {low && <span className="inline-flex items-center gap-1 text-warning"><AlertTriangle className="h-3.5 w-3.5"/>Estoque baixo</span>}
              </div>
            </div>
          );
        })}
      </div>

      <ProductDialog
        open={open}
        setOpen={setOpen}
        product={editing}
        onSave={(p) => {
          if (editing) { updateProduct(editing.id, p); toast.success("Produto atualizado"); }
          else { addProduct(p); toast.success("Produto criado"); }
          setOpen(false);
        }}
      />
    </AppShell>
  );
}

function ProductDialog({
  open, setOpen, product, onSave,
}: { open: boolean; setOpen: (v: boolean) => void; product: Product | null; onSave: (p: Omit<Product,"id">) => void }) {
  const [f, setF] = useState<Omit<Product, "id">>({
    name: "", category: "", cost: 0, price: 0, stock: 0, minStock: 0, description: "", imageUrl: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setF(product ?? { name: "", category: "", cost: 0, price: 0, stock: 0, minStock: 0, description: "", imageUrl: "" });
  }, [open, product]);

  function onImageFile(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Selecione um arquivo de imagem"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem muito grande (máx 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => setF((prev) => ({ ...prev, imageUrl: String(reader.result || "") }));
    reader.readAsDataURL(file);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><span/></DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>Os cálculos de lucro e margem são automáticos.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Imagem do produto (aparece no resumo do checkout)">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) onImageFile(file); }}
            />
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 shrink-0 rounded-lg border border-border bg-background/40 grid place-items-center overflow-hidden">
                {f.imageUrl ? (
                  <img src={f.imageUrl} alt="produto" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />Enviar imagem
                </Button>
                {f.imageUrl && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setF({ ...f, imageUrl: "" })}>
                    <X className="mr-2 h-4 w-4" />Remover
                  </Button>
                )}
              </div>
            </div>
          </Field>
          <Field label="Ou cole uma URL de imagem">
            <Input
              value={f.imageUrl?.startsWith("data:") ? "" : (f.imageUrl ?? "")}
              onChange={(e) => setF({ ...f, imageUrl: e.target.value })}
              placeholder="https://..."
            />
          </Field>
          <Field label="Nome"><Input value={f.name} onChange={(e) => setF({...f, name: e.target.value})}/></Field>
          <Field label="Categoria"><Input value={f.category} onChange={(e) => setF({...f, category: e.target.value})}/></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço de custo (R$)"><Input type="number" step="0.01" value={f.cost} onChange={(e) => setF({...f, cost: Number(e.target.value)})}/></Field>
            <Field label="Preço de venda (R$)"><Input type="number" step="0.01" value={f.price} onChange={(e) => setF({...f, price: Number(e.target.value)})}/></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estoque"><Input type="number" value={f.stock} onChange={(e) => setF({...f, stock: Number(e.target.value)})}/></Field>
            <Field label="Estoque mínimo"><Input type="number" value={f.minStock} onChange={(e) => setF({...f, minStock: Number(e.target.value)})}/></Field>
          </div>
          <Field label="Descrição"><Textarea value={f.description} onChange={(e) => setF({...f, description: e.target.value})}/></Field>

          <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/40 border border-border p-3 text-sm">
            <div><div className="text-[11px] uppercase text-muted-foreground">Lucro/un</div><div className="font-semibold text-primary">{brl(f.price - f.cost)}</div></div>
            <div><div className="text-[11px] uppercase text-muted-foreground">Margem</div><div className="font-semibold text-primary">{pct(f.price ? ((f.price - f.cost) / f.price) * 100 : 0)}</div></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => { if (!f.name) { toast.error("Informe o nome"); return; } onSave(f); }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
