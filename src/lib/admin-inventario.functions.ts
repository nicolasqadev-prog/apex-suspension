import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AdminAuthSchema } from "./admin-auth.schema";
import { requireAdminAuth } from "./admin-session.server";
import {
  STOCK_UMBRAL_ALERTA,
  buscarProductosAdmin,
  buscarProductosJsonLocal,
  getResumenCatalogoAdmin,
  listarProductosStockBajo,
  registrarMovimientoStock,
} from "./inventario-admin.server";

const BuscarSchema = AdminAuthSchema.extend({
  query: z.string().max(80),
  limit: z.number().int().min(1).max(50).optional(),
});

const MovimientoSchema = AdminAuthSchema.extend({
  productoId: z.string().uuid(),
  delta: z.number().int().min(-9999).max(9999),
  motivo: z.string().min(2).max(200),
});

export const resumenCatalogoAdmin = createServerFn({ method: "POST" })
  .inputValidator(AdminAuthSchema)
  .handler(async ({ data, request }) => {
    const auth = await requireAdminAuth(request, data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };
    const resumen = await getResumenCatalogoAdmin();
    return { ok: true as const, resumen };
  });

export const buscarProductosInventarioAdmin = createServerFn({ method: "POST" })
  .inputValidator(BuscarSchema)
  .handler(async ({ data, request }) => {
    const auth = await requireAdminAuth(request, data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };

    const res = await buscarProductosAdmin(data.query, data.limit ?? 25);
    if (res.ok) {
      return {
        ok: true as const,
        productos: res.productos,
        fuente: "supabase" as const,
      };
    }

    const local = buscarProductosJsonLocal(data.query, data.limit ?? 25);
    return {
      ok: true as const,
      productos: local,
      fuente: "json" as const,
      aviso: res.reason,
    };
  });

export const listarAlertasStockAdmin = createServerFn({ method: "POST" })
  .inputValidator(AdminAuthSchema)
  .handler(async ({ data, request }) => {
    const auth = await requireAdminAuth(request, data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };

    const res = await listarProductosStockBajo(STOCK_UMBRAL_ALERTA, 40);
    if (!res.ok) return { ok: false as const, reason: res.reason };
    return {
      ok: true as const,
      productos: res.productos,
      umbral: STOCK_UMBRAL_ALERTA,
    };
  });

export const ajustarStockAdmin = createServerFn({ method: "POST" })
  .inputValidator(MovimientoSchema)
  .handler(async ({ data, request }) => {
    const auth = await requireAdminAuth(request, data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };

    const result = await registrarMovimientoStock({
      productoId: data.productoId,
      delta: data.delta,
      motivo: data.motivo,
    });
    if (!result.ok) return { ok: false as const, reason: result.reason };
    return { ok: true as const, stockActual: result.stockActual };
  });
