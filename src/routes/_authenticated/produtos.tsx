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
import {
  Plus, Pencil, Trash2, AlertTriangle, Upload, X, Image as ImageIcon,
  Search, Wallet, DollarSign, BarChart3, Boxes, Package, Gift, LayoutGrid, List, Truck,
  PackagePlus, History,
} from "lucide-react";
import { ComprasSection } from "@/components/ComprasSection";
import { AddStockDialog } from "@/components/AddStockDialog";
import { ProductHistoryDialog } from "@/components/ProductHistoryDialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({ meta: [{ title: "Estoque — ZappFy" }] }),
  component: EstoquePage,
});

function skuOf(id: string) {
  return id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "—";
}

function EstoquePage() {
  const { state, addProduct, updateProduct, deleteProduct } = useStore();
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [stockFor, setStockFor] = useState<Product | null>(null);
  const [historyFor, setHistoryFor] = useState<Product | null>(null);
  const [tab, setTab] = useState<"produtos" | "kits" | "compras">("produtos");
  const [view, setView] = useState<"tabela" | "cards">("tabela");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 350);
  const PAGE_SIZE = 40;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [cat, setCat] = useState<string>("todas");

  const categories = useMemo(() => {
    const set = new Set<string>();
    state.products.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set);
  }, [state.products]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return state.products.filter((p) => {
      if (cat !== "todas" && p.category !== cat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q) ||
        skuOf(p.id).toLowerCase().includes(q)
      );
    });
  }, [state.products, debouncedQuery, cat]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [debouncedQuery, cat]);
  const visibleProducts = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMoreProducts = filtered.length > visibleProducts.length;
  const loadMoreButton = hasMoreProducts ? (
    <button
      type="button"
      onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
      className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
    >
      Carregar mais ({filtered.length - visibleProducts.length} restantes)
    </button>
  ) : null;

  const scope = useMemo(
    () => (cat === "todas" ? state.products : state.products.filter((p) => p.category === cat)),
    [state.products, cat]
  );

  const totals = useMemo(() => {
    const valorEstoque = scope.reduce((s, p) => s + p.cost * p.stock, 0);
    const valorVenda = scope.reduce((s, p) => s + p.price * p.stock, 0);
    const abaixoMin = scope.filter((p) => p.stock <= p.minStock).length;
    const skus = scope.length;
    return { valorEstoque, valorVenda, abaixoMin, skus };
  }, [scope]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, { estoque: number; venda: number; count: number }>();
    state.products.forEach((p) => {
      const key = p.category || "Sem categoria";
      const cur = map.get(key) || { estoque: 0, venda: 0, count: 0 };
      cur.estoque += p.cost * p.stock;
      cur.venda += p.price * p.stock;
      cur.count += 1;
      map.set(key, cur);
    });
    return map;
  }, [state.products]);

  const totalEstoqueGeral = useMemo(
    () => state.products.reduce((s, p) => s + p.cost * p.stock, 0),
    [state.products]
  );

  return (
    <AppShell
      title="Controle de Estoque"
      subtitle={`PRODUTOS CADASTRADOS — ATUALIZADO HOJE`}
      actions={
        <div className="flex items-center gap-2">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto..."
              className="pl-9 w-[260px] bg-secondary/40"
            />
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />Novo Produto
          </Button>
        </div>
      }
    >
      {/* Tabs Produtos / Kits */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setTab("produtos")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
            tab === "produtos"
              ? "bg-primary text-primary-foreground shadow-elegant"
              : "bg-secondary/60 text-foreground hover:bg-secondary"
          }`}
        >
          <Package className="h-4 w-4" /> Produtos
        </button>
        <button
          onClick={() => setTab("kits")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
            tab === "kits"
              ? "bg-primary text-primary-foreground shadow-elegant"
              : "bg-secondary/60 text-foreground hover:bg-secondary"
          }`}
        >
          <Gift className="h-4 w-4" /> Kits & Combos
        </button>
        <button
          onClick={() => setTab("compras")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
            tab === "compras"
              ? "bg-primary text-primary-foreground shadow-elegant"
              : "bg-secondary/60 text-foreground hover:bg-secondary"
          }`}
        >
          <Truck className="h-4 w-4" /> Compras & Fornecedores
        </button>
      </div>

      {/* Search mobile */}
      <div className="relative md:hidden mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produto..."
          className="pl-9 bg-secondary/40"
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5">
        <KpiCard
          icon={<Wallet className="h-5 w-5" />}
          iconBg="bg-violet-500/15 text-violet-300"
          glow="from-violet-500/15"
          neon="167 139 250"
          label="VALOR EM ESTOQUE"
          value={brl(totals.valorEstoque)}
          valueClass="text-violet-300"
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5" />}
          iconBg="bg-emerald-500/15 text-emerald-300"
          glow="from-emerald-500/15"
          neon="52 211 153"
          label="VALOR DE VENDA"
          value={brl(totals.valorVenda)}
          valueClass="text-emerald-300"
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          iconBg="bg-orange-500/15 text-orange-300"
          glow="from-orange-500/15"
          neon="251 146 60"
          label="ABAIXO DO MÍNIMO"
          value={`${totals.abaixoMin} produto${totals.abaixoMin === 1 ? "" : "s"}`}
          valueClass="text-orange-300"
        />
        <KpiCard
          icon={<BarChart3 className="h-5 w-5" />}
          iconBg="bg-sky-500/15 text-sky-300"
          glow="from-sky-500/15"
          neon="56 189 248"
          label="TOTAL DE SKUS"
          value={String(totals.skus)}
          valueClass="text-sky-300"
          hint="Produtos cadastrados"
        />
      </div>

      {/* Filters: category chips + view toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <CatChip
          active={cat === "todas"}
          onClick={() => setCat("todas")}
          color="primary"
          amount={brl(totalEstoqueGeral)}
          count={state.products.length}
        >
          Todas
        </CatChip>
        {categories.map((c) => {
          const s = categoryStats.get(c);
          return (
            <CatChip
              key={c}
              active={cat === c}
              onClick={() => setCat(c)}
              color="pink"
              amount={brl(s?.estoque ?? 0)}
              count={s?.count ?? 0}
            >
              {c}
            </CatChip>
          );
        })}
        <div className="ml-auto inline-flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView("tabela")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs ${
              view === "tabela" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5" /> Tabela
          </button>
          <button
            onClick={() => setView("cards")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs ${
              view === "cards" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Cards
          </button>
        </div>
      </div>

      {cat !== "todas" && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Categoria: <span className="text-foreground font-semibold">{cat}</span></span>
          <span>Custo em estoque: <span className="text-violet-300 font-semibold">{brl(totals.valorEstoque)}</span></span>
          <span>Valor de venda: <span className="text-emerald-300 font-semibold">{brl(totals.valorVenda)}</span></span>
          <span>Lucro potencial: <span className="text-emerald-300 font-semibold">{brl(totals.valorVenda - totals.valorEstoque)}</span></span>
        </div>
      )}

      {tab === "compras" ? (
        <ComprasSection />
      ) : tab === "kits" ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-elegant">
          <Gift className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-semibold mb-1">Kits & Combos</h3>
          <p className="text-sm text-muted-foreground">Em breve: monte combos de produtos com preço promocional.</p>
        </div>
      ) : view === "tabela" ? (
        <div className="rounded-2xl border border-border bg-card shadow-elegant overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-semibold">Produtos em Estoque</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-secondary/30">
                <tr>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="text-left px-4 py-3 font-medium">Produto</th>
                  <th className="text-left px-4 py-3 font-medium">SKU</th>
                  <th className="text-left px-4 py-3 font-medium">Categoria</th>
                  <th className="text-center px-4 py-3 font-medium">Estoque</th>
                  <th className="text-center px-4 py-3 font-medium">Mín.</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Custo</th>
                  <th className="text-right px-4 py-3 font-medium">Preço</th>
                  <th className="text-right px-4 py-3 font-medium">Margem</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
                )}
                {visibleProducts.map((p) => {
                  const margin = p.price ? ((p.price - p.cost) / p.price) * 100 : 0;
                  const low = p.stock <= p.minStock;
                  const out = p.stock <= 0;
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="h-9 w-9 rounded-md object-cover border border-border" />
                        ) : (
                          <div className="h-9 w-9 rounded-md bg-secondary/50 grid place-items-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{skuOf(p.id)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.category || "—"}</td>
                      <td className={`px-4 py-3 text-center font-semibold ${out ? "text-destructive" : low ? "text-orange-400" : ""}`}>{p.stock}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{p.minStock}</td>
                      <td className="px-4 py-3 text-center">
                        {out ? (
                          <span className="inline-flex rounded-md bg-destructive/15 text-destructive text-[11px] font-semibold px-2 py-0.5">ESGOTADO</span>
                        ) : low ? (
                          <span className="inline-flex rounded-md bg-orange-500/15 text-orange-400 text-[11px] font-semibold px-2 py-0.5">BAIXO</span>
                        ) : (
                          <span className="inline-flex rounded-md bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold px-2 py-0.5">OK</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{brl(p.cost)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{brl(p.price)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-semibold">{pct(margin)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button title="Adicionar estoque" onClick={() => setStockFor(p)} className="p-1 text-muted-foreground hover:text-primary"><PackagePlus className="h-4 w-4" /></button>
                          <button title="Histórico" onClick={() => setHistoryFor(p)} className="p-1 text-muted-foreground hover:text-sky-400"><History className="h-4 w-4" /></button>
                          <button onClick={() => { setEditing(p); setOpen(true); }} className="p-1 text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => { if (confirm("Excluir produto?")) deleteProduct(p.id); }} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {loadMoreButton && <div className="border-t border-border p-3 text-center">{loadMoreButton}</div>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-10">Nenhum produto encontrado.</div>
          )}
          {visibleProducts.map((p) => {
            const margin = p.price ? ((p.price - p.cost) / p.price) * 100 : 0;
            const profit = p.price - p.cost;
            const low = p.stock <= p.minStock;
            return (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-5 shadow-elegant hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} loading="lazy" decoding="async" className="h-14 w-14 rounded-lg object-cover shrink-0 border border-border" />
                    ) : (
                      <div className="h-14 w-14 rounded-lg grid place-items-center bg-secondary/40 border border-border shrink-0">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">{p.category || "—"} · <span className="font-mono">{skuOf(p.id)}</span></div>
                      <div className="font-semibold truncate">{p.name}</div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button title="Adicionar estoque" onClick={() => setStockFor(p)} className="p-1.5 text-muted-foreground hover:text-primary"><PackagePlus className="h-4 w-4" /></button>
                    <button title="Histórico" onClick={() => setHistoryFor(p)} className="p-1.5 text-muted-foreground hover:text-sky-400"><History className="h-4 w-4" /></button>
                    <button onClick={() => { setEditing(p); setOpen(true); }} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => { if (confirm("Excluir produto?")) deleteProduct(p.id); }} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-[11px] uppercase text-muted-foreground">Custo</div><div className="font-medium">{brl(p.cost)}</div></div>
                  <div><div className="text-[11px] uppercase text-muted-foreground">Venda</div><div className="font-medium">{brl(p.price)}</div></div>
                  <div><div className="text-[11px] uppercase text-muted-foreground">Lucro/un</div><div className="font-semibold text-emerald-400">{brl(profit)}</div></div>
                  <div><div className="text-[11px] uppercase text-muted-foreground">Margem</div><div className="font-semibold text-emerald-400">{pct(margin)}</div></div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Estoque: <span className="text-foreground font-medium">{p.stock}</span> / mín {p.minStock}</span>
                  {low && <span className="inline-flex items-center gap-1 text-orange-400"><AlertTriangle className="h-3.5 w-3.5" />Baixo</span>}
                </div>
              </div>
            );
          })}
          {loadMoreButton && <div className="col-span-full text-center">{loadMoreButton}</div>}
        </div>
      )}

      <AddStockDialog open={!!stockFor} onOpenChange={(v) => { if (!v) setStockFor(null); }} product={stockFor} />
      <ProductHistoryDialog open={!!historyFor} onOpenChange={(v) => { if (!v) setHistoryFor(null); }} product={historyFor} />

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

function KpiCard({
  icon, iconBg, glow, label, value, valueClass, hint, neon,
}: {
  icon: React.ReactNode; iconBg: string; glow: string;
  label: string; value: string; valueClass?: string; hint?: string;
  neon: string; // rgb triplet, e.g. "139 92 246"
}) {
  const style = {
    borderColor: `rgb(${neon} / 0.55)`,
    boxShadow: `0 0 0 1px rgb(${neon} / 0.35), 0 0 18px rgb(${neon} / 0.35), 0 0 48px rgb(${neon} / 0.25), inset 0 0 24px rgb(${neon} / 0.08)`,
  } as React.CSSProperties;
  return (
    <div
      className="group relative overflow-hidden rounded-2xl border bg-card p-4 lg:p-5 transition-shadow"
      style={style}
    >
      <div className={`pointer-events-none absolute -inset-1 bg-gradient-to-br ${glow} via-transparent to-transparent opacity-70`} />
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-60 blur-[2px]"
        style={{ background: `linear-gradient(135deg, rgb(${neon} / 0.35), transparent 60%)` }}
      />
      <div className="relative flex items-center gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${iconBg}`} style={{ boxShadow: `0 0 14px rgb(${neon} / 0.55)` }}>{icon}</div>
        <div className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground leading-tight">{label}</div>
      </div>
      <div
        className={`relative mt-4 text-2xl lg:text-3xl font-extrabold ${valueClass ?? ""}`}
        style={{ textShadow: `0 0 12px rgb(${neon} / 0.65), 0 0 24px rgb(${neon} / 0.35)` }}
      >
        {value}
      </div>
      {hint && <div className="relative mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function CatChip({
  active, onClick, color, children, amount, count,
}: { active: boolean; onClick: () => void; color: "primary" | "pink"; children: React.ReactNode; amount?: string; count?: number }) {
  const base = "inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-colors";
  const activeCls = color === "primary"
    ? "bg-primary text-primary-foreground border-primary shadow-glow"
    : "bg-pink-500/20 text-pink-300 border-pink-500/40";
  const inactiveCls = "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30";
  return (
    <button onClick={onClick} className={`${base} ${active ? activeCls : inactiveCls}`}>
      <span>{children}</span>
      {typeof count === "number" && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-black/20" : "bg-secondary/60 text-foreground/70"}`}>
          {count}
        </span>
      )}
      {amount && (
        <span className={`text-[10px] font-semibold ${active ? "opacity-90" : "text-muted-foreground"}`}>
          {amount}
        </span>
      )}
    </button>
  );
}

function ProductDialog({
  open, setOpen, product, onSave,
}: { open: boolean; setOpen: (v: boolean) => void; product: Product | null; onSave: (p: Omit<Product, "id">) => void }) {
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
      <DialogTrigger asChild><span /></DialogTrigger>
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
          <Field label="Nome"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Categoria"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preço de custo (R$)"><Input type="number" step="0.01" value={f.cost} onChange={(e) => setF({ ...f, cost: Number(e.target.value) })} /></Field>
            <Field label="Preço de venda (R$)"><Input type="number" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estoque"><Input type="number" value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} /></Field>
            <Field label="Estoque mínimo"><Input type="number" value={f.minStock} onChange={(e) => setF({ ...f, minStock: Number(e.target.value) })} /></Field>
          </div>
          <Field label="Descrição"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>

          <div className="grid grid-cols-2 gap-3 rounded-lg bg-secondary/40 border border-border p-3 text-sm">
            <div><div className="text-[11px] uppercase text-muted-foreground">Lucro/un</div><div className="font-semibold text-emerald-400">{brl(f.price - f.cost)}</div></div>
            <div><div className="text-[11px] uppercase text-muted-foreground">Margem</div><div className="font-semibold text-emerald-400">{pct(f.price ? ((f.price - f.cost) / f.price) * 100 : 0)}</div></div>
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
