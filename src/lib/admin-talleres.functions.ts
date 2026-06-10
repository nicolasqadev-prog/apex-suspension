import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { verifyAdminPinValue } from "./admin-auth.server";
import {
  certificarTallerFidelizado,
  deleteTallerFidelizado,
  listTalleresFidelizadosAdmin,
  setTallerActivo,
  upsertTallerFidelizado,
} from "./talleres-admin.server";
import { ultimosPedidosPorTelefonos } from "./pedidos.server";

const PinSchema = z.object({
  adminPin: z.string().min(4).max(64),
});

const TallerSchema = PinSchema.extend({
  whatsapp: z.string().min(10).max(20),
  nombreTaller: z.string().min(2).max(120),
  descuentoPorcentaje: z.number().min(0).max(50),
  contraEntregaHabilitada: z.boolean(),
  activo: z.boolean().optional(),
  publicado: z.boolean().optional(),
});

const WhatsappPinSchema = PinSchema.extend({
  whatsapp: z.string().min(10).max(20),
});

function checkAdmin(pin: string) {
  return verifyAdminPinValue(pin);
}

export const listarTalleresAdmin = createServerFn({ method: "POST" })
  .inputValidator(PinSchema)
  .handler(async ({ data }) => {
    const auth = checkAdmin(data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };
    const talleresRes = await listTalleresFidelizadosAdmin();
    if (!talleresRes.ok) return talleresRes;
    const actividad = await ultimosPedidosPorTelefonos(
      talleresRes.talleres.map((t) => t.whatsapp),
    );
    return {
      ok: true as const,
      talleres: talleresRes.talleres,
      ultimosPedidos: actividad.ok ? actividad.pedidos : [],
    };
  });

export const guardarTallerAdmin = createServerFn({ method: "POST" })
  .inputValidator(TallerSchema)
  .handler(async ({ data }) => {
    const auth = checkAdmin(data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };
    return upsertTallerFidelizado({
      whatsapp: data.whatsapp,
      nombreTaller: data.nombreTaller,
      descuentoPorcentaje: data.descuentoPorcentaje,
      contraEntregaHabilitada: data.contraEntregaHabilitada,
      activo: data.activo,
      publicado: data.publicado,
    });
  });

export const desactivarTallerAdmin = createServerFn({ method: "POST" })
  .inputValidator(WhatsappPinSchema)
  .handler(async ({ data }) => {
    const auth = checkAdmin(data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };
    return setTallerActivo(data.whatsapp, false);
  });

export const reactivarTallerAdmin = createServerFn({ method: "POST" })
  .inputValidator(WhatsappPinSchema)
  .handler(async ({ data }) => {
    const auth = checkAdmin(data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };
    return setTallerActivo(data.whatsapp, true);
  });

export const certificarTallerAdmin = createServerFn({ method: "POST" })
  .inputValidator(WhatsappPinSchema)
  .handler(async ({ data }) => {
    const auth = checkAdmin(data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };
    return certificarTallerFidelizado(data.whatsapp);
  });

export const eliminarTallerAdmin = createServerFn({ method: "POST" })
  .inputValidator(WhatsappPinSchema)
  .handler(async ({ data }) => {
    const auth = checkAdmin(data.adminPin);
    if (!auth.ok) return { ok: false as const, reason: auth.reason };
    return deleteTallerFidelizado(data.whatsapp);
  });
