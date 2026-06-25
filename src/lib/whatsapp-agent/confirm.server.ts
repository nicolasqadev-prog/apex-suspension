import { calcularPrecioTaller } from "../precio-taller.server";
import { createPedido } from "../pedidos.server";
import { notificarApexNuevoPedido } from "../pedidos-alerta.server";
import { refPedidoCorta } from "../pedidos-estado-taller";
import { getTallerFidelizadoByWhatsapp, normalizeWhatsapp } from "../talleres.server";
import type { BorradorPedidoWa, CarritoItemWa } from "./types";
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
      refPedido: refPedidoCorta(pedido.pedidoId),
      referencia: b.referencia,
      cantidad: b.cantidad,
      totalCop: total,
      urlPedido: urlPedidoPwa(pedido.pedidoId),
    }),
  };
}

/** Registra pedido con varias líneas del carrito de cotización. */
export async function registrarPedidoDesdeCarrito(args: {
  phone: string;
  items: CarritoItemWa[];
  resumenEnviado: string;
  contactName?: string;
  esPrueba?: boolean;
}): Promise<{ ok: true; texto: string; pedidoId: string } | { ok: false; texto: string }> {
  if (args.items.length === 0) {
    return { ok: false, texto: "No hay referencias en tu cotización para registrar." };
  }

  const whatsapp = normalizeWhatsapp(args.phone);
  const taller = await getTallerFidelizadoByWhatsapp(whatsapp);
  const nombre = taller?.nombreTaller?.trim() || args.contactName?.trim() || "Cliente WhatsApp";
  const municipio = taller?.municipio?.trim() || "Por confirmar";
  const direccion = taller?.direccionEntrega?.trim() || "Por confirmar en chat";
  const { loadPiezaBySlug } = await import("../inventario.server");

  const lineas: Array<{
    slug: string;
    referencia: string;
    cantidad: number;
    precioUnitario: number;
  }> = [];

  for (const item of args.items) {
    const piezaData = await loadPiezaBySlug(item.slug);
    if (!piezaData.pieza) {
      return {
        ok: false,
        texto: `No pude validar la ref. *${item.referencia}* en sistema. Un asesor te confirma en breve.`,
      };
    }
    const p = piezaData.pieza;
    const pricing = calcularPrecioTaller(
      { precioLista: p.precioLista, precioTallerRef: p.precioTallerRef },
      taller,
    );
    lineas.push({
      slug: item.slug,
      referencia: item.referencia,
      cantidad: item.cantidad,
      precioUnitario: pricing.precioUnitarioCop,
    });
  }

  const total = lineas.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0);
  const resumenLineas = args.items.map((i) => `${i.referencia} ×${i.cantidad}`).join(", ");

  const pedido = await createPedido(
    {
      tallerNombre: nombre,
      whatsapp,
      municipio,
      direccion,
      notas: [
        "Canal: WhatsApp — agente mostrador (carrito)",
        "Resumen confirmado por el cliente:",
        args.resumenEnviado,
      ].join("\n"),
      requerimiento: `Pedido WhatsApp — ${resumenLineas}`,
    },
    {
      esPrueba: args.esPrueba ?? process.env.WHATSAPP_AUDIT_ES_PRUEBA === "1",
      lineas,
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
      refPedido: refPedidoCorta(pedido.pedidoId),
      referencia: resumenLineas,
      cantidad: args.items.reduce((s, i) => s + i.cantidad, 0),
      totalCop: total,
      urlPedido: urlPedidoPwa(pedido.pedidoId),
      resumenLineas,
    }),
  };
}
