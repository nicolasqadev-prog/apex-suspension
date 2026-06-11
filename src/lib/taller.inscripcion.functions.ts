import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

/** Alta en campo — deshabilitado: los talleres se certifican solo desde admin. */
export const inscribirTallerEnCampo = createServerFn({ method: "POST" })
  .inputValidator(InscripcionSchema)
  .handler(async () => {
    return {
      ok: false as const,
      reason: "inscripcion_deshabilitada" as const,
      detalle: "Contacta a Apex por WhatsApp para certificar tu taller.",
    };
  });

/** Desvinculación — deshabilitada: solo el operador Apex gestiona talleres en admin. */
export const desvincularTallerPropio = createServerFn({ method: "POST" })
  .inputValidator(DesvincularSchema)
  .handler(async () => {
    return {
      ok: false as const,
      reason: "desvinculacion_deshabilitada" as const,
    };
  });
