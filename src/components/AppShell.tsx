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
  Calculator,
  Palette,
  MapPin,
  Bike,
  CreditCard,
  Plug,
  Percent,







} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { ThemeToggle } from "@/lib/theme";
import { SubscriptionStatusCard } from "@/components/SubscriptionStatusCard";
import { usePlatformLogo } from "@/lib/usePlatformLogo";
import { SupportWhatsBubble } from "@/components/SupportWhatsBubble";
import { ActiveStoreProvider } from "@/lib/active-store";
import { StoreSwitcher } from "@/components/StoreSwitcher";

const navGroups: { label: string; items: { to: string; label: string; icon: any }[] }[] = [
  {
    label: "Principal",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
      { to: "/rastreamento", label: "Rastreamento", icon: MapPin },
      { to: "/produtos", label: "Estoque", icon: Boxes },
      { to: "/compras", label: "Compras", icon: Truck },
      { to: "/trocas", label: "Trocas & Devoluções", icon: RotateCcw },
      { to: "/motoboys", label: "Motoboys", icon: Bike },
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
      { to: "/precificacao", label: "Precificação", icon: Calculator },
      { to: "/taxas", label: "Taxas", icon: Percent },
      { to: "/ads", label: "Meta Ads", icon: Megaphone },
      { to: "/personalizar-checkout", label: "Checkout", icon: Palette },
      { to: "/integracoes", label: "Integrações", icon: Plug },
      { to: "/minha-assinatura", label: "Assinatura", icon: CreditCard },
      { to: "/configuracoes", label: "Configurações", icon: Cog },
    ],
  },

];

export function AppShell({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const { state, signOut, user } = useStore();
  const { sidebarLogo } = usePlatformLogo();

  const primaryMobile = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/pedidos", label: "Pedidos", icon: ShoppingCart },
    { to: "/produtos", label: "Estoque", icon: Boxes },
    { to: "/financeiro", label: "Financeiro", icon: Wallet },
  ];

  return (
    <ActiveStoreProvider>
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile top bar (logo only) */}
      <header
        className="lg:hidden sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between pl-6 pr-3 h-[90px]">
          <Link to="/" className="flex items-center min-w-0">
            <img
              src="/logo-full.png"
              alt="Zappfy"
              className="h-12 w-auto max-h-none max-w-none object-contain drop-shadow-[0_0_12px_rgba(34,197,94,0.45)]"
            />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex">
        {/* Sidebar — desktop collapses to icons; on mobile acts as drawer opened by bottom "Menu" button */}
        <aside
          className={cn(
            "fixed lg:sticky top-0 left-0 z-50 h-screen shrink-0 border-r border-sidebar-border bg-sidebar transition-transform duration-300 ease-out",
            "w-[260px]",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="flex h-full flex-col pt-[env(safe-area-inset-top)] lg:pt-0">
            <div className="relative flex items-center pl-6 pr-3 h-[90px] border-b border-sidebar-border bg-gradient-to-b from-sidebar-accent/30 to-transparent">
              <Link
                to="/"
                onClick={() => setOpen(false)}
                className="flex items-center min-w-0 w-full h-full text-2xl font-bold justify-start"
              >
                {/* Full logo always */}
                <img
                  src="/logo-full.png"
                  alt="Zappfy"
                  className="block h-12 w-auto max-h-none max-w-none object-contain drop-shadow-[0_0_12px_rgba(34,197,94,0.45)]"
                />

              </Link>
              <button
                onClick={() => setOpen(false)}
                className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-card"
                aria-label="Fechar menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4">
              {navGroups.map((group) => (
                <div key={group.label} className="space-y-1">
                  <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/45 whitespace-nowrap">
                    {group.label}
                  </div>

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
                        <span className="truncate whitespace-nowrap">
                          {item.label}
                        </span>

                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="border-t border-sidebar-border p-3 space-y-2 mt-4">
              <SubscriptionStatusCard variant="sidebar" />
              <StoreSwitcher />
              {user?.email && (
                <div className="text-[10px] text-muted-foreground truncate px-1">
                  {user.email}
                </div>
              )}
              <button
                onClick={() => signOut()}
                title="Sair"
                className="w-full flex items-center justify-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <LogOut className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">Sair</span>
              </button>
            </div>

          </div>
        </aside>

        {open && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Main */}
        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 mb-6 lg:mb-8">
              <div className="min-w-0">
                <h1 className="truncate text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {actions}
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5 h-16">
          {primaryMobile.map((item) => {
            const Icon = item.icon;
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_rgba(34,197,94,0.9)]")} />
                <span className="truncate max-w-full px-1">{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
              open ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
            aria-label="Mais opções"
          >
            <Menu className="h-5 w-5" />
            <span>Mais</span>
          </button>
        </div>
      </nav>

      <SupportWhatsBubble mode="dashboard" />
    </div>
    </ActiveStoreProvider>
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
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Icon className="h-4 w-4 text-primary" />
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
