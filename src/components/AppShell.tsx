import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Wallet,
  Megaphone,
  BarChart3,
  Settings as Cog,
  Menu,
  X,
  TrendingUp,
  LogOut,
  FileBarChart,
  Truck,
  RotateCcw,
  Package,
  Activity,
  Target,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { ThemeToggle } from "@/lib/theme";

const navGroups: { label: string; items: { to: string; label: string; icon: any }[] }[] = [
  {
    label: "Principal",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
      { to: "/produtos", label: "Estoque", icon: Boxes },
      { to: "/compras", label: "Compras", icon: Truck },
      { to: "/trocas", label: "Trocas & Devoluções", icon: RotateCcw },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { to: "/por-produto", label: "Por Produto", icon: Package },
      { to: "/indicadores", label: "Indicadores", icon: Activity },
      { to: "/metas", label: "Metas", icon: Target },
      { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { to: "/dre", label: "DRE", icon: FileBarChart },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/financeiro", label: "Financeiro", icon: Wallet },
      { to: "/ads", label: "Facebook Ads", icon: Megaphone },
      { to: "/configuracoes", label: "Configurações", icon: Cog },
    ],
  },
];

export function AppShell({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { state, signOut, user } = useStore();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile top bar */}
      <header
        className="lg:hidden sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between px-4 h-16">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold tracking-tight text-lg truncate">ZappFy</span>
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border bg-card hover:bg-secondary active:scale-95 transition"
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar — collapses to icons; expands on hover (desktop) */}
        <aside
          className={cn(
            "group/sidebar fixed lg:sticky top-0 left-0 z-40 h-screen shrink-0 border-r border-sidebar-border bg-sidebar transition-[transform,width] duration-300 ease-out",
            "w-64 lg:w-[4.5rem] lg:hover:w-64 lg:focus-within:w-64",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="flex h-full flex-col pt-[calc(env(safe-area-inset-top)+4rem)] lg:pt-0 overflow-hidden">
            <div className="hidden lg:flex items-center gap-2 px-4 h-16 border-b border-sidebar-border">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-primary shadow-glow">
                <TrendingUp className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="leading-tight min-w-0 opacity-0 lg:group-hover/sidebar:opacity-100 lg:group-focus-within/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                <div className="font-bold tracking-tight">ZappFy</div>
                <div className="text-[11px] text-muted-foreground">Gestão para WhatsApp</div>
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4">
              {navGroups.map((group) => (
                <div key={group.label} className="space-y-1">
                  <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/45 opacity-0 lg:group-hover/sidebar:opacity-100 lg:group-focus-within/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                    {group.label}
                  </div>
                  <div className="hidden lg:block lg:group-hover/sidebar:hidden lg:group-focus-within/sidebar:hidden mx-2 my-1 h-px bg-sidebar-border/60" />
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpen(false)}
                        title={item.label}
                        className={cn(
                          "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-primary text-primary-foreground shadow-[0_0_18px_rgba(34,197,94,0.55),0_0_4px_rgba(34,197,94,0.9)_inset] ring-1 ring-primary/60"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                        )}
                      >
                        <Icon className={cn("h-5 w-5 shrink-0", active && "text-primary-foreground drop-shadow-[0_0_6px_rgba(34,197,94,0.9)]")} />
                        <span className="truncate opacity-0 lg:group-hover/sidebar:opacity-100 lg:group-focus-within/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="border-t border-sidebar-border p-3 space-y-3">
              <div className="rounded-xl bg-card p-3 border border-border opacity-0 lg:group-hover/sidebar:opacity-100 lg:group-focus-within/sidebar:opacity-100 transition-opacity duration-200">
                <div className="text-xs text-muted-foreground">Loja</div>
                <div className="font-semibold truncate">{state.settings.storeName}</div>
                {user?.email && <div className="text-[11px] text-muted-foreground truncate mt-1">{user.email}</div>}
              </div>
              <button
                onClick={() => signOut()}
                title="Sair"
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="opacity-0 lg:group-hover/sidebar:opacity-100 lg:group-focus-within/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap">Sair</span>
              </button>
            </div>
          </div>
        </aside>

        {open && (
          <div
            className="lg:hidden fixed inset-0 z-30 bg-black/60"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Main */}
        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 mb-6 lg:mb-8">
              <div className="min-w-0">
                <h1 className="truncate text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {actions}
                <ThemeToggle />
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  neon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: any;
  tone?: "default" | "success" | "danger" | "warning";
  /** RGB triplet to override the default green neon, e.g. "139 92 246" */
  neon?: string;
}) {
  const toneCls =
    tone === "success"
      ? ""
      : tone === "danger"
      ? "text-destructive"
      : tone === "warning"
      ? "text-warning"
      : "text-foreground";
  const style = neon ? ({ ["--neon-rgb" as any]: neon.replace(/\s+/g, ", ") } as React.CSSProperties) : undefined;
  const valueStyle = neon
    ? { color: `rgb(${neon.replace(/\s+/g, ", ")})`, textShadow: `0 0 12px rgba(${neon.replace(/\s+/g, ", ")}, 0.65)` }
    : undefined;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 card-neon card-neon-hover" style={style}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        {Icon && (
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div
        className={cn("mt-3 text-2xl font-bold tracking-tight", toneCls, tone === "success" && !neon && "text-primary")}
        style={valueStyle}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
