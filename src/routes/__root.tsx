import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";
import { InstallPrompt } from "@/components/InstallPrompt";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "LucroTrack — Gestão para vendas no WhatsApp" },
      { name: "description", content: "Controle pedidos, vendas, despesas e lucro real do seu negócio." },
      { name: "author", content: "LucroTrack" },
      { name: "theme-color", content: "#10b981" },
      { name: "application-name", content: "LucroTrack" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "LucroTrack" },
      { name: "format-detection", content: "telephone=no" },
      { property: "og:title", content: "LucroTrack — Gestão para vendas no WhatsApp" },
      { property: "og:description", content: "Controle pedidos, vendas, despesas e lucro real do seu negócio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "LucroTrack — Gestão para vendas no WhatsApp" },
      { name: "twitter:description", content: "Controle pedidos, vendas, despesas e lucro real do seu negócio." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/187890b8-200e-4479-9aa3-36e1fd34d5d9/id-preview-535a37ef--912493e0-8d9a-4612-864a-8b23825c6a6f.lovable.app-1781664368778.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/187890b8-200e-4479-9aa3-36e1fd34d5d9/id-preview-535a37ef--912493e0-8d9a-4612-864a-8b23825c6a6f.lovable.app-1781664368778.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const missingRouteGuardScript = `
(function(){
  var MATCH = /Failed to load url \\/src\\/routes\\/([^\\s)]+)/;
  function render(file){
    try {
      document.body.innerHTML =
        '<div style="font-family:ui-sans-serif,system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b0c;color:#fafafa;padding:24px">'+
          '<div style="max-width:560px;text-align:left;border:1px solid #27272a;border-radius:12px;padding:24px;background:#111113">'+
            '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#f87171;margin-bottom:8px">Missing route file</div>'+
            '<h1 style="font-size:20px;font-weight:600;margin:0 0 8px">A route file referenced by the app does not exist</h1>'+
            '<p style="margin:0 0 12px;color:#a1a1aa;font-size:14px">The router tried to load <code style="background:#1f1f23;padding:2px 6px;border-radius:6px">src/routes/'+file+'</code> but the file was not found. Recreate the file or remove references to it, then reload.</p>'+
            '<button onclick="location.reload()" style="margin-top:8px;background:#10b981;color:#04130d;border:0;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer">Reload</button>'+
          '</div>'+
        '</div>';
    } catch(_){}
  }
  function check(msg){
    if (!msg) return;
    var m = String(msg).match(MATCH);
    if (m) render(m[1]);
  }
  window.addEventListener('error', function(e){ check(e && (e.message || (e.error && e.error.message))); }, true);
  window.addEventListener('unhandledrejection', function(e){ check(e && e.reason && (e.reason.message || e.reason)); });
})();
`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: missingRouteGuardScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <StoreProvider>
          <Outlet />
          <InstallPrompt />
          <Toaster position="top-right" />
        </StoreProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
