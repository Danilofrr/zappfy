import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore, type Product } from "@/lib/store";
import { brl, pct } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, AlertTriangle, Upload, X, Image as ImageIcon,
  Search, Wallet, DollarSign, BarChart3, Boxes, Package, Gift, LayoutGrid, List, Truck,
  PackagePlus, History, Copy, Minus, CheckSquare,
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
  const { state, access, addProduct, updateProduct, bulkUpdateProducts, deleteProduct, hasPermission } = useStore();
  const [editing, setEditing] = useState<Product | null>(null);
  const [duplicating, setDuplicating] = useState<Product | null>(null);
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<"stock_add" | "stock_remove" | "price" | "cost">("stock_add");

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
  useEffect(() => {
    const valid = new Set(state.products.map((product) => product.id));
    setSelectedIds((current) => new Set([...current].filter((id) => valid.has(id))));
  }, [state.products]);
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

  const selectedProducts = useMemo(
    () => state.products.filter((product) => selectedIds.has(product.id)),
    [state.products, selectedIds],
  );
  const allVisibleSelected =
    visibleProducts.length > 0 && visibleProducts.every((product) => selectedIds.has(product.id));

  function toggleProductSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisibleSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleProducts.forEach((product) => next.delete(product.id));
      } else {
        visibleProducts.forEach((product) => next.add(product.id));
      }
      return next;
    });
  }

  function openBulk(action: "stock_add" | "stock_remove" | "price" | "cost") {
    if (!selectedIds.size) {
      toast.error("Selecione pelo menos um produto");
      return;
    }
    setBulkAction(action);
    setBulkOpen(true);
  }

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

  // Funcionários com acesso ao estoque visualizam somente a disponibilidade.
  // O proprietário mantém a tela completa, incluindo valores e ferramentas de gestão.
  if (!access?.isOwner) {
    const availableUnits = scope.reduce((sum, product) => sum + Math.max(0, product.stock), 0);
    const outOfStock = scope.filter((product) => product.stock <= 0).length;

    return (
      <AppShell
        title="Consulta de Estoque"
        subtitle="QUANTIDADES DISPONÍVEIS POR PRODUTO"
        actions={
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto..."
              className="w-[260px] bg-secondary/40 pl-9"
            />
          </div>
        }
      >
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            icon={<Boxes className="h-5 w-5" />}
            iconBg="bg-emerald-500/15 text-emerald-300"
            glow="from-emerald-500/15"
            neon="52 211 153"
            label="UNIDADES DISPONÍVEIS"
            value={String(availableUnits)}
            valueClass="text-emerald-300"
          />
          <KpiCard
            icon={<Package className="h-5 w-5" />}
            iconBg="bg-sky-500/15 text-sky-300"
            glow="from-sky-500/15"
            neon="56 189 248"
            label="PRODUTOS CADASTRADOS"
            value={String(scope.length)}
            valueClass="text-sky-300"
          />
          <KpiCard
            icon={<AlertTriangle className="h-5 w-5" />}
            iconBg="bg-orange-500/15 text-orange-300"
            glow="from-orange-500/15"
            neon="251 146 60"
            label="PRODUTOS ESGOTADOS"
            value={String(outOfStock)}
            valueClass="text-orange-300"
          />
        </div>

        <div className="relative mb-4 md:hidden">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produto..."
            className="bg-secondary/40 pl-9"
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <CatChip
            active={cat === "todas"}
            onClick={() => setCat("todas")}
            color="primary"
            amount={`${state.products.reduce((sum, p) => sum + Math.max(0, p.stock), 0)} un`}
            count={state.products.length}
          >
            Todas
          </CatChip>
          {categories.map((category) => {
            const categoryProducts = state.products.filter((product) => product.category === category);
            return (
              <CatChip
                key={category}
                active={cat === category}
                onClick={() => setCat(category)}
                color="pink"
                amount={`${categoryProducts.reduce((sum, p) => sum + Math.max(0, p.stock), 0)} un`}
                count={categoryProducts.length}
              >
                {category}
              </CatChip>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
          <div className="border-b border-border px-5 py-4">
            <h3 className="font-semibold">Disponibilidade por produto</h3>
            <p className="mt-1 text-xs text-muted-foreground">Consulta de quantidades em estoque.</p>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Produto</th>
                  <th className="px-4 py-3 text-left font-medium">Categoria</th>
                  <th className="px-4 py-3 text-right font-medium">Quantidade disponível</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
                )}
                {visibleProducts.map((product) => (
                  <tr key={product.id} className="border-t border-border hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt="" loading="lazy" decoding="async" className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover" />
                        ) : (
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary/50"><ImageIcon className="h-4 w-4 text-muted-foreground" /></span>
                        )}
                        <span className="font-medium">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{product.category || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex min-w-14 justify-center rounded-lg px-3 py-1.5 font-bold ${product.stock > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                        {Math.max(0, product.stock)} un
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-border md:hidden">
            {filtered.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum produto encontrado.</p>
            )}
            {visibleProducts.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-center gap-3">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt="" loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover" />
                  ) : (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-secondary/50"><ImageIcon className="h-5 w-5 text-muted-foreground" /></span>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{product.name}</div>
                    <div className="text-xs text-muted-foreground">{product.category || "Sem categoria"}</div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-xl font-extrabold ${product.stock > 0 ? "text-emerald-400" : "text-destructive"}`}>
                    {Math.max(0, product.stock)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">disponíveis</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {loadMoreButton && (
          <div className="mt-4 text-center">{loadMoreButton}</div>
        )}
      </AppShell>
    );
  }

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
          <Button onClick={() => { setEditing(null); setDuplicating(null); setOpen(true); }}>
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

      {tab === "produtos" && selectedIds.size > 0 && (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-primary/35 bg-primary/[0.07] p-3 shadow-[0_0_24px_hsl(var(--primary)/0.08)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <CheckSquare className="h-5 w-5" />
            </span>
            <div>
              <div className="font-bold">
                {selectedIds.size} produto{selectedIds.size === 1 ? "" : "s"} selecionado{selectedIds.size === 1 ? "" : "s"}
              </div>
              <div className="text-xs text-muted-foreground">
                Aplique a mesma alteração nas variantes selecionadas.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => openBulk("stock_add")}>
              <PackagePlus className="mr-1.5 h-4 w-4" />Aumentar estoque
            </Button>
            <Button size="sm" variant="outline" onClick={() => openBulk("stock_remove")}>
              <Minus className="mr-1.5 h-4 w-4" />Diminuir estoque
            </Button>
            <Button size="sm" variant="outline" onClick={() => openBulk("price")}>
              <DollarSign className="mr-1.5 h-4 w-4" />Preço de venda
            </Button>
            {hasPermission("finance") && (
              <Button size="sm" variant="outline" onClick={() => openBulk("cost")}>
                <Wallet className="mr-1.5 h-4 w-4" />Preço de custo
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <X className="mr-1.5 h-4 w-4" />Limpar
            </Button>
          </div>
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
                  <th className="w-10 px-3 py-3 text-center">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleVisibleSelection}
                      aria-label="Selecionar produtos visíveis"
                    />
                  </th>
                  <th className="px-3 py-3 w-10"></th>
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
                  <tr><td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
                )}
                {visibleProducts.map((p) => {
                  const margin = p.price ? ((p.price - p.cost) / p.price) * 100 : 0;
                  const low = p.stock <= p.minStock;
                  const out = p.stock <= 0;
                  return (
                    <tr
                      key={p.id}
                      className={`border-t border-border hover:bg-secondary/30 ${selectedIds.has(p.id) ? "bg-primary/[0.045]" : ""}`}
                    >
                      <td className="px-3 py-3 text-center">
                        <Checkbox
                          checked={selectedIds.has(p.id)}
                          onCheckedChange={() => toggleProductSelection(p.id)}
                          aria-label={`Selecionar ${p.name}`}
                        />
                      </td>
                      <td className="px-3 py-3">
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
                          <button
                            title="Duplicar produto"
                            onClick={() => { setEditing(null); setDuplicating(p); setOpen(true); }}
                            className="p-1 text-muted-foreground hover:text-violet-400"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button onClick={() => { setDuplicating(null); setEditing(p); setOpen(true); }} className="p-1 text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
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
              <div
                key={p.id}
                className={`relative rounded-2xl border bg-card p-5 shadow-elegant transition-colors ${
                  selectedIds.has(p.id) ? "border-primary/60 ring-1 ring-primary/25" : "border-border hover:border-primary/30"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.has(p.id)}
                    onCheckedChange={() => toggleProductSelection(p.id)}
                    aria-label={`Selecionar ${p.name}`}
                  />
                  <span className="text-xs text-muted-foreground">Selecionar</span>
                </div>
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
                    <button
                      title="Duplicar produto"
                      onClick={() => { setEditing(null); setDuplicating(p); setOpen(true); }}
                      className="p-1.5 text-muted-foreground hover:text-violet-400"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button onClick={() => { setDuplicating(null); setEditing(p); setOpen(true); }} className="p-1.5 text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
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

      <BulkProductDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        action={bulkAction}
        products={selectedProducts}
        onApply={async (value) => {
          if (!selectedProducts.length) return;

          const ok = await bulkUpdateProducts(
            selectedProducts.map((product) => product.id),
            bulkAction,
            value,
          );

          if (!ok) return;

          const label =
            bulkAction === "stock_add"
              ? "Estoque aumentado"
              : bulkAction === "stock_remove"
                ? "Estoque reduzido"
                : bulkAction === "price"
                  ? "Preço de venda atualizado"
                  : "Preço de custo atualizado";

          toast.success(`${label} em ${selectedProducts.length} produto${selectedProducts.length === 1 ? "" : "s"}`);
          setBulkOpen(false);
        }}
      />

      <AddStockDialog open={!!stockFor} onOpenChange={(v) => { if (!v) setStockFor(null); }} product={stockFor} />
      <ProductHistoryDialog open={!!historyFor} onOpenChange={(v) => { if (!v) setHistoryFor(null); }} product={historyFor} />

      <ProductDialog
        open={open}
        setOpen={(value) => {
          setOpen(value);
          if (!value) {
            setEditing(null);
            setDuplicating(null);
          }
        }}
        product={editing}
        duplicateFrom={duplicating}
        onSave={(p) => {
          if (editing) {
            updateProduct(editing.id, p);
            toast.success("Produto atualizado");
          } else if (duplicating) {
            addProduct(p);
            toast.success("Produto duplicado com sucesso");
          } else {
            addProduct(p);
            toast.success("Produto criado");
          }
          setOpen(false);
          setEditing(null);
          setDuplicating(null);
        }}
      />
    </AppShell>
  );
}

function BulkProductDialog({
  open,
  onOpenChange,
  action,
  products,
  onApply,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  action: "stock_add" | "stock_remove" | "price" | "cost";
  products: Product[];
  onApply: (value: number) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue("");
  }, [open, action]);

  const config = {
    stock_add: {
      title: "Aumentar estoque em massa",
      label: "Quantidade para adicionar em cada produto",
      description: "A mesma quantidade será somada ao estoque atual de cada variante selecionada. É um ajuste manual e não altera o saldo em caixa.",
      button: "Aumentar estoque",
      min: 1,
      step: 1,
    },
    stock_remove: {
      title: "Diminuir estoque em massa",
      label: "Quantidade para retirar de cada produto",
      description: "A mesma quantidade será retirada de cada variante. Nenhum estoque ficará abaixo de zero e o ajuste não altera o saldo em caixa.",
      button: "Diminuir estoque",
      min: 1,
      step: 1,
    },
    price: {
      title: "Alterar preço de venda",
      label: "Novo preço de venda para todos",
      description: "Todos os produtos selecionados receberão exatamente o mesmo preço de venda.",
      button: "Atualizar preço",
      min: 0,
      step: 0.01,
    },
    cost: {
      title: "Alterar preço de custo",
      label: "Novo preço de custo para todos",
      description: "Todos os produtos selecionados receberão exatamente o mesmo preço de custo.",
      button: "Atualizar custo",
      min: 0,
      step: 0.01,
    },
  }[action];

  const numericValue = Number(String(value).replace(",", "."));
  const valid = Number.isFinite(numericValue) && numericValue >= config.min;

  async function apply() {
    if (!valid) {
      toast.error(action.startsWith("stock") ? "Informe uma quantidade válida" : "Informe um valor válido");
      return;
    }
    setSaving(true);
    try {
      await onApply(action.startsWith("stock") ? Math.trunc(numericValue) : Math.round(numericValue * 100) / 100);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-3">
            <div className="text-xs font-semibold text-primary">
              {products.length} produto{products.length === 1 ? "" : "s"} selecionado{products.length === 1 ? "" : "s"}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {products.slice(0, 8).map((product) => (
                <span key={product.id} className="rounded-full border border-border bg-background px-2 py-1 text-[10px]">
                  {product.name}
                </span>
              ))}
              {products.length > 8 && (
                <span className="rounded-full border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground">
                  +{products.length - 8}
                </span>
              )}
            </div>
          </div>

          <Field label={config.label}>
            <Input
              autoFocus
              type="number"
              min={config.min}
              step={config.step}
              inputMode={action.startsWith("stock") ? "numeric" : "decimal"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={action.startsWith("stock") ? "Ex.: 5" : "Ex.: 199,90"}
            />
          </Field>

          {action.startsWith("stock") && (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border bg-secondary/20 p-3 text-xs">
              {products.map((product) => {
                const delta = Math.max(0, Math.trunc(Number(value) || 0));
                const nextStock =
                  action === "stock_add"
                    ? product.stock + delta
                    : Math.max(0, product.stock - delta);
                return (
                  <div key={product.id} className="flex items-center justify-between gap-3 py-1">
                    <span className="truncate text-muted-foreground">{product.name}</span>
                    <span className="shrink-0 font-semibold">
                      {product.stock} → <span className="text-primary">{nextStock}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={apply} disabled={saving || !valid}>
            {saving ? "Aplicando..." : config.button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  open, setOpen, product, duplicateFrom, onSave,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  product: Product | null;
  duplicateFrom: Product | null;
  onSave: (p: Omit<Product, "id">) => void;
}) {
  const [f, setF] = useState<Omit<Product, "id">>({
    name: "", category: "", cost: 0, price: 0, stock: 0, minStock: 0, description: "", imageUrl: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;

    if (product) {
      setF({
        name: product.name,
        category: product.category,
        cost: product.cost,
        price: product.price,
        stock: product.stock,
        minStock: product.minStock,
        description: product.description ?? "",
        imageUrl: product.imageUrl ?? "",
      });
      return;
    }

    if (duplicateFrom) {
      setF({
        name: duplicateFrom.name,
        category: duplicateFrom.category,
        cost: duplicateFrom.cost,
        price: duplicateFrom.price,
        stock: 0,
        minStock: duplicateFrom.minStock,
        description: duplicateFrom.description ?? "",
        imageUrl: duplicateFrom.imageUrl ?? "",
      });
      return;
    }

    setF({
      name: "",
      category: "",
      cost: 0,
      price: 0,
      stock: 0,
      minStock: 0,
      description: "",
      imageUrl: "",
    });
  }, [open, product, duplicateFrom]);

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
          <DialogTitle>
            {product ? "Editar produto" : duplicateFrom ? "Duplicar produto" : "Novo produto"}
          </DialogTitle>
          <DialogDescription>
            {duplicateFrom
              ? "Os dados do produto original foram copiados. Altere a cor/variante, imagem e informe o estoque correto da nova cópia."
              : "Os cálculos de lucro e margem são automáticos."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {duplicateFrom && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-xs text-violet-300">
              <div className="flex items-center gap-2 font-bold">
                <Copy className="h-4 w-4" />
                Cópia de {duplicateFrom.name}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                O estoque foi zerado para evitar duplicar peças existentes. Troque o nome/cor e informe a quantidade real antes de salvar.
              </div>
            </div>
          )}
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
          <Button onClick={() => { if (!f.name) { toast.error("Informe o nome"); return; } onSave(f); }}>
            {duplicateFrom ? "Criar cópia" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
