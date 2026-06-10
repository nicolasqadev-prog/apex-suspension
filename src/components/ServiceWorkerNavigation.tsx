import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

/** Navegación SPA cuando el usuario toca una notificación push. */
export default function ServiceWorkerNavigation() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type !== "APEX_NAVIGATE" || typeof data.url !== "string") return;

      const path = data.url.split("?")[0] ?? data.url;
      const matchPedido = path.match(/^\/taller\/pedidos\/([0-9a-f-]{36})$/i);
      if (matchPedido) {
        void router.navigate({ to: "/taller/pedidos/$id", params: { id: matchPedido[1]! } });
        return;
      }

      router.history.push(path);
    }

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}
