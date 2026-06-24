import { createFileRoute } from "@tanstack/react-router";

import { parsearMensajesEntrantes, verificarWebhookChallenge } from "@/lib/whatsapp-cloud.server";
import { waitUntilBackground } from "@/lib/worker-context.server";
import { procesarMensajeWhatsAppEntrante } from "@/lib/whatsapp-webhook.server";

export const Route = createFileRoute("/api/whatsapp/webhook")({
  server: {
    handlers: {
      /** Verificación inicial de Meta (hub.challenge). */
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const ok = verificarWebhookChallenge(mode, token, challenge);
        if (!ok) {
          return new Response("Forbidden", { status: 403 });
        }
        return new Response(ok, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      },

      /** Mensajes entrantes de clientes. */
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad Request", { status: 400 });
        }

        const mensajes = parsearMensajesEntrantes(payload);

        if (mensajes.length > 0) {
          waitUntilBackground(
            Promise.all(
              mensajes.map((m) =>
                procesarMensajeWhatsAppEntrante({
                  from: m.from,
                  body: m.body,
                  contactName: m.contactName,
                }).catch((err) => {
                  console.error("WhatsApp handler error:", err);
                }),
              ),
            ),
          );
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
