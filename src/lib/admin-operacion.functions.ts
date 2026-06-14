import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { verifyAdminPinValue } from "./admin-auth.server";
import { restablecerStockBodegaDesdeVivo } from "./inventario-admin.server";
import { getModoDemostracion, setModoDemostracion } from "./operacion-config.server";
import { eliminarPedidosPrueba, publicarTalleresBorrador } from "./talleres-admin.server";

const PinSchema = z.object({
  adminPin: z.string().min(4).max(64),
});

const PublicarSchema = PinSchema.extend({
  limpiarPedidosPrueba: z.boolean().optional(),
});

const ModoDemoSchema = PinSchema.extend({
  activo: z.boolean(),
});

export const estadoModoDemostracionAdmin = createServerFn({ method: "POST" })
  .inputValidator(PinSchema)
  .handler(async ({ data }) => {
    const auth = verifyAdminPinValue(data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };
    const modoDemostracion = await getModoDemostracion();
    return { ok: true as const, modoDemostracion };
  });

export const toggleModoDemostracionAdmin = createServerFn({ method: "POST" })
  .inputValidator(ModoDemoSchema)
  .handler(async ({ data }) => {
    const auth = verifyAdminPinValue(data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };
    const res = await setModoDemostracion(data.activo);
    if (!res.ok) return { ok: false as const, reason: res.reason };
    return { ok: true as const, modoDemostracion: res.modoDemostracion };
  });

export const restablecerStockBodegaAdmin = createServerFn({ method: "POST" })
  .inputValidator(PinSchema)
  .handler(async ({ data }) => {
    const auth = verifyAdminPinValue(data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };
    const res = await restablecerStockBodegaDesdeVivo();
    if (!res.ok) return { ok: false as const, reason: res.reason };
    return { ok: true as const, ajustados: res.ajustados, omitidos: res.omitidos };
  });

export const limpiarPedidosPruebaAdmin = createServerFn({ method: "POST" })
  .inputValidator(PinSchema)
  .handler(async ({ data }) => {
    const auth = verifyAdminPinValue(data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };
    const res = await eliminarPedidosPrueba();
    if (!res.ok) return { ok: false as const, reason: res.reason };
    return { ok: true as const, eliminados: res.eliminados };
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
