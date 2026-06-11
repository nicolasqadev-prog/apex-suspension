import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { verifyAdminPinValue } from "./admin-auth.server";
import { allowNoPublicadoEnServidor } from "./admin-preparacion.server";
import { getResumenCatalogoAdmin } from "./inventario-admin.server";
import { telefonoAdminApex } from "./pedidos-alerta.server";
import { listPushSubscriptionsByTelefono } from "./push-subscriptions.server";
import { listTalleresFidelizadosAdmin } from "./talleres-admin.server";
import { isWebPushConfigured } from "./web-push.server";

const PinSchema = z.object({
  adminPin: z.string().min(4).max(64),
});

export type AdminReadinessServidor = {
  supabaseVivo: boolean;
  catalogoFuente: "supabase" | "json";
  totalProductos: number;
  conStock: number;
  vapidOk: boolean;
  adminPinServidor: boolean;
  adminWhatsappOk: boolean;
  adminWhatsappMascara: string | null;
  pushSuscripcionesOperador: number;
  operacionVivo: boolean;
  talleresPublicados: number;
  talleresActivos: number;
};

export const checklistEstadoAdmin = createServerFn({ method: "POST" })
  .inputValidator(PinSchema)
  .handler(async ({ data, request }) => {
    const ip = request
      ? request.headers.get("CF-Connecting-IP")?.trim() ||
        request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
      : undefined;
    const auth = verifyAdminPinValue(data.adminPin, { ip });
    if (!auth.ok) return { ok: false as const, reason: auth.reason };

    const resumen = await getResumenCatalogoAdmin();
    const vapidOk = isWebPushConfigured();
    const adminPinServidor = Boolean(process.env.ADMIN_PIN?.trim()) || process.env.NODE_ENV !== "production";

    const tel = telefonoAdminApex();
    let pushSuscripcionesOperador = 0;
    if (tel && vapidOk) {
      const subs = await listPushSubscriptionsByTelefono(tel);
      if (subs.ok) pushSuscripcionesOperador = subs.rows.length;
    }

    let talleresPublicados = 0;
    let talleresActivos = 0;
    const talleresRes = await listTalleresFidelizadosAdmin();
    if (talleresRes.ok) {
      for (const t of talleresRes.talleres) {
        if (t.activo && t.publicado) talleresPublicados += 1;
        if (t.activo) talleresActivos += 1;
      }
    }

    const operacionVivo = !allowNoPublicadoEnServidor();

    const estado: AdminReadinessServidor = {
      supabaseVivo: resumen.fuente === "supabase" && resumen.totalProductos > 50,
      catalogoFuente: resumen.fuente,
      totalProductos: resumen.totalProductos,
      conStock: resumen.conStock,
      vapidOk,
      adminPinServidor,
      adminWhatsappOk: Boolean(tel),
      adminWhatsappMascara: tel ? `***${tel.slice(-4)}` : null,
      pushSuscripcionesOperador,
      operacionVivo,
      talleresPublicados,
      talleresActivos,
    };

    return { ok: true as const, estado };
  });
