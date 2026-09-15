import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { EntregasPwaShell } from "@/components/EntregasPwaShell";
import {
  ENTREGAS_APPLE_ICON_URL,
  ENTREGAS_FAVICON_URL,
  getEntregasManifestUrl,
} from "@/lib/entregas-pwa";

const PRODUCTION_ORIGIN = "https://app.zappfy.shop";

export const Route = createFileRoute("/entregas-zappfy/$storeSlug")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: "Zappfy Entregas — Central de Entregas" },
      { name: "theme-color", content: "#08110d" },
      { name: "apple-mobile-web-app-title", content: "Zappfy Entregas" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
    ],
    links: [
      { rel: "manifest", href: getEntregasManifestUrl(params.storeSlug) },
      { rel: "icon", type: "image/png", sizes: "192x192", href: ENTREGAS_FAVICON_URL },
      { rel: "apple-touch-icon", sizes: "180x180", href: ENTREGAS_APPLE_ICON_URL },
    ],
  }),
  component: EntregasLayout,
});

function normalizeUiText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function DeliveryListOrganizer() {
  useEffect(() => {
    type ListMode = "active" | "delivered" | "map";
    let mode: ListMode = "active";
    let raf = 0;
    let applying = false;

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    };

    const isDeliveredArticle = (article: HTMLElement) => {
      const spans = Array.from(article.querySelectorAll("span"));
      return spans.some((span) => normalizeUiText(span.textContent) === "entregue");
    };

    const isAwaitingDecision = (article: HTMLElement) => {
      return Array.from(article.querySelectorAll("button")).some(
        (button) => normalizeUiText(button.textContent) === "aceitar",
      );
    };

    const setButtonVisual = (button: HTMLButtonElement, active: boolean) => {
      button.style.background = active ? "#18c56e" : "transparent";
      button.style.color = active ? "#052013" : "inherit";
      button.style.boxShadow = active ? "0 8px 24px -14px #18c56e" : "none";
    };

    const ensureEmptyState = (
      grid: HTMLElement,
      visibleCount: number,
      deliveredMode: boolean,
      titleColor: string,
    ) => {
      const parent = grid.parentElement;
      if (!parent) return;
      let empty = parent.querySelector<HTMLElement>("[data-entregas-filter-empty]");

      if (visibleCount > 0) {
        empty?.remove();
        return;
      }

      if (!empty) {
        empty = document.createElement("div");
        empty.setAttribute("data-entregas-filter-empty", "1");
        empty.style.minHeight = "220px";
        empty.style.display = "flex";
        empty.style.flexDirection = "column";
        empty.style.alignItems = "center";
        empty.style.justifyContent = "center";
        empty.style.textAlign = "center";
        empty.style.padding = "32px 20px";
        empty.style.border = "1px solid rgba(148,163,184,.22)";
        empty.style.borderRadius = "24px";
        empty.style.background = "rgba(255,255,255,.55)";
        empty.style.marginTop = "12px";
        parent.appendChild(empty);
      }

      empty.innerHTML = deliveredMode
        ? `<div style="font-size:32px;margin-bottom:10px">✓</div><strong style="font-size:15px;color:${titleColor}">Nenhuma entrega concluída</strong><span style="margin-top:5px;font-size:12px;opacity:.62">Os pedidos entregues aparecerão aqui.</span>`
        : `<div style="font-size:32px;margin-bottom:10px">📦</div><strong style="font-size:15px;color:${titleColor}">Nenhum pedido pendente</strong><span style="margin-top:5px;font-size:12px;opacity:.62">Quando houver uma nova entrega para aceitar, ela aparecerá aqui automaticamente.</span>`;
    };

    function apply() {
      if (applying) return;
      applying = true;

      try {
        const root = document.querySelector<HTMLElement>("[data-entregas-central]");
        if (!root) return;

        const allButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("button"));
        const pedidosButton = allButtons.find((button) => normalizeUiText(button.textContent).startsWith("pedidos"));
        const mapaButton = allButtons.find((button) => normalizeUiText(button.textContent).startsWith("mapa"));

        if (!pedidosButton || !mapaButton || pedidosButton.parentElement !== mapaButton.parentElement) return;

        const tabBar = pedidosButton.parentElement as HTMLElement;
        tabBar.style.gridTemplateColumns = "repeat(3, minmax(0, 1fr))";

        if (!pedidosButton.dataset.entregasOrganizerBound) {
          pedidosButton.dataset.entregasOrganizerBound = "1";
          pedidosButton.addEventListener("click", () => {
            mode = "active";
            schedule();
          });
        }

        if (!mapaButton.dataset.entregasOrganizerBound) {
          mapaButton.dataset.entregasOrganizerBound = "1";
          mapaButton.addEventListener("click", () => {
            mode = "map";
            schedule();
          });
        }

        let deliveredButton = tabBar.querySelector<HTMLButtonElement>("[data-entregas-delivered-tab]");
        if (!deliveredButton) {
          deliveredButton = document.createElement("button");
          deliveredButton.type = "button";
          deliveredButton.setAttribute("data-entregas-delivered-tab", "1");
          deliveredButton.className = "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition";
          deliveredButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
            </svg>
            <span>Entregues</span>
            <span data-entregas-delivered-count style="opacity:.7">0</span>
          `;
          deliveredButton.addEventListener("click", () => {
            mode = "delivered";
            pedidosButton.click();
            mode = "delivered";
            schedule();
          });
          tabBar.insertBefore(deliveredButton, mapaButton);
        }

        const articles = Array.from(root.querySelectorAll<HTMLElement>("main article"));

        // Se voltamos do mapa pelo próprio componente, reassume a lista ativa.
        if (articles.length > 0 && mode === "map") {
          const mapLooksActive = mapaButton.style.background && mapaButton.style.background !== "transparent";
          if (!mapLooksActive) mode = "active";
        }

        const activeArticles = articles.filter((article) => !isDeliveredArticle(article));
        const deliveredArticles = articles.filter(isDeliveredArticle);

        for (const article of articles) {
          const delivered = isDeliveredArticle(article);
          const awaiting = !delivered && isAwaitingDecision(article);

          article.style.order = awaiting ? "0" : delivered ? "2" : "1";
          article.style.display =
            mode === "delivered"
              ? delivered
                ? ""
                : "none"
              : mode === "active"
                ? delivered
                  ? "none"
                  : ""
                : "";
        }

        const pedidosCount = pedidosButton.querySelector("span");
        if (pedidosCount) pedidosCount.textContent = String(activeArticles.length);
        const deliveredCount = deliveredButton.querySelector<HTMLElement>("[data-entregas-delivered-count]");
        if (deliveredCount) deliveredCount.textContent = String(deliveredArticles.length);

        if (mode === "active") {
          setButtonVisual(pedidosButton, true);
          setButtonVisual(deliveredButton, false);
          setButtonVisual(mapaButton, false);
        } else if (mode === "delivered") {
          setButtonVisual(pedidosButton, false);
          setButtonVisual(deliveredButton, true);
          setButtonVisual(mapaButton, false);
        } else {
          setButtonVisual(pedidosButton, false);
          setButtonVisual(deliveredButton, false);
          setButtonVisual(mapaButton, true);
        }

        const heading = Array.from(root.querySelectorAll<HTMLHeadingElement>("h2")).find(
          (el) => ["minhas entregas", "pedidos para entregar", "entregas concluidas"].includes(normalizeUiText(el.textContent)),
        );
        if (heading && mode !== "map") {
          heading.textContent = mode === "delivered" ? "Entregas concluídas" : "Pedidos para entregar";
          const headingRow = heading.parentElement?.parentElement;
          const countLabel = headingRow?.lastElementChild as HTMLElement | null;
          if (countLabel) {
            const count = mode === "delivered" ? deliveredArticles.length : activeArticles.length;
            countLabel.textContent = `${count} ${count === 1 ? "pedido" : "pedidos"}`;
          }
        }

        const grid = articles[0]?.parentElement as HTMLElement | undefined;
        if (grid && mode !== "map") {
          const visibleCount = mode === "delivered" ? deliveredArticles.length : activeArticles.length;
          const titleColor = getComputedStyle(root).color || "#13241b";
          ensureEmptyState(grid, visibleCount, mode === "delivered", titleColor);
        }
      } finally {
        applying = false;
      }
    }

    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    schedule();

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}

function EntregasLayout() {
  const { storeSlug } = Route.useParams();

  useEffect(() => {
    const hostname = window.location.hostname.toLowerCase();
    const isLovablePreview =
      hostname.endsWith(".lovable.app") ||
      hostname.endsWith(".lov") ||
      hostname.includes("id-preview--") ||
      hostname.includes("preview");

    if (!isLovablePreview) return;

    const canonicalUrl = `${PRODUCTION_ORIGIN}/entregas-zappfy/${encodeURIComponent(storeSlug)}${window.location.search}${window.location.hash}`;
    window.location.replace(canonicalUrl);
  }, [storeSlug]);

  return (
    <>
      <EntregasPwaShell storeSlug={storeSlug} />
      <DeliveryListOrganizer />
      <style>{`
        [data-entregas-central] {
          min-height: 100dvh;
          background: #08110d;
        }

        @supports (padding-top: env(safe-area-inset-top)) {
          [data-entregas-central] header {
            padding-top: env(safe-area-inset-top);
          }
        }

        @media (max-width: 1023px) {
          [data-entregas-central] header > div {
            height: 68px !important;
            min-height: 68px;
          }

          [data-entregas-central] header button {
            touch-action: manipulation;
          }

          [data-entregas-delivered-tab] {
            font-size: 12px !important;
            gap: 5px !important;
          }
        }
      `}</style>
      <div data-entregas-central>
        <Outlet />
      </div>
    </>
  );
}
