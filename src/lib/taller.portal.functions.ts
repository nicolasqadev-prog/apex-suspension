import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { loadCatalogoTaller, loadPiezaTaller } from "./inventario-taller.server";
import { createPedido } from "./pedidos.server";
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
  municipio: z.string().max(80).optional(),
  direccion: z.string().max(200).optional(),
  notas: z.string().max(500).optional(),
});

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX_LOGIN = 25;
const loginAttemptsByIp = new Map<string, { count: number; firstAt: number }>();

function getIpFromHeaders(headers: Headers): string {
  const cf = headers.get("CF-Connecting-IP");
  if (cf) return cf.trim();
  const xff = headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttemptsByIp.get(ip);
  if (!entry || now - entry.firstAt > RATE_WINDOW_MS) {
    loginAttemptsByIp.set(ip, { count: 1, firstAt: now });
    return true;
  }
  if (entry.count >= RATE_MAX_LOGIN) return false;
  entry.count += 1;
  return true;
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

    const taller = await getTallerFidelizadoByWhatsapp(data.whatsapp);
    if (!taller) {
      return { ok: false as const, reason: "no_autorizado" as const };
    }

    return {
      ok: true as const,
      taller: {
        whatsapp: taller.whatsapp,
        nombreTaller: taller.nombreTaller,
        descuentoPorcentaje: taller.descuentoPorcentaje,
        contraEntregaHabilitada: taller.contraEntregaHabilitada,
      },
    };
  });

export const obtenerCatalogoTaller = createServerFn({ method: "POST" })
  .inputValidator(WhatsappSchema)
  .handler(async ({ data }) => {
    const result = await loadCatalogoTaller(data.whatsapp);
    if (!result.ok) return { ok: false as const, reason: result.reason };
    return {
      ok: true as const,
      taller: result.taller,
      piezas: result.piezas,
      moneda: result.moneda,
    };
  });

export const obtenerPiezaTaller = createServerFn({ method: "POST" })
  .inputValidator(SlugSchema)
  .handler(async ({ data }) => {
    const result = await loadPiezaTaller(data.whatsapp, data.slug);
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
  .handler(async ({ data }) => {
    const catalogo = await loadCatalogoTaller(data.whatsapp);
    if (!catalogo.ok) {
      return { ok: false as const, reason: catalogo.reason };
    }

    const porSlug = new Map(catalogo.piezas.map((p) => [p.slug, p]));
    const lineasValidadas: LineaCarritoTaller[] = [];
    let total = 0;

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
        stock: pieza.stock,
      });
      total += pieza.precioTaller * qty;
    }

    const resumenLineas = lineasValidadas
      .map(
        (l) =>
          `· ${l.referencia} ×${l.cantidad} — ${formatoCop(l.precioUnitarioCop)} c/u` +
          (l.stock <= 0 ? " (sin stock web; confirmar)" : ""),
      )
      .join("\n");

    const notasPedido = [
      "Portal taller fidelizado",
      `Total referencia: ${formatoCop(total)}`,
      "Líneas:",
      resumenLineas,
      data.notas?.trim() ? `Notas taller: ${data.notas.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const pedido = await createPedido({
      tallerNombre: catalogo.taller.nombreTaller,
      whatsapp: catalogo.taller.whatsapp,
      municipio: data.municipio?.trim() || "Por confirmar",
      direccion: data.direccion?.trim() || "Por confirmar en WhatsApp",
      notas: notasPedido,
      requerimiento: "Pedido portal taller",
    });

    if (!pedido.ok) {
      return { ok: false as const, reason: "pedido_fallo" as const };
    }

    const mensajeWhatsapp = [
      "Hola Apex Suspensión,",
      `Pedido desde portal taller (${catalogo.taller.nombreTaller}).`,
      `WhatsApp taller: ${catalogo.taller.whatsapp}`,
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
      lineas: lineasValidadas,
      totalCop: total,
      mensajeWhatsapp,
      contraEntregaHabilitada: catalogo.taller.contraEntregaHabilitada,
    };
  });
