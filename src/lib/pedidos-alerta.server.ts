import { esReferenciaBodega } from "./inventario-bodega";
import { formatoPrecioCop } from "./formato-cop";
import { refPedidoCorta } from "./pedidos-estado-taller";
import { normalizeWhatsapp } from "./talleres.server";
import { isWebPushConfigured, sendPushToTelefono, type PushPayload } from "./web-push.server";

/** WhatsApp del operador Apex (solo servidor). Usado para push al teléfono del admin. */
export function telefonoAdminApex(): string | null {
  const raw =
    process.env.APEX_ADMIN_WHATSAPP?.trim() ||
    process.env.WHATSAPP_APEX?.trim() ||
    process.env.VITE_WHATSAPP_APEX?.trim();
  if (!raw) return null;
  const n = normalizeWhatsapp(raw);
  return n.length >= 10 ? n : null;
}

export function mensajePushNuevoPedidoAdmin(input: {
  tallerNombre: string;
  pedidoId: string;
  totalCop: number;
}): PushPayload {
  const ref = refPedidoCorta(input.pedidoId);
  return {
    title: "Nuevo pedido portal · Apex",
    body: `${input.tallerNombre} · #${ref} · ${formatoPrecioCop(input.totalCop)} · revisa en Admin`,
    url: "/admin",
    tag: `apex-pedido-admin-${input.pedidoId}`,
  };
}

/** Avisa al operador Apex cuando entra un pedido real desde el portal taller. */
export async function notificarApexNuevoPedido(input: {
  pedidoId: string;
  tallerNombre: string;
  totalCop: number;
  esPrueba?: boolean;
}): Promise<{ ok: true; sent: number; matched: number } | { ok: false; reason: string }> {
  if (!isWebPushConfigured()) {
    return { ok: false, reason: "vapid_no_configurado" };
  }

  const tel = telefonoAdminApex();
  if (!tel) {
    return { ok: false, reason: "sin_telefono_admin" };
  }

  const ref = refPedidoCorta(input.pedidoId);
  const payload: PushPayload = input.esPrueba
    ? {
        title: "Pedido de prueba · Apex",
        body: `${input.tallerNombre} · #${ref} · ${formatoPrecioCop(input.totalCop)} · modo preparación`,
        url: "/admin",
        tag: `apex-pedido-admin-prueba-${input.pedidoId}`,
      }
    : mensajePushNuevoPedidoAdmin(input);
  const res = await sendPushToTelefono(tel, payload);
  if (!res.ok) return { ok: false, reason: res.reason };

  return { ok: true, sent: res.sent, matched: res.matched };
}

/** Avisa al operador por push cuando el stock queda bajo o agotado tras un pedido. */
export async function notificarAdminStockBajo(input: {
  referencia: string;
  nombre: string;
  stockActual: number;
}): Promise<{ ok: true; sent: number } | { ok: false; reason: string }> {
  if (input.stockActual > 2) {
    return { ok: false, reason: "sin_alerta" };
  }
  if (!esReferenciaBodega(input.referencia)) {
    return { ok: false, reason: "fuera_bodega" };
  }
  if (!isWebPushConfigured()) {
    return { ok: false, reason: "vapid_no_configurado" };
  }
  const tel = telefonoAdminApex();
  if (!tel) return { ok: false, reason: "sin_telefono_admin" };

  const titulo =
    input.stockActual <= 0 ? "Stock agotado · Apex" : "Stock bajo · Apex";
  const cuerpo =
    input.stockActual <= 0
      ? `${input.referencia} sin unidades. Revisa inventario y pedidos pendientes.`
      : `${input.referencia} quedó con ${input.stockActual} u. (${input.nombre.slice(0, 40)})`;

  const res = await sendPushToTelefono(tel, {
    title: titulo,
    body: cuerpo,
    url: "/admin",
    tag: `apex-stock-${input.referencia}`,
  });
  if (!res.ok) return { ok: false, reason: res.reason };
  return { ok: true, sent: res.sent };
}

export function mensajePushPedidoEnviadoTaller(pedidoId: string): PushPayload {
  const ref = refPedidoCorta(pedidoId);
  return {
    title: "Pedido enviado · Apex",
    body: `Tu pedido #${ref} quedó registrado. Te avisamos cuando lo confirmemos.`,
    url: `/taller/pedidos/${pedidoId}`,
    tag: `apex-pedido-${pedidoId}`,
  };
}

/** Confirma al taller por push que el pedido quedó guardado (si activó notificaciones). */
export async function notificarTallerPedidoEnviado(input: {
  pedidoId: string;
  tallerWhatsapp: string;
  esPrueba?: boolean;
}): Promise<{ ok: true; sent: number; matched: number } | { ok: false; reason: string }> {
  if (input.esPrueba) {
    return { ok: false, reason: "pedido_prueba" };
  }

  if (!isWebPushConfigured()) {
    return { ok: false, reason: "vapid_no_configurado" };
  }

  const payload = mensajePushPedidoEnviadoTaller(input.pedidoId);
  const res = await sendPushToTelefono(input.tallerWhatsapp, payload);
  if (!res.ok) return { ok: false, reason: res.reason };

  return { ok: true, sent: res.sent, matched: res.matched };
}
