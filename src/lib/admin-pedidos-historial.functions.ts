import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AdminAuthSchema } from "./admin-auth.schema";
import { requireAdminAuth } from "./admin-session.server";
import { listPedidosHistorial } from "./pedidos.server";

const HistorialSchema = AdminAuthSchema.extend({
  fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  busqueda: z.string().max(80).optional(),
  soloProduccion: z.boolean().optional(),
  incluirLineas: z.boolean().optional(),
});

export const buscarPedidosHistorialAdmin = createServerFn({ method: "POST" })
  .inputValidator(HistorialSchema)
  .handler(async ({ data, request }) => {
    const auth = await requireAdminAuth(request, data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };

    return listPedidosHistorial({
      fechaDesde: data.fechaDesde,
      fechaHasta: data.fechaHasta,
      busqueda: data.busqueda,
      soloProduccion: data.soloProduccion ?? true,
      incluirLineas: data.incluirLineas ?? true,
      limit: 120,
    });
  });
