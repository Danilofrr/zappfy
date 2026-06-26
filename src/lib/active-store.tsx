import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

export type Store = {
  id: string;
  owner_id: string;
  name: string;
  slug: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

const ACTIVE_STORE_KEY = "zappfy.active_store_id";

type Ctx = {
  stores: Store[];
  activeStoreId: string | null;
  activeStore: Store | null;
  loading: boolean;
  switchStore: (id: string) => void;
  refetch: () => Promise<unknown>;
  createStore: (name: string, slug?: string) => Promise<Store>;
};

const ActiveStoreContext = createContext<Ctx | null>(null);

export function ActiveStoreProvider({ children }: { children: ReactNode }) {
  const { user } = useStore();
  const queryClient = useQueryClient();
  const [activeStoreId, setActiveStoreId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(ACTIVE_STORE_KEY);
    } catch {
      return null;
    }
  });

  const q = useQuery({
    queryKey: ["my-stores", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("owner_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Store[];
    },
    staleTime: 30_000,
  });

  const stores = q.data ?? [];

  // Garante uma loja ativa válida quando a lista carrega.
  useEffect(() => {
    if (!stores.length) return;
    const valid = stores.find((s) => s.id === activeStoreId);
    if (valid) return;
    const fallback = stores.find((s) => s.is_default) ?? stores[0];
    setActiveStoreId(fallback.id);
    try {
      localStorage.setItem(ACTIVE_STORE_KEY, fallback.id);
    } catch {}
  }, [stores, activeStoreId]);

  const switchStore = useCallback(
    (id: string) => {
      setActiveStoreId(id);
      try {
        localStorage.setItem(ACTIVE_STORE_KEY, id);
      } catch {}
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const createStore = useCallback(
    async (name: string, slug?: string) => {
      const { data, error } = await supabase.rpc("create_my_store", {
        _name: name,
        _slug: slug,
      });
      if (error) throw error;
      await q.refetch();
      return data as unknown as Store;
    },
    [q],
  );

  const activeStore = useMemo(
    () => stores.find((s) => s.id === activeStoreId) ?? null,
    [stores, activeStoreId],
  );

  const value: Ctx = {
    stores,
    activeStoreId,
    activeStore,
    loading: q.isLoading,
    switchStore,
    refetch: q.refetch,
    createStore,
  };

  return <ActiveStoreContext.Provider value={value}>{children}</ActiveStoreContext.Provider>;
}

export function useActiveStore() {
  const ctx = useContext(ActiveStoreContext);
  if (!ctx) {
    // Fora do provider (ex: páginas públicas): retorna estado neutro.
    return {
      stores: [] as Store[],
      activeStoreId: null,
      activeStore: null,
      loading: false,
      switchStore: () => {},
      refetch: async () => {},
      createStore: async () => {
        throw new Error("ActiveStoreProvider ausente");
      },
    } satisfies Ctx;
  }
  return ctx;
}
