import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Store as StoreIcon, Loader2, Trash2 } from "lucide-react";
import { useActiveStore } from "@/lib/active-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function StoreSwitcher({ compact = false }: { compact?: boolean }) {
  const { stores, activeStore, activeStoreId, switchStore, createStore, deleteStore, loading } = useActiveStore();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteStore(deleteTarget.id);
      toast.success(`Loja "${deleteTarget.name}" excluída`);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir loja");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Informe o nome da loja");
      return;
    }
    setSaving(true);
    try {
      const s = await createStore(name.trim(), slug.trim() || undefined);
      switchStore(s.id);
      toast.success(`Loja "${s.name}" criada`);
      setDialogOpen(false);
      setName("");
      setSlug("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar loja");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-secondary transition-colors",
              compact && "px-2 py-1.5",
            )}
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/30">
              <StoreIcon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
                Loja ativa
              </div>
              <div className="text-sm font-semibold truncate leading-tight mt-0.5">
                {loading ? "Carregando..." : activeStore?.name ?? "Selecionar loja"}
              </div>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-1" align="start">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Minhas lojas
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {stores.map((s) => {
              const active = s.id === activeStoreId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    switchStore(s.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-secondary transition-colors text-left",
                    active && "bg-primary/10",
                  )}
                >
                  <StoreIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{s.name}</div>
                    {s.slug && (
                      <div className="text-[10px] text-muted-foreground truncate">/{s.slug}</div>
                    )}
                  </div>
                  {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
          <div className="border-t border-border mt-1 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDialogOpen(true);
              }}
              className="w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Criar nova loja
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar nova loja</DialogTitle>
            <DialogDescription>
              Cada loja tem seus próprios pedidos, produtos, motoboys, checkout e configurações.
              Você pode alternar entre lojas a qualquer momento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="store-name">Nome da loja</Label>
              <Input
                id="store-name"
                placeholder="Ex: Loja 2 — Centro"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="store-slug">Identificador (opcional)</Label>
              <Input
                id="store-slug"
                placeholder="loja-centro"
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-")
                      .replace(/-+/g, "-"),
                  )
                }
              />
              <p className="text-[11px] text-muted-foreground">
                Usado no link do checkout público. Pode ser definido depois nas Configurações.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar loja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
