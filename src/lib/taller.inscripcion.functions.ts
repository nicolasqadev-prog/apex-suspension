import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { setTallerActivo, upsertTallerFidelizado } from "./talleres-admin.server";
import { getTallerFidelizadoByWhatsapp, normalizeWhatsapp } from "./talleres.server";

const DESCUENTO_TALLER_DEFAULT = 16.67;

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX_INSCRIPCION = 12;
const inscripcionByIp = new Map<string, { count: number; firstAt: number }>();

function getIpFromHeaders(headers: Headers): string {
  const cf = headers.get("CF-Connecting-IP");
  if (cf) return cf.trim();
  const xff = headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

function checkRate(ip: string): boolean {
  const now = Date.now();
  const slot = inscripcionByIp.get(ip);
  if (!slot || now - slot.firstAt > RATE_WINDOW_MS) {
    inscripcionByIp.set(ip, { count: 1, firstAt: now });
    return true;
  }
  if (slot.count >= RATE_MAX_INSCRIPCION) return false;
  slot.count += 1;
  return true;
}

const InscripcionSchema = z.object({
  nombreTaller: z.string().min(2).max(120),
  nombreContacto: z.string().min(2).max(80),
  whatsapp: z.string().min(10).max(20),
  municipio: z.string().min(2).max(80),
  aceptaTerminos: z.literal(true),
  aceptaPrecioTaller: z.literal(true),
});

const DesvincularSchema = z.object({
  whatsapp: z.string().min(10).max(20),
  confirmacion: z.literal(true),
});

/** Alta en campo: formulario → activo al instante → puede entrar con su WhatsApp. */
export const inscribirTallerEnCampo = createServerFn({ method: "POST" })
  .inputValidator(InscripcionSchema)
  .handler(async ({ data, request }) => {
    const ip = request ? getIpFromHeaders(request.headers) : "unknown";
    if (!checkRate(ip)) {
      return { ok: false as const, reason: "rate_limit" as const };
    }

    const whatsapp = normalizeWhatsapp(data.whatsapp);
    const nombreTaller = data.nombreTaller.trim();
    const municipio = data.municipio.trim();
    const contacto = data.nombreContacto.trim();

    const nombreConMeta = municipio
      ? `${nombreTaller} (${municipio})`
      : nombreTaller;

    const res = await upsertTallerFidelizado({
      whatsapp,
      nombreTaller: nombreConMeta,
      descuentoPorcentaje: DESCUENTO_TALLER_DEFAULT,
      contraEntregaHabilitada: false,
      activo: true,
      publicado: true,
    });

    if (!res.ok) {
      return { ok: false as const, reason: "guardar_fallo" as const, detalle: res.reason };
    }

    return {
      ok: true as const,
      taller: {
        whatsapp: res.taller.whatsapp,
        nombreTaller: res.taller.nombreTaller,
        descuentoPorcentaje: res.taller.descuentoPorcentaje,
        contraEntregaHabilitada: res.taller.contraEntregaHabilitada,
      },
      contacto,
    };
  });

/** El taller sale del programa (desactiva acceso; Apex puede reactivar desde admin). */
export const desvincularTallerPropio = createServerFn({ method: "POST" })
  .inputValidator(DesvincularSchema)
  .handler(async ({ data, request }) => {
    const ip = request ? getIpFromHeaders(request.headers) : "unknown";
    if (!checkRate(ip)) {
      return { ok: false as const, reason: "rate_limit" as const };
    }

    const whatsapp = normalizeWhatsapp(data.whatsapp);
    const taller = await getTallerFidelizadoByWhatsapp(whatsapp, { allowNoPublicado: true });
    if (!taller) {
      return { ok: false as const, reason: "no_encontrado" as const };
    }

    const off = await setTallerActivo(whatsapp, false);
    if (!off.ok) {
      return { ok: false as const, reason: "desvincular_fallo" as const };
    }

    return { ok: true as const };
  });
