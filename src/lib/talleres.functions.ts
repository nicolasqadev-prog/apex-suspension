import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { checkRateLimit, getClientIp } from "./rate-limit.server";
import { getTallerFidelizadoByWhatsapp } from "./talleres.server";

const InputSchema = z.object({
  whatsapp: z.string().min(6),
});

const RATE_MAX_CONSULTAS = 12;
const RATE_WINDOW_MS = 10 * 60_000;

export const consultarTallerFidelizado = createServerFn({ method: "POST" })
  .inputValidator(InputSchema)
  .handler(async ({ data, request }) => {
    const ip = getClientIp(request);
    if (!checkRateLimit("taller-consulta", ip, RATE_MAX_CONSULTAS, RATE_WINDOW_MS)) {
      return { ok: false as const, reason: "Demasiadas consultas. Intenta más tarde." };
    }

    const taller = await getTallerFidelizadoByWhatsapp(data.whatsapp);
    if (!taller) return { ok: true as const, validado: false as const };
    return {
      ok: true as const,
      validado: true as const,
      contraEntregaHabilitada: taller.contraEntregaHabilitada,
    };
  });
