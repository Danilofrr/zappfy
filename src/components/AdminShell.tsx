import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  Ticket,
  BarChart3,
  Settings as Cog,
  ScrollText,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  MapPin,
  Bike,
  Gift,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { ThemeToggle } from "@/lib/theme";
import { usePlatformLogo } from "@/lib/usePlatformLogo";

const navGroups: { label: string; items: { to: string; label: string; icon: any; exact?: boolean }[] }[] = [
  {
    label: "Principal",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/admin/clientes", label: "Clientes", icon: Users },
      { to: "/admin/assinaturas", label: "Assinaturas", icon: ShieldCheck },
      { to: "/admin/pagamentos", label: "Pagamentos", icon: CreditCard },
      { to: "/admin/planos", label: "Planos", icon: Package },
      { to: "/admin/cupons", label: "Cupons", icon: Ticket },
      { to: "/admin/trials", label: "Trials", icon: Gift },
      { to: "/admin/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    label: "Gestão",
    items: [
      { to: "/admin/configuracoes", label: "Configurações", icon: Cog },
      { to: "/personalizar-rastreamento", label: "Rastreamento", icon: MapPin },
      { to: "/admin/entregas-zappfy", label: "Entregas Zappfy", icon: Bike },
      { to: "/admin/logs", label: "Logs do Sistema", icon: ScrollText },
    ],
  },
];

export function AdminShell({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { signOut, user } = useStore();
  const { sidebarLogo } = usePlatformLogo();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="lg:hidden sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => setOpen(true)} aria-label="Menu" className="grid h-9 w-9 place-items-center rounded-lg border border-border">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src={sidebarLogo} alt="Zappfy Admin" className="h-8 w-auto object-contain" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Admin</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex">
        <aside
          className={cn(
            "fixed lg:sticky top-0 left-0 z-50 h-screen shrink-0 border-r border-sidebar-border bg-sidebar w-[260px] transition-transform duration-300",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="relative flex items-center pl-6 pr-3 h-[90px] border-b border-sidebar-border bg-gradient-to-b from-sidebar-accent/30 to-transparent">
              <Link to="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2 min-w-0">
                <img
                  src={sidebarLogo}
                  alt="Zappfy Admin"
                  className="block h-11 w-auto max-w-[150px] object-contain drop-shadow-[0_0_12px_rgba(34,197,94,0.45)]"
                />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/90 hidden sm:inline">Admin</span>
              </Link>
              <button onClick={() => setOpen(false)} className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-lg border border-border bg-card" aria-label="Fechar">
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
                    const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
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
                        <span className="truncate whitespace-nowrap">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="border-t border-sidebar-border p-3 space-y-2">
              <div className="rounded-lg bg-card px-2.5 py-2 border border-border/70">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Administrador</div>
                {user?.email && <div className="text-sm font-semibold truncate leading-tight">{user.email}</div>}
              </div>
              <Link to="/" className="flex items-center justify-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                Ir para área do cliente
              </Link>
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </div>
          </div>
        </aside>

        {open && <div className="lg:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)} />}

        <main className="flex-1 min-w-0">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            <div className="flex items-end justify-between gap-4 mb-6 lg:mb-8">
              <div className="min-w-0">
                <h1 className="truncate text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
                {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {actions}
                <span className="hidden lg:block"><ThemeToggle /></span>
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
