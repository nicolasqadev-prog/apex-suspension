import { parsearMensajesEntrantes, verificarWebhookChallenge } from "./whatsapp-cloud.server";
import { procesarMensajeWhatsAppEntrante } from "./whatsapp-webhook.server";

function contarEventosStatus(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const obj = payload as {
    entry?: Array<{ changes?: Array<{ value?: { statuses?: unknown[] } }> }>;
  };
  let n = 0;
  for (const entry of obj.entry ?? []) {
    for (const change of entry.changes ?? []) {
      n += change.value?.statuses?.length ?? 0;
    }
  }
  return n;
}

/** Maneja GET/POST del webhook de Meta en el entrypoint del Worker (ctx.waitUntil real). */
export async function handleWhatsAppWebhookRequest(
  request: Request,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const ok = verificarWebhookChallenge(
      url.searchParams.get("hub.mode"),
      url.searchParams.get("hub.verify_token"),
      url.searchParams.get("hub.challenge"),
    );
    if (!ok) {
      return new Response("Forbidden", { status: 403 });
    }
    return new Response(ok, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const mensajes = parsearMensajesEntrantes(payload);
  const statusCount = contarEventosStatus(payload);

  if (mensajes.length === 0) {
    console.log(
      `WhatsApp webhook POST sin mensajes (${statusCount} status):`,
      JSON.stringify(payload).slice(0, 400),
    );
    return new Response(JSON.stringify({ ok: true, processed: 0, status_events: statusCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(
    "WhatsApp webhook:",
    mensajes.map((m) => ({ from: m.from, body: m.body.slice(0, 80) })),
  );

  const work = Promise.all(
    mensajes.map((m) =>
      procesarMensajeWhatsAppEntrante({
        from: m.from,
        body: m.body,
        contactName: m.contactName,
      }).catch((err) => {
        console.error("WhatsApp handler error:", err);
      }),
    ),
  );

  ctx.waitUntil(work);

  return new Response(JSON.stringify({ ok: true, processed: mensajes.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
