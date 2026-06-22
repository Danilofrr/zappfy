import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicFavicons } from "@/lib/admin.functions";

type Scope = "dashboard" | "entregas";

/**
 * Aplica favicons personalizadas configuradas no admin para cada contexto
 * (dashboard ou central de entregas). Quando não há upload configurado,
 * mantém os ícones default servidos a partir de `/public`.
 */
export function DynamicFavicon({ scope }: { scope: Scope }) {
  const fn = useServerFn(getPublicFavicons);
  const { data } = useQuery({
    queryKey: ["public-favicons"],
    queryFn: () => fn(),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!data) return;
    const url = scope === "dashboard" ? data.dashboard : data.entregas;
    if (!url) return;

    const head = document.head;
    const created: HTMLLinkElement[] = [];
    const previous: { el: HTMLLinkElement; prev: string | null }[] = [];

    const setIcon = (rel: string, sizes?: string) => {
      const sel = sizes ? `link[rel="${rel}"][sizes="${sizes}"]` : `link[rel="${rel}"]`;
      let el = document.querySelector<HTMLLinkElement>(sel);
      if (!el) {
        el = document.createElement("link");
        el.rel = rel;
        if (sizes) el.setAttribute("sizes", sizes);
        head.appendChild(el);
        created.push(el);
      } else {
        previous.push({ el, prev: el.getAttribute("href") });
      }
      el.setAttribute("href", url);
    };

    setIcon("icon");
    setIcon("shortcut icon");
    setIcon("apple-touch-icon", "180x180");

    return () => {
      for (const c of created) c.remove();
      for (const p of previous) {
        if (p.prev) p.el.setAttribute("href", p.prev);
      }
    };
  }, [data, scope]);

  return null;
}
