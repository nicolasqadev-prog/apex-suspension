import { calcularPrecioTaller } from "../precio-taller.server";
import {
  acumularTextoUsuario,
  detectarAlcanceMensaje,
  esConsultaMultiplePiezas,
  extraerCantidadSolicitada,
  extraerContextoCotizacion,
  extraerContextoDesdeHistorial,
  extraerMarcasMencionadas,
  extraerReferencias,
  resolverBusquedaMostrador,
  segmentarConsultasPieza,
  vendemosMarca,
  type ContextoCotizacion,
  type ProductoMostrador,
} from "../mostrador-inventario.server";
import type { MostradorCotizacionLinea } from "../mostrador";
import { getTallerFidelizadoByWhatsapp } from "../talleres.server";
import type { BorradorPedidoWa } from "./types";
import { buildConfirmToken } from "./intents";
import { mensajeResumenPedido } from "./copy";

function ultimoMensajeUsuario(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  const users = history.filter((m) => m.role === "user");
  return users[users.length - 1]?.content?.trim() ?? "";
}

function mapLinea(
  p: ProductoMostrador,
  taller: Awaited<ReturnType<typeof getTallerFidelizadoByWhatsapp>>,
  cantidadSugerida = 1,
): MostradorCotizacionLinea & { esPrecioTaller: boolean; nombreTaller?: string } {
  const pricing = calcularPrecioTaller(
    { precioLista: p.precioPublico, precioTallerRef: p.precioTallerRef },
    taller,
  );
  return {
    slug: p.slug,
    referencia: p.referencia,
    nombre: p.nombre,
    marcaProducto: p.marcaProducto,
    precioUnitarioCop: pricing.precioUnitarioCop,
    precioPublicoCop: pricing.precioPublicoCop,
    stock: p.stock,
    disponibilidad: p.disponibilidad,
    cantidadSugerida,
    esPrecioTaller: pricing.esPrecioTaller,
    nombreTaller: pricing.nombreTaller,
  };
}

export function resumenVehiculo(ctx: ContextoCotizacion): string {
  return [ctx.marcaVehiculo, ctx.vehiculo, ctx.ano].filter(Boolean).join(" ");
}

export function resumenPieza(ctx: ContextoCotizacion): string {
  const parts = [ctx.pieza, ctx.posicion, ctx.lado].filter(Boolean);
  return parts.length ? parts.join(" ") : "repuesto solicitado";
}

export type ItemCotizacionWa =
  | {
      estado: "ok";
      segmento: string;
      ctx: ContextoCotizacion;
      alcance: BorradorPedidoWa["alcance"];
      linea: MostradorCotizacionLinea & { esPrecioTaller: boolean; nombreTaller?: string };
      aplicacion: string;
      cantidadSugerida: number;
    }
  | {
      estado: "sin_match" | "falta_contexto";
      segmento: string;
      ctx: ContextoCotizacion;
      cantidadSugerida: number;
    };

export type ResultadoCotizacionWa =
  | { tipo: "fuera_alcance" }
  | { tipo: "falta_contexto"; ctx: ContextoCotizacion }
  | { tipo: "sin_match"; ctx: ContextoCotizacion }
  | { tipo: "marca_no_vendida"; marca: string }
  | {
      tipo: "cotizacion";
      linea: MostradorCotizacionLinea;
      aplicacion: string;
      ctx: ContextoCotizacion;
      alcance: BorradorPedidoWa["alcance"];
      esPrecioTaller: boolean;
      nombreTaller?: string;
    }
  | {
      tipo: "cotizacion_multiple";
      items: ItemCotizacionWa[];
      esPrecioTaller: boolean;
      nombreTaller?: string;
    };

async function cotizarSegmento(
  segmento: string,
  taller: Awaited<ReturnType<typeof getTallerFidelizadoByWhatsapp>>,
): Promise<ItemCotizacionWa> {
  const cantidadSugerida = extraerCantidadSolicitada(segmento);
  const ctx = extraerContextoCotizacion(segmento);
  const alcance = detectarAlcanceMensaje(segmento);

  if (ctx.pieza && !ctx.marcaVehiculo && !ctx.vehiculo && extraerReferencias(segmento).length === 0) {
    return { estado: "falta_contexto", segmento, ctx, cantidadSugerida };
  }

  const productos = await resolverBusquedaMostrador(segmento, ctx.pieza);
  if (productos.length === 0) {
    return { estado: "sin_match", segmento, ctx, cantidadSugerida };
  }

  const producto = productos[0];
  const linea = mapLinea(producto, taller, cantidadSugerida);
  const marcas = extraerMarcasMencionadas(segmento);
  const marcaNoVendida = marcas.find((m) => !vendemosMarca(m));
  if (marcaNoVendida && linea.marcaProducto.toUpperCase() !== marcaNoVendida) {
    return { estado: "sin_match", segmento, ctx, cantidadSugerida };
  }

  return {
    estado: "ok",
    segmento,
    ctx,
    alcance,
    linea,
    aplicacion: producto.aplicacion,
    cantidadSugerida,
  };
}

async function cotizarMultiples(
  segmentos: string[],
  taller: Awaited<ReturnType<typeof getTallerFidelizadoByWhatsapp>>,
): Promise<ItemCotizacionWa[]> {
  const items: ItemCotizacionWa[] = [];
  for (const segmento of segmentos) {
    items.push(await cotizarSegmento(segmento, taller));
  }
  return items;
}

/** Cotización determinística desde catálogo (sin Groq). */
export async function cotizarDesdeCatalogoWhatsApp(args: {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  whatsapp?: string;
}): Promise<ResultadoCotizacionWa> {
  const ultimo = ultimoMensajeUsuario(args.history);
  const w = args.whatsapp?.trim();
  const tallerRow = w ? await getTallerFidelizadoByWhatsapp(w) : null;
  const esPrecioTaller = Boolean(tallerRow);
  const nombreTaller = tallerRow?.nombreTaller;

  if (esConsultaMultiplePiezas(ultimo)) {
    const segmentos = segmentarConsultasPieza(ultimo);
    const items = await cotizarMultiples(segmentos, tallerRow);
    const conMatch = items.filter((i) => i.estado === "ok");
    if (conMatch.length === 0) {
      const primero = items[0];
      if (primero?.estado === "falta_contexto") {
        return { tipo: "falta_contexto", ctx: primero.ctx };
      }
      return { tipo: "sin_match", ctx: primero?.ctx ?? extraerContextoCotizacion(ultimo) };
    }
    return { tipo: "cotizacion_multiple", items, esPrecioTaller, nombreTaller };
  }

  const texto = acumularTextoUsuario(args.history);
  const ctxUltimo = extraerContextoCotizacion(ultimo || texto);
  const ctx = ctxUltimo.listoParaCotizar
    ? ctxUltimo
    : extraerContextoDesdeHistorial(args.history);
  const alcance = detectarAlcanceMensaje(ultimo || texto);

  if (alcance === "fuera_alcance") {
    const probe = await resolverBusquedaMostrador(ultimo || texto);
    if (probe.length === 0) return { tipo: "fuera_alcance" };
  }

  const marcas = extraerMarcasMencionadas(ultimo || texto);
  const marcaNoVendida = marcas.find((m) => !vendemosMarca(m));

  if (ctx.pieza && !ctx.marcaVehiculo && !ctx.vehiculo && extraerReferencias(ultimo || texto).length === 0) {
    return { tipo: "falta_contexto", ctx };
  }

  const productos = await resolverBusquedaMostrador(ultimo || texto, ctx.pieza);
  if (productos.length === 0) {
    return { tipo: "sin_match", ctx };
  }

  const producto = productos[0];
  const cantidad = extraerCantidadSolicitada(ultimo || texto);
  const linea = mapLinea(producto, tallerRow, cantidad);

  if (marcaNoVendida && linea.marcaProducto.toUpperCase() !== marcaNoVendida) {
    return { tipo: "marca_no_vendida", marca: marcaNoVendida };
  }

  return {
    tipo: "cotizacion",
    linea,
    aplicacion: producto.aplicacion,
    ctx,
    alcance,
    esPrecioTaller: linea.esPrecioTaller,
    nombreTaller: linea.nombreTaller,
  };
}

export function armarBorradorPedido(args: {
  linea: MostradorCotizacionLinea;
  ctx: ContextoCotizacion;
  alcance: BorradorPedidoWa["alcance"];
  cantidad: number;
  esPrecioTaller?: boolean;
  nombreTaller?: string;
}): BorradorPedidoWa {
  const vehiculoResumen = resumenVehiculo(args.ctx);
  const piezaResumen = resumenPieza(args.ctx);
  const borrador: BorradorPedidoWa = {
    slug: args.linea.slug,
    referencia: args.linea.referencia,
    nombre: args.linea.nombre,
    marcaProducto: args.linea.marcaProducto,
    cantidad: args.cantidad,
    precioUnitarioCop: args.linea.precioUnitarioCop,
    stock: args.linea.stock,
    disponibilidad: args.linea.disponibilidad,
    vehiculoResumen,
    piezaResumen,
    alcance: args.alcance,
    esPrecioTaller: args.esPrecioTaller ?? false,
    nombreTaller: args.nombreTaller,
    resumenEnviado: "",
    confirmToken: "",
  };
  borrador.confirmToken = buildConfirmToken(borrador);
  borrador.resumenEnviado = mensajeResumenPedido(borrador);
  return borrador;
}
