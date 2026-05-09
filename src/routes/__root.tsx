import React, { useEffect } from "react";
import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import MostradorChat from "@/components/MostradorChat";
import { siteOriginForHead } from "@/lib/site-url";

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[oklch(0.18_0.04_250)] px-4 text-gray-200">
        <div className="max-w-md text-center">
          <p className="text-white font-semibold">Algo falló inesperadamente.</p>
          <p className="mt-2 text-sm text-gray-400">Recarga la página o escríbenos por WhatsApp.</p>
          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-md bg-[oklch(0.7_0.2_40)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              Ir al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página no encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La dirección no existe o fue movida. Vuelve al inicio de Apex Suspensión.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: (() => {
      const base = siteOriginForHead();
      const ogImage = base ? `${base}/og-image.png` : "/og-image.png";
      return [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "Apex Suspensión" },
        {
          name: "description",
          content:
            "Repuestos de suspensión y dirección en la Sabana. Catálogo, stock referencial y entregas coordinadas. Chía, Cajicá, Zipaquirá y más.",
        },
        { name: "author", content: "Apex Suspensión" },
        { property: "og:title", content: "Apex Suspensión" },
        {
          property: "og:description",
          content:
            "Repuestos de suspensión y dirección en la Sabana. Entregas coordinadas en Chía y alrededores.",
        },
        { property: "og:type", content: "website" },
        ...(base ? ([{ property: "og:url", content: `${base}/` }] as const) : []),
        { property: "og:image", content: ogImage },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:image", content: ogImage },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Apex Suspensión" },
        {
          name: "twitter:description",
          content: "Repuestos de suspensión y dirección en la Sabana. Entregas coordinadas.",
        },
      ];
    })(),
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "manifest",
        href: "/manifest.webmanifest",
      },
      {
        rel: "icon",
        href: "/icon-192.png",
        type: "image/png",
      },
      {
        rel: "icon",
        href: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <ServiceWorkerRegistration />
      <RootErrorBoundary>
        <Outlet />
      </RootErrorBoundary>
      <MostradorChat />
    </>
  );
}

function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Avoid caching issues during local dev (and clean up any older SWs).
    if (!import.meta.env.PROD) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) reg.unregister();
      });
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failed; app still works online.
    });
  }, []);

  return null;
}
