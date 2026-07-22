import { useQuery } from "@tanstack/react-query";
import { Trophy, Eye, EyeOff, Pencil, SquarePen } from "lucide-react";
import { useStore, useFinance } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { Link, useRouterState } from "@tanstack/react-router";
import { brl as formatBRL } from "@/lib/format";
import { usePrivacy, mask } from "@/hooks/use-privacy";
import { useTheme } from "@/lib/theme";
import { Sun, Moon } from "lucide-react";
import { useDashboardEdit } from "@/hooks/use-dashboard-layout";

export function DashboardTopBar({ subtitle }: { subtitle?: string }) {
  const { user, state } = useStore();
  const { revenue } = useFinance();
  const { on: privacy, toggle: togglePrivacy } = usePrivacy();
  const { theme, toggle: toggleTheme } = useTheme();
  const { on: editMode, toggle: toggleEdit } = useDashboardEdit();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const showEdit = path === "/";

  const prizeQ = useQuery({
    queryKey: ["public-prize"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("value")
        .eq("key", "system")
        .maybeSingle();
      return ((data?.value as any)?.prize ?? {}) as { enabled?: boolean; goal?: number; reward?: string; period?: string };
    },
    staleTime: 60_000,
  });

  const profileQ = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data ?? null;
    },
    staleTime: 30_000,
  });

  const prize = prizeQ.data ?? {};
  const goal = Number(prize.goal ?? 0);
  const showPrize = !!prize.enabled && goal > 0;
  const pct = goal > 0 ? Math.min(100, (revenue / goal) * 100) : 0;

  const displayName =
    profileQ.data?.full_name ||
    (user?.user_metadata as any)?.full_name ||
    state.settings.storeName ||
    user?.email?.split("@")[0] ||
    "Usuário";

  return (
    <div className="hidden lg:flex items-center gap-4 mb-2 flex-wrap">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {subtitle && <span>{subtitle}</span>}
        <div className="flex items-center gap-1 ml-1">
          <button
            type="button"
            onClick={togglePrivacy}
            className="grid h-7 w-7 place-items-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title={privacy ? "Mostrar valores" : "Ocultar valores"}
          >
            {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-7 w-7 place-items-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Alternar tema"
            aria-label="Alternar tema"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          
          <Link
            to="/configuracoes"
            className="grid h-7 w-7 place-items-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Editar configurações"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          {showEdit && (
            <button
              type="button"
              onClick={toggleEdit}
              className={`grid h-7 w-7 place-items-center rounded-md transition-colors ${
                editMode
                  ? "bg-primary/15 text-primary hover:bg-primary/25"
                  : "hover:bg-secondary text-muted-foreground hover:text-foreground"
              }`}
              title={editMode ? "Sair do modo de edição" : "Personalizar cards da dashboard"}
              aria-label="Personalizar dashboard"
            >
              <SquarePen className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium">
          <span className="text-base leading-none">🇧🇷</span> PT-BR
        </span>

        {showPrize && (
          <div
            className="hidden md:flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5"
            title={prize.reward ? `Prêmio: ${prize.reward}` : "Meta de prêmio"}
          >
            <Trophy className="h-4 w-4 text-primary" />
            <div className="text-xs">
              <span className="font-semibold text-primary">Prêmios</span>
              <span className="text-muted-foreground">
                {" "}
                {mask(formatBRL(revenue), privacy)} / {mask(formatBRL(goal), privacy)}
              </span>
            </div>
            <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        <Link to="/configuracoes" className="flex items-center gap-2 group">
          <span className="hidden md:block text-sm font-semibold uppercase tracking-wide text-foreground/90 max-w-[220px] truncate">
            {displayName}
          </span>
          <UserAvatar
            name={displayName}
            email={user?.email}
            url={profileQ.data?.avatar_url}
            size={40}
            className="group-hover:scale-105 transition-transform"
          />
        </Link>
      </div>
    </div>
  );
}
