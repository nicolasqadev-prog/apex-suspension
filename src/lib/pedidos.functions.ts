import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AdminAuthSchema } from "./admin-auth.schema";
import { requireAdminAuth } from "./admin-session.server";
import { listPedidosRecientes } from "./pedidos.server";

const ListarPedidosSchema = AdminAuthSchema.extend({
  ventana: z.enum(["dia", "minutos"]).optional(),
  minutes: z.number().int().min(5).max(240).optional(),
  soloPrueba: z.boolean().optional(),
  soloProduccion: z.boolean().optional(),
});

export const listarPedidosRecientes = createServerFn({ method: "POST" })
  .inputValidator(ListarPedidosSchema)
  .handler(async ({ data, request }) => {
    const auth = await requireAdminAuth(request, data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };

    return listPedidosRecientes({
      ventana: data.ventana ?? "dia",
      minutes: data.minutes ?? 120,
      soloPrueba: data.soloPrueba,
      soloProduccion: data.soloProduccion,
    });
  });
