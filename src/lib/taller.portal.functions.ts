import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { allowNoPublicadoEnServidor } from "./admin-preparacion.server";
import { loadCatalogoTaller, loadPiezaTaller } from "./inventario-taller.server";
import { getModoDemostracion } from "./operacion-config.server";
import { notificarApexNuevoPedido, notificarTallerPedidoEnviado } from "./pedidos-alerta.server";
import { createPedido, getPedidoById, getPedidoLineas, listPedidosPorTelefono } from "./pedidos.server";
import { getTallerFidelizadoByWhatsapp } from "./talleres.server";
import type { LineaCarritoTaller } from "./taller.types";

const WhatsappSchema = z.object({
  whatsapp: z.string().min(7).max(20),
});

const SlugSchema = z.object({
  whatsapp: z.string().min(7).max(20),
  slug: z.string().min(1).max(120),
});

const LineaPedidoSchema = z.object({
  slug: z.string().min(1).max(120),
  cantidad: z.number().int().min(1).max(999),
});

const PedidoTallerSchema = z.object({
  whatsapp: z.string().min(7).max(20),
  lineas: z.array(LineaPedidoSchema).min(1).max(80),
  notas: z.string().max(500).optional(),
});

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX_LOGIN = 25;
const RATE_MAX_PEDIDOS = 12;
const loginAttemptsByIp = new Map<string, { count: number; firstAt: number }>();
const pedidoAttemptsByIp = new Map<string, { count: number; firstAt: number }>();

function getIpFromHeaders(headers: Headers): string {
  const cf = headers.get("CF-Connecting-IP");
  if (cf) return cf.trim();
  const xff = headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

function checkRateLimit(
  ip: string,
  store: Map<string, { count: number; firstAt: number }>,
  max: number,
): boolean {
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now - entry.firstAt > RATE_WINDOW_MS) {
    store.set(ip, { count: 1, firstAt: now });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

function checkLoginRateLimit(ip: string): boolean {
  return checkRateLimit(ip, loginAttemptsByIp, RATE_MAX_LOGIN);
}

function checkPedidoRateLimit(ip: string): boolean {
  return checkRateLimit(ip, pedidoAttemptsByIp, RATE_MAX_PEDIDOS);
}

function formatoCop(cop: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cop);
}

export const iniciarSesionTaller = createServerFn({ method: "POST" })
  .inputValidator(WhatsappSchema)
  .handler(async ({ data, request }) => {
    const ip = request ? getIpFromHeaders(request.headers) : "unknown";
    if (!checkLoginRateLimit(ip)) {
      return { ok: false as const, reason: "rate_limit" as const };
    }

    const allowBorrador = allowNoPublicadoEnServidor();
    const taller = await getTallerFidelizadoByWhatsapp(data.whatsapp, {
      allowNoPublicado: allowBorrador,
    });
    if (!taller) {
      const borrador = await getTallerFidelizadoByWhatsapp(data.whatsapp, {
        allowNoPublicado: true,
      });
      if (borrador && !borrador.publicado) {
        return { ok: false as const, reason: "pendiente_certificacion" as const };
      }
      return { ok: false as const, reason: "no_autorizado" as const };
    }

    return {
      ok: true as const,
      taller: {
        whatsapp: taller.whatsapp,
        nombreTaller: taller.nombreTaller,
        descuentoPorcentaje: taller.descuentoPorcentaje,
        contraEntregaHabilitada: taller.contraEntregaHabilitada,
        municipio: taller.municipio,
        direccionEntrega: taller.direccionEntrega,
      },
      modoDemostracion: await getModoDemostracion(),
    };
  });

export const obtenerCatalogoTaller = createServerFn({ method: "POST" })
  .inputValidator(WhatsappSchema)
  .handler(async ({ data }) => {
    const result = await loadCatalogoTaller(data.whatsapp, {
      allowNoPublicado: allowNoPublicadoEnServidor(),
    });
    if (!result.ok) return { ok: false as const, reason: result.reason };
    return {
      ok: true as const,
      taller: result.taller,
      piezas: result.piezas,
      moneda: result.moneda,
      fuente: result.fuente,
      modoDemostracion: await getModoDemostracion(),
    };
  });

export const obtenerPiezaTaller = createServerFn({ method: "POST" })
  .inputValidator(SlugSchema)
  .handler(async ({ data }) => {
    const result = await loadPiezaTaller(data.whatsapp, data.slug, {
      allowNoPublicado: allowNoPublicadoEnServidor(),
    });
    if (!result.ok) return { ok: false as const, reason: result.reason };
    return {
      ok: true as const,
      taller: result.taller,
      pieza: result.pieza,
      moneda: result.moneda,
    };
  });

export const enviarPedidoTaller = createServerFn({ method: "POST" })
  .inputValidator(PedidoTallerSchema)
  .handler(async ({ data, request }) => {
    const ip = request ? getIpFromHeaders(request.headers) : "unknown";
    if (!checkPedidoRateLimit(ip)) {
      return { ok: false as const, reason: "rate_limit" as const };
    }

    const catalogo = await loadCatalogoTaller(data.whatsapp, {
      allowNoPublicado: allowNoPublicadoEnServidor(),
    });
    if (!catalogo.ok) {
      return { ok: false as const, reason: catalogo.reason };
    }

    const porSlug = new Map(catalogo.piezas.map((p) => [p.slug, p]));
    const lineasValidadas: LineaCarritoTaller[] = [];
    let total = 0;
    let totalPublico = 0;

    for (const l of data.lineas) {
      const pieza = porSlug.get(l.slug);
      if (!pieza) {
        return { ok: false as const, reason: "linea_invalida" as const };
      }
      let qty = l.cantidad;
      if (pieza.stock > 0 && qty > pieza.stock) qty = pieza.stock;
      lineasValidadas.push({
        slug: pieza.slug,
        referencia: pieza.referencia,
        nombre: pieza.nombre,
        cantidad: qty,
        precioUnitarioCop: pieza.precioTaller,
        precioListaPublicoCop: pieza.precioLista,
        stock: pieza.stock,
      });
      total += pieza.precioTaller * qty;
      totalPublico += pieza.precioLista * qty;
    }

    const ahorroCop = Math.max(0, totalPublico - total);

    const resumenLineas = lineasValidadas
      .map(
        (l) =>
          `· ${l.referencia} ×${l.cantidad} — ${formatoCop(l.precioUnitarioCop)} c/u` +
          (l.stock <= 0 ? " (sin stock web; confirmar)" : ""),
      )
      .join("\n");

    const esPrueba = !catalogo.taller.publicado || (await getModoDemostracion());

    const notasPedido = [
      esPrueba ? "[PRUEBA — no operación]" : "Portal taller fidelizado",
      `Total referencia: ${formatoCop(total)}`,
      "Líneas:",
      resumenLineas,
      data.notas?.trim() ? `Notas taller: ${data.notas.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const municipio =
      catalogo.taller.municipio.trim() || "Por confirmar";
    const direccion =
      catalogo.taller.direccionEntrega.trim() || "Por confirmar en WhatsApp";

    const pedido = await createPedido(
      {
        tallerNombre: catalogo.taller.nombreTaller,
        whatsapp: catalogo.taller.whatsapp,
        municipio,
        direccion,
        notas: notasPedido,
        requerimiento: esPrueba ? "Pedido de prueba (preparación)" : "Pedido portal taller",
      },
      {
        esPrueba,
        lineas: lineasValidadas.map((l) => ({
          slug: l.slug,
          referencia: l.referencia,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitarioCop,
        })),
      },
    );

    if (!pedido.ok) {
      return { ok: false as const, reason: "pedido_fallo" as const };
    }

    await notificarApexNuevoPedido({
      pedidoId: pedido.pedidoId,
      tallerNombre: catalogo.taller.nombreTaller,
      totalCop: total,
      esPrueba,
    }).catch(() => {
      // No bloquea el pedido si falla la alerta push al operador.
    });

    await notificarTallerPedidoEnviado({
      pedidoId: pedido.pedidoId,
      tallerWhatsapp: catalogo.taller.whatsapp,
      esPrueba,
    }).catch(() => {
      // No bloquea el pedido si el taller aún no activó notificaciones.
    });

    const mensajeWhatsapp = [
      "Hola Apex Suspensión,",
      `Pedido desde portal taller (${catalogo.taller.nombreTaller}).`,
      `WhatsApp taller: ${catalogo.taller.whatsapp}`,
      `Entrega: ${municipio} — ${direccion}`,
      "",
      resumenLineas,
      "",
      `Total referencia: ${formatoCop(total)}`,
      data.notas?.trim() ? `Notas: ${data.notas.trim()}` : null,
      "",
      "Quedo atento a confirmación de stock y despacho.",
    ]
      .filter((line) => line !== null)
      .join("\n");

    return {
      ok: true as const,
      pedidoId: pedido.pedidoId,
      lineas: lineasValidadas,
      totalCop: total,
      ahorroCop,
      mensajeWhatsapp,
      contraEntregaHabilitada: catalogo.taller.contraEntregaHabilitada,
      esPrueba,
    };
  });

const PedidoIdSchema = z.object({
  whatsapp: z.string().min(7).max(20),
  pedidoId: z.string().uuid(),
});

export const listarMisPedidosTaller = createServerFn({ method: "POST" })
  .inputValidator(WhatsappSchema)
  .handler(async ({ data }) => {
    const allowBorrador = allowNoPublicadoEnServidor();
    const taller = await getTallerFidelizadoByWhatsapp(data.whatsapp, {
      allowNoPublicado: allowBorrador,
    });
    if (!taller) return { ok: false as const, reason: "no_autorizado" as const };

    const res = await listPedidosPorTelefono(taller.whatsapp, {
      dias: 30,
      incluirPrueba: allowNoPublicadoEnServidor(),
    });
    if (!res.ok) return { ok: false as const, reason: "listar_fallo" as const };
    return { ok: true as const, pedidos: res.pedidos };
  });

export const obtenerDetallePedidoTaller = createServerFn({ method: "POST" })
  .inputValidator(PedidoIdSchema)
  .handler(async ({ data }) => {
    const allowBorrador = allowNoPublicadoEnServidor();
    const taller = await getTallerFidelizadoByWhatsapp(data.whatsapp, {
      allowNoPublicado: allowBorrador,
    });
    if (!taller) return { ok: false as const, reason: "no_autorizado" as const };

    const pedidoRes = await getPedidoById(data.pedidoId);
    if (!pedidoRes.ok) return { ok: false as const, reason: "no_encontrado" as const };

    const telPedido = pedidoRes.pedido.telefono.replace(/\D/g, "");
    const telTaller = taller.whatsapp.replace(/\D/g, "");
    if (telPedido !== telTaller) {
      return { ok: false as const, reason: "no_autorizado" as const };
    }

    const lineasRes = await getPedidoLineas(data.pedidoId);
    const lineas = lineasRes.ok ? lineasRes.lineas : [];

    let totalCop = 0;
    for (const l of lineas) {
      totalCop += Number(l.precio_unitario) * l.cantidad;
    }

    return {
      ok: true as const,
      pedido: pedidoRes.pedido,
      lineas,
      totalCop,
    };
  });
