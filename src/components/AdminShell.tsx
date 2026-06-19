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
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { ThemeToggle } from "@/lib/theme";

const adminNav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/assinaturas", label: "Assinaturas", icon: ShieldCheck },
  { to: "/admin/pagamentos", label: "Pagamentos", icon: CreditCard },
  { to: "/admin/planos", label: "Planos", icon: Package },
  { to: "/admin/cupons", label: "Cupons", icon: Ticket },
  { to: "/admin/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/admin/configuracoes", label: "Configurações", icon: Cog },
  { to: "/admin/logs", label: "Logs do Sistema", icon: ScrollText },
];

export function AdminShell({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { signOut, user } = useStore();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="lg:hidden sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => setOpen(true)} aria-label="Menu" className="grid h-9 w-9 place-items-center rounded-lg border border-border">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary">
              <ShieldCheck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">Zappfy Admin</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex">
        <aside
          className={cn(
            "fixed lg:sticky top-0 left-0 z-50 h-screen shrink-0 border-r border-sidebar-border bg-sidebar w-72 transition-transform duration-300",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 px-5 h-16 border-b border-sidebar-border">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary shadow-[0_0_18px_rgba(34,197,94,0.55)]">
                  <ShieldCheck className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="leading-tight">
                  <div className="font-bold tracking-tight">Zappfy Admin</div>
                  <div className="text-[11px] text-muted-foreground">Painel Master</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="lg:hidden grid h-9 w-9 place-items-center rounded-lg border border-border" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {adminNav.map((item) => {
                const Icon = item.icon;
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                      active
                        ? "bg-primary text-primary-foreground shadow-[0_0_18px_rgba(34,197,94,0.55)]"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-sidebar-border p-3 space-y-2">
              <Link to="/" className="block rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-secondary">
                Ir para área do cliente
              </Link>
              <div className="rounded-xl bg-card p-3 border border-border">
                <div className="text-xs text-muted-foreground">Administrador</div>
                {user?.email && <div className="text-sm font-medium truncate">{user.email}</div>}
              </div>
              <button
                onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
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
