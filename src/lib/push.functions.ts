import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { verifyAdminPinValue } from "./admin-auth.server";
import { esEstadoPedidoValido, getPedidoById, updatePedidoEstado } from "./pedidos.server";
import { upsertPushSubscription } from "./push-subscriptions.server";
import {
  isWebPushConfigured,
  mensajePushPorEstadoPedido,
  sendPushBroadcast,
  sendPushToTelefono,
} from "./web-push.server";

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(16).max(256),
    auth: z.string().min(8).max(128),
  }),
  telefono: z.string().max(20).optional(),
  userAgent: z.string().max(300).optional(),
});

export const guardarSuscripcionPush = createServerFn({ method: "POST" })
  .inputValidator(SubscriptionSchema)
  .handler(async ({ data }) => {
    return upsertPushSubscription({
      endpoint: data.endpoint,
      keysP256dh: data.keys.p256dh,
      keysAuth: data.keys.auth,
      telefono: data.telefono,
      userAgent: data.userAgent,
    });
  });

const AdminPinSchema = z.object({
  adminPin: z.string().min(4).max(64),
});

const BroadcastSchema = AdminPinSchema.extend({
  title: z.string().min(2).max(80),
  body: z.string().min(2).max(220),
  url: z.string().max(200).optional(),
});

export const enviarNotificacionPushAdmin = createServerFn({ method: "POST" })
  .inputValidator(BroadcastSchema)
  .handler(async ({ data }) => {
    const auth = verifyAdminPinValue(data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };

    if (!isWebPushConfigured()) {
      return { ok: false as const, reason: "VAPID no configurado en el servidor" };
    }

    const result = await sendPushBroadcast({
      title: data.title,
      body: data.body,
      url: data.url?.trim() || "/catalogo",
    });

    if (!result.ok) return { ok: false as const, reason: result.reason };
    return { ok: true as const, ...result };
  });

const UpdatePedidoSchema = AdminPinSchema.extend({
  pedidoId: z.string().uuid(),
  estado: z.string().min(3).max(32),
  notificarCliente: z.boolean().optional(),
});

export const actualizarEstadoPedidoAdmin = createServerFn({ method: "POST" })
  .inputValidator(UpdatePedidoSchema)
  .handler(async ({ data }) => {
    const auth = verifyAdminPinValue(data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };

    if (!esEstadoPedidoValido(data.estado)) {
      return { ok: false as const, reason: "Estado de pedido no válido" };
    }

    const prev = await getPedidoById(data.pedidoId);
    if (!prev.ok) return { ok: false as const, reason: prev.reason };

    const updated = await updatePedidoEstado(data.pedidoId, data.estado);
    if (!updated.ok) return { ok: false as const, reason: updated.reason };

    let push:
      | { sent: number; failed: number; expired: number; matched: number }
      | { skipped: true; reason: string }
      | undefined;

    if (prev.pedido.es_prueba) {
      push = { skipped: true, reason: "Pedido de prueba: no se envía push al cliente" };
    } else if (data.notificarCliente !== false && isWebPushConfigured()) {
      const payload = mensajePushPorEstadoPedido(data.estado, updated.pedido.taller_nombre);
      const sent = await sendPushToTelefono(updated.pedido.telefono, payload);
      if (sent.ok) {
        push = {
          sent: sent.sent,
          failed: sent.failed,
          expired: sent.expired,
          matched: sent.matched,
        };
      } else {
        push = { skipped: true, reason: sent.reason };
      }
    } else if (data.notificarCliente !== false) {
      push = { skipped: true, reason: "VAPID no configurado" };
    }

    return {
      ok: true as const,
      pedido: updated.pedido,
      estadoAnterior: prev.pedido.estado,
      push,
    };
  });

export const estadoPushServidor = createServerFn({ method: "GET" }).handler(async () => {
  return {
    ok: true as const,
    webPushConfigured: isWebPushConfigured(),
  };
});
