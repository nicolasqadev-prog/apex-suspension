import { createServerFn } from "@tanstack/react-start";

import { z } from "zod";

import { AdminAuthSchema } from "./admin-auth.schema";

import { requireAdminAuth } from "./admin-session.server";

import { allowNoPublicadoEnServidor } from "./admin-preparacion.server";

import { getResumenCatalogoAdmin } from "./inventario-admin.server";

import { telefonoAdminApex } from "./pedidos-alerta.server";

import { listPushSubscriptionsByTelefono } from "./push-subscriptions.server";

import { listTalleresFidelizadosAdmin } from "./talleres-admin.server";

import { normalizeWhatsapp } from "./talleres.server";

import { isWebPushConfigured } from "./web-push.server";

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

  telefonoOperador: string | null;

  whatsappBuildCoincide: boolean;

  operacionVivo: boolean;

  talleresPublicados: number;

  talleresActivos: number;
};

/** Teléfono canónico del operador (mismo que usa el servidor para enviar push). */

export const telefonoOperadorAdmin = createServerFn({ method: "POST" })
  .inputValidator(AdminAuthSchema)

  .handler(async ({ data, request }) => {
    const auth = await requireAdminAuth(request, data.adminPin);

    if (!auth.ok) return { ok: false as const, reason: auth.reason };

    const tel = telefonoAdminApex();

    if (!tel) return { ok: false as const, reason: "sin_telefono_admin" };

    return { ok: true as const, telefono: tel };
  });

export const checklistEstadoAdmin = createServerFn({ method: "POST" })
  .inputValidator(AdminAuthSchema)

  .handler(async ({ data, request }) => {
    const auth = await requireAdminAuth(request, data.adminPin);

    if (!auth.ok) return { ok: false as const, reason: auth.reason };

    const resumen = await getResumenCatalogoAdmin();

    const vapidOk = isWebPushConfigured();

    const adminPinServidor =
      Boolean(process.env.ADMIN_PIN?.trim()) || process.env.NODE_ENV !== "production";

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

    const buildWa = process.env.VITE_WHATSAPP_APEX?.trim();

    const buildNorm = buildWa ? normalizeWhatsapp(buildWa) : null;

    const whatsappBuildCoincide = Boolean(tel && buildNorm && buildNorm === tel);

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

      telefonoOperador: tel,

      whatsappBuildCoincide,

      operacionVivo,

      talleresPublicados,

      talleresActivos,
    };

    return { ok: true as const, estado };
  });
