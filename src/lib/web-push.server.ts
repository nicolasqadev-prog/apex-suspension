import webpush from "web-push";

import {
  deletePushSubscriptionByEndpoint,
  listPushSubscriptions,
  listPushSubscriptionsByTelefono,
  type PushSubscriptionRow,
} from "./push-subscriptions.server";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

function getVapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY?.trim() || process.env.VITE_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:contacto@apex-suspension.com.co";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function isWebPushConfigured(): boolean {
  return getVapidConfig() !== null;
}

function rowToWebPushSubscription(row: PushSubscriptionRow): webpush.PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.keys_p256dh,
      auth: row.keys_auth,
    },
  };
}

let vapidInitialized = false;

function ensureVapid() {
  const cfg = getVapidConfig();
  if (!cfg) throw new Error("VAPID no configurado en el servidor");
  if (!vapidInitialized) {
    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
    vapidInitialized = true;
  }
  return cfg;
}

export async function sendPushToRow(
  row: PushSubscriptionRow,
  payload: PushPayload,
): Promise<{ ok: true } | { ok: false; expired: boolean }> {
  ensureVapid();
  try {
    await webpush.sendNotification(
      rowToWebPushSubscription(row),
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/",
      }),
    );
    return { ok: true };
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) {
      await deletePushSubscriptionByEndpoint(row.endpoint);
      return { ok: false, expired: true };
    }
    throw err;
  }
}

export async function sendPushBroadcast(
  payload: PushPayload,
): Promise<
  { ok: true; sent: number; failed: number; expired: number } | { ok: false; reason: string }
> {
  if (!isWebPushConfigured()) {
    return { ok: false, reason: "VAPID no configurado (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)" };
  }

  const list = await listPushSubscriptions();
  if (!list.ok) return { ok: false, reason: list.reason };

  let sent = 0;
  let failed = 0;
  let expired = 0;

  for (const row of list.rows) {
    try {
      const res = await sendPushToRow(row, payload);
      if (res.ok) sent += 1;
      else expired += 1;
    } catch {
      failed += 1;
    }
  }

  return { ok: true, sent, failed, expired };
}

export async function sendPushToTelefono(
  rawTelefono: string,
  payload: PushPayload,
): Promise<
  | { ok: true; sent: number; failed: number; expired: number; matched: number }
  | { ok: false; reason: string }
> {
  if (!isWebPushConfigured()) {
    return { ok: false, reason: "VAPID no configurado" };
  }

  const list = await listPushSubscriptionsByTelefono(rawTelefono);
  if (!list.ok) return { ok: false, reason: list.reason };

  let sent = 0;
  let failed = 0;
  let expired = 0;

  for (const row of list.rows) {
    try {
      const res = await sendPushToRow(row, payload);
      if (res.ok) sent += 1;
      else expired += 1;
    } catch {
      failed += 1;
    }
  }

  return { ok: true, sent, failed, expired, matched: list.rows.length };
}

export function mensajePushPorEstadoPedido(estado: string, tallerNombre: string): PushPayload {
  const base = { url: "/taller/pedidos" as const };
  switch (estado) {
    case "cotizado":
      return {
        ...base,
        title: "Cotización lista · Apex",
        body: `${tallerNombre}: revisamos tu pedido y tenemos actualización de cotización.`,
      };
    case "confirmado":
      return {
        ...base,
        title: "Pedido confirmado · Apex",
        body: `${tallerNombre}: tu pedido quedó confirmado. Te avisamos cuando salga a ruta.`,
      };
    case "empacando":
      return {
        ...base,
        title: "Preparando tu pedido · Apex",
        body: `${tallerNombre}: estamos empacando tu pedido en bodega.`,
      };
    case "en_ruta":
      return {
        ...base,
        title: "Pedido en camino · Apex",
        body: `${tallerNombre}: tu pedido va en ruta. Coordinamos contigo la entrega.`,
      };
    case "entregado":
      return {
        ...base,
        title: "Pedido entregado · Apex",
        body: `${tallerNombre}: pedido marcado como entregado. Gracias por confiar en Apex.`,
      };
    case "cancelado":
      return {
        ...base,
        title: "Actualización de pedido · Apex",
        body: `${tallerNombre}: tu pedido fue cancelado. Escríbenos por WhatsApp si necesitas ayuda.`,
      };
    default:
      return {
        ...base,
        title: "Actualización · Apex Suspensión",
        body: `${tallerNombre}: hay novedades en tu pedido (${estado}).`,
      };
  }
}
