import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { verifyAdminPinValue } from "./admin-auth.server";
import { listPedidosRecientes } from "./pedidos.server";

const ListarPedidosSchema = z.object({
  adminPin: z.string().min(4).max(64),
  ventana: z.enum(["dia", "minutos"]).optional(),
  minutes: z.number().int().min(5).max(240).optional(),
  soloPrueba: z.boolean().optional(),
  soloProduccion: z.boolean().optional(),
});

export const listarPedidosRecientes = createServerFn({ method: "POST" })
  .inputValidator(ListarPedidosSchema)
  .handler(async ({ data, request }) => {
    const ip = request
      ? request.headers.get("CF-Connecting-IP")?.trim() ||
        request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
      : undefined;
    const auth = verifyAdminPinValue(data.adminPin, { ip });
    if (!auth.ok) return { ok: false as const, reason: auth.reason };

    return listPedidosRecientes({
      ventana: data.ventana ?? "dia",
      minutes: data.minutes ?? 120,
      soloPrueba: data.soloPrueba,
      soloProduccion: data.soloProduccion,
    });
  });
