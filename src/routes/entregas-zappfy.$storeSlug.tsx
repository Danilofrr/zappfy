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
    type ListMode = "active" | "scheduled" | "delivered" | "map";
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

    const isScheduledArticle = (article: HTMLElement) => {
      if (isDeliveredArticle(article)) return false;
      const text = normalizeUiText(article.textContent);
      return text.includes("agendada para");
    };

    const getScheduledTimestamp = (article: HTMLElement) => {
      const text = article.textContent || "";
      const match = text.match(/Agendada para\s+(\d{2})\/(\d{2})\/(\d{4})/i);
      if (!match) return Number.MAX_SAFE_INTEGER;
      const [, day, month, year] = match;
      return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0).getTime();
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
      emptyMode: "active" | "scheduled" | "delivered",
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

      if (empty.dataset.mode !== emptyMode) {
        empty.dataset.mode = emptyMode;
        if (emptyMode === "delivered") {
          empty.innerHTML = `<div style="font-size:32px;margin-bottom:10px">✓</div><strong style="font-size:15px;color:${titleColor}">Nenhuma entrega concluída</strong><span style="margin-top:5px;font-size:12px;opacity:.62">Os pedidos entregues aparecerão aqui.</span>`;
        } else if (emptyMode === "scheduled") {
          empty.innerHTML = `<div style="font-size:32px;margin-bottom:10px">📅</div><strong style="font-size:15px;color:${titleColor}">Nenhuma entrega agendada</strong><span style="margin-top:5px;font-size:12px;opacity:.62">Os pedidos programados para datas futuras aparecerão aqui.</span>`;
        } else {
          empty.innerHTML = `<div style="font-size:32px;margin-bottom:10px">📦</div><strong style="font-size:15px;color:${titleColor}">Nenhum pedido pendente</strong><span style="margin-top:5px;font-size:12px;opacity:.62">Quando houver uma nova entrega para aceitar, ela aparecerá aqui automaticamente.</span>`;
        }
      }
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
        tabBar.setAttribute("data-entregas-tabs", "1");
        tabBar.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";

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

        let scheduledButton = tabBar.querySelector<HTMLButtonElement>("[data-entregas-scheduled-tab]");
        if (!scheduledButton) {
          scheduledButton = document.createElement("button");
          scheduledButton.type = "button";
          scheduledButton.setAttribute("data-entregas-scheduled-tab", "1");
          scheduledButton.className = "flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition";
          scheduledButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
            </svg>
            <span>Agendadas</span>
            <span data-entregas-scheduled-count style="opacity:.7">0</span>
          `;
          scheduledButton.addEventListener("click", () => {
            mode = "scheduled";
            pedidosButton.click();
            mode = "scheduled";
            schedule();
          });
          tabBar.insertBefore(scheduledButton, mapaButton);
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

        // Garante a ordem: Pedidos | Agendadas | Entregues | Mapa.
        if (scheduledButton.nextElementSibling !== deliveredButton) {
          tabBar.insertBefore(scheduledButton, deliveredButton);
        }
        if (deliveredButton.nextElementSibling !== mapaButton) {
          tabBar.insertBefore(deliveredButton, mapaButton);
        }

        const articles = Array.from(root.querySelectorAll<HTMLElement>("main article"));

        // Se voltamos do mapa pelo próprio componente, reassume a lista ativa.
        if (articles.length > 0 && mode === "map") {
          const mapLooksActive = mapaButton.style.background && mapaButton.style.background !== "transparent";
          if (!mapLooksActive) mode = "active";
        }

        const deliveredArticles = articles.filter(isDeliveredArticle);
        const scheduledArticles = articles
          .filter((article) => !isDeliveredArticle(article) && isScheduledArticle(article))
          .sort((a, b) => getScheduledTimestamp(a) - getScheduledTimestamp(b));
        const activeArticles = articles.filter(
          (article) => !isDeliveredArticle(article) && !isScheduledArticle(article),
        );

        const scheduledOrder = new Map(scheduledArticles.map((article, index) => [article, index]));

        for (const article of articles) {
          const delivered = isDeliveredArticle(article);
          const scheduled = !delivered && isScheduledArticle(article);
          const awaiting = !delivered && !scheduled && isAwaitingDecision(article);

          const nextOrder = scheduled
            ? String(scheduledOrder.get(article) ?? 0)
            : awaiting
              ? "0"
              : delivered
                ? "2"
                : "1";

          const nextDisplay =
            mode === "delivered"
              ? delivered
                ? ""
                : "none"
              : mode === "scheduled"
                ? scheduled
                  ? ""
                  : "none"
                : mode === "active"
                  ? delivered || scheduled
                    ? "none"
                    : ""
                  : "";

          if (article.style.order !== nextOrder) article.style.order = nextOrder;
          if (article.style.display !== nextDisplay) article.style.display = nextDisplay;
        }

        const pedidosCount = pedidosButton.querySelector("span");
        const activeCountText = String(activeArticles.length);
        if (pedidosCount && pedidosCount.textContent !== activeCountText) pedidosCount.textContent = activeCountText;

        const scheduledCount = scheduledButton.querySelector<HTMLElement>("[data-entregas-scheduled-count]");
        const scheduledCountText = String(scheduledArticles.length);
        if (scheduledCount && scheduledCount.textContent !== scheduledCountText) scheduledCount.textContent = scheduledCountText;

        const deliveredCount = deliveredButton.querySelector<HTMLElement>("[data-entregas-delivered-count]");
        const deliveredCountText = String(deliveredArticles.length);
        if (deliveredCount && deliveredCount.textContent !== deliveredCountText) deliveredCount.textContent = deliveredCountText;

        if (mode === "active") {
          setButtonVisual(pedidosButton, true);
          setButtonVisual(scheduledButton, false);
          setButtonVisual(deliveredButton, false);
          setButtonVisual(mapaButton, false);
        } else if (mode === "scheduled") {
          setButtonVisual(pedidosButton, false);
          setButtonVisual(scheduledButton, true);
          setButtonVisual(deliveredButton, false);
          setButtonVisual(mapaButton, false);
        } else if (mode === "delivered") {
          setButtonVisual(pedidosButton, false);
          setButtonVisual(scheduledButton, false);
          setButtonVisual(deliveredButton, true);
          setButtonVisual(mapaButton, false);
        } else {
          setButtonVisual(pedidosButton, false);
          setButtonVisual(scheduledButton, false);
          setButtonVisual(deliveredButton, false);
          setButtonVisual(mapaButton, true);
        }

        const heading = Array.from(root.querySelectorAll<HTMLHeadingElement>("h2")).find(
          (el) =>
            ["minhas entregas", "pedidos para entregar", "entregas agendadas", "entregas concluidas"].includes(
              normalizeUiText(el.textContent),
            ),
        );
        if (heading && mode !== "map") {
          const nextHeading =
            mode === "delivered"
              ? "Entregas concluídas"
              : mode === "scheduled"
                ? "Entregas agendadas"
                : "Pedidos para entregar";
          if (heading.textContent !== nextHeading) heading.textContent = nextHeading;

          const headingRow = heading.parentElement?.parentElement;
          const countLabel = headingRow?.lastElementChild as HTMLElement | null;
          if (countLabel) {
            const count =
              mode === "delivered"
                ? deliveredArticles.length
                : mode === "scheduled"
                  ? scheduledArticles.length
                  : activeArticles.length;
            const nextLabel = `${count} ${count === 1 ? "pedido" : "pedidos"}`;
            if (countLabel.textContent !== nextLabel) countLabel.textContent = nextLabel;
          }
        }

        const grid = articles[0]?.parentElement as HTMLElement | undefined;
        if (grid && mode !== "map") {
          const visibleCount =
            mode === "delivered"
              ? deliveredArticles.length
              : mode === "scheduled"
                ? scheduledArticles.length
                : activeArticles.length;
          const titleColor = getComputedStyle(root).color || "#13241b";
          ensureEmptyState(grid, visibleCount, mode, titleColor);
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

          [data-entregas-tabs] button {
            min-width: 0;
            padding-left: 4px !important;
            padding-right: 4px !important;
            font-size: 11px !important;
            gap: 4px !important;
          }

          [data-entregas-tabs] button svg {
            width: 14px !important;
            height: 14px !important;
            flex-shrink: 0;
          }
        }

        @media (max-width: 390px) {
          [data-entregas-tabs] button {
            font-size: 10px !important;
            gap: 3px !important;
          }

          [data-entregas-tabs] button svg {
            display: none;
          }
        }
      `}</style>
      <div data-entregas-central>
        <Outlet />
      </div>
    </>
  );
}