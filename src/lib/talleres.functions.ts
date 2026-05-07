import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getTallerFidelizadoByWhatsapp } from "./talleres.server";

const InputSchema = z.object({
  whatsapp: z.string().min(6),
});

export const consultarTallerFidelizado = createServerFn({ method: "POST" })
  .inputValidator(InputSchema)
  .handler(async ({ data }) => {
    const taller = await getTallerFidelizadoByWhatsapp(data.whatsapp);
    if (!taller) return { ok: true as const, validado: false as const };
    return {
      ok: true as const,
      validado: true as const,
      contraEntregaHabilitada: taller.contraEntregaHabilitada,
    };
  });
