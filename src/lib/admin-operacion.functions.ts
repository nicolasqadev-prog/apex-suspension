import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { verifyAdminPinValue } from "./admin-auth.server";
import {
  eliminarPedidosPrueba,
  publicarTalleresBorrador,
} from "./talleres-admin.server";

const PublicarSchema = z.object({
  adminPin: z.string().min(4).max(64),
  limpiarPedidosPrueba: z.boolean().optional(),
});

export const publicarOperacionVivoAdmin = createServerFn({ method: "POST" })
  .inputValidator(PublicarSchema)
  .handler(async ({ data }) => {
    const auth = verifyAdminPinValue(data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };

    const talleres = await publicarTalleresBorrador();
    if (!talleres.ok) return { ok: false as const, reason: talleres.reason };

    let pedidosEliminados = 0;
    if (data.limpiarPedidosPrueba !== false) {
      const limpio = await eliminarPedidosPrueba();
      if (!limpio.ok) return { ok: false as const, reason: limpio.reason };
      pedidosEliminados = limpio.eliminados;
    }

    return {
      ok: true as const,
      talleresPublicados: talleres.publicados,
      pedidosPruebaEliminados: pedidosEliminados,
    };
  });
