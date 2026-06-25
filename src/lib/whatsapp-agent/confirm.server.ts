import { calcularPrecioTaller } from "../precio-taller.server";
import { createPedido } from "../pedidos.server";
import { notificarApexNuevoPedido } from "../pedidos-alerta.server";
import { getTallerFidelizadoByWhatsapp, normalizeWhatsapp } from "../talleres.server";
import type { BorradorPedidoWa } from "./types";
import { mensajePedidoRegistrado } from "./copy";

function urlPedidoPwa(pedidoId: string): string {
  const base =
    process.env.VITE_SITE_URL?.trim().replace(/\/$/, "") || "https://apex-suspension.com.co";
  return `${base}/taller/pedidos/${pedidoId}`;
}

/** Registra pedido en Supabase/PWA solo con borrador validado. */
export async function registrarPedidoDesdeBorrador(args: {
  phone: string;
  borrador: BorradorPedidoWa;
  contactName?: string;
  esPrueba?: boolean;
}): Promise<{ ok: true; texto: string; pedidoId: string } | { ok: false; texto: string }> {
  const whatsapp = normalizeWhatsapp(args.phone);
  const taller = await getTallerFidelizadoByWhatsapp(whatsapp);
  const b = args.borrador;

  const { loadPiezaBySlug } = await import("../inventario.server");
  const piezaData = await loadPiezaBySlug(b.slug);
  if (!piezaData.pieza) {
    return {
      ok: false,
      texto: "No pude validar la referencia en sistema. Un asesor te confirma en breve.",
    };
  }

  const p = piezaData.pieza;
  const pricing = calcularPrecioTaller(
    { precioLista: p.precioLista, precioTallerRef: p.precioTallerRef },
    taller,
  );
  const precioUnitario = pricing.precioUnitarioCop;
  const nombre = taller?.nombreTaller?.trim() || args.contactName?.trim() || "Cliente WhatsApp";
  const municipio = taller?.municipio?.trim() || "Por confirmar";
  const direccion = taller?.direccionEntrega?.trim() || "Por confirmar en chat";
  const total = precioUnitario * b.cantidad;

  const pedido = await createPedido(
    {
      tallerNombre: nombre,
      whatsapp,
      municipio,
      direccion,
      notas: [
        "Canal: WhatsApp — agente mostrador",
        "Resumen confirmado por el cliente:",
        b.resumenEnviado,
      ].join("\n"),
      requerimiento: `Pedido WhatsApp — ${b.referencia} ×${b.cantidad}`,
    },
    {
      esPrueba: args.esPrueba ?? process.env.WHATSAPP_AUDIT_ES_PRUEBA === "1",
      lineas: [
        {
          slug: b.slug,
          referencia: b.referencia,
          cantidad: b.cantidad,
          precioUnitario,
        },
      ],
    },
  );

  if (!pedido.ok) {
    return {
      ok: false,
      texto: "Hubo un problema al registrar el pedido. Un asesor humano te confirma en un momento.",
    };
  }

  await notificarApexNuevoPedido({
    pedidoId: pedido.pedidoId,
    tallerNombre: nombre,
    totalCop: total,
    esPrueba: false,
  }).catch(() => {});

  return {
    ok: true,
    pedidoId: pedido.pedidoId,
    texto: mensajePedidoRegistrado({
      referencia: b.referencia,
      cantidad: b.cantidad,
      totalCop: total,
      urlPedido: urlPedidoPwa(pedido.pedidoId),
    }),
  };
}
