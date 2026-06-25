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
  resolverCandidatosMostrador,
  segmentarConsultasPieza,
  vendemosMarca,
  type ContextoCotizacion,
  type ProductoMostrador,
} from "../mostrador-inventario.server";
import type { MostradorCotizacionLinea } from "../mostrador";
import { getTallerFidelizadoByWhatsapp } from "../talleres.server";
import type { AclaracionPendienteWa, BorradorPedidoWa } from "./types";
import { buildConfirmToken } from "./intents";
import { mensajeResumenPedido } from "./copy";
import {
  armarCotizacionJuegoAmortiguadores,
  refinarContextoDesdeRespuesta,
  resolverConAclaracion,
} from "./aclaracion.server";

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
      estado: "necesita_aclaracion";
      segmento: string;
      ctx: ContextoCotizacion;
      cantidadSugerida: number;
      pregunta: string;
      candidatosSlugs: string[];
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
      tipo: "necesita_aclaracion";
      pendiente: AclaracionPendienteWa;
    }
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

  const { candidatos } = await resolverCandidatosMostrador(segmento, ctx.pieza);

  if (candidatos.length === 0) {
    return { estado: "sin_match", segmento, ctx, cantidadSugerida };
  }

  const marcas = extraerMarcasMencionadas(segmento);
  const marcaNoVendida = marcas.find((m) => !vendemosMarca(m));
  if (marcaNoVendida && candidatos.every((p) => p.marcaProducto.toUpperCase() !== marcaNoVendida)) {
    return { estado: "sin_match", segmento, ctx, cantidadSugerida };
  }

  const decision = resolverConAclaracion(ctx, candidatos, cantidadSugerida);

  if (decision.tipo === "preguntar") {
    return {
      estado: "necesita_aclaracion",
      segmento,
      ctx: decision.ctx,
      cantidadSugerida: decision.cantidad,
      pregunta: decision.pregunta,
      candidatosSlugs: decision.candidatosSlugs,
    };
  }

  if (decision.tipo === "cotizar_kit") {
    const items: ItemCotizacionWa[] = [];
    for (let i = 0; i < decision.productos.length; i++) {
      const p = decision.productos[i];
      const qty = decision.cantidades[i] ?? 1;
      const linea = mapLinea(p, taller, qty);
      items.push({
        estado: "ok",
        segmento,
        ctx: decision.ctx,
        alcance,
        linea,
        aplicacion: p.aplicacion,
        cantidadSugerida: qty,
      });
    }
    return items[0] ?? { estado: "sin_match", segmento, ctx, cantidadSugerida };
  }

  if (decision.tipo === "sin_match") {
    return { estado: "sin_match", segmento, ctx, cantidadSugerida };
  }

  const producto = decision.producto;
  const linea = mapLinea(producto, taller, decision.cantidad);

  return {
    estado: "ok",
    segmento,
    ctx,
    alcance,
    linea,
    aplicacion: producto.aplicacion,
    cantidadSugerida: decision.cantidad,
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

/** Resuelve una aclaración pendiente con la respuesta del cliente. */
export async function cotizarTrasAclaracion(args: {
  pendiente: AclaracionPendienteWa;
  respuesta: string;
  taller: Awaited<ReturnType<typeof getTallerFidelizadoByWhatsapp>>;
}): Promise<ResultadoCotizacionWa> {
  const refinado = refinarContextoDesdeRespuesta(
    args.respuesta,
    args.pendiente.ctx,
    args.pendiente.cantidadSugerida,
  );

  const { candidatos } = await resolverCandidatosMostrador(args.pendiente.segmento, refinado.ctx.pieza);
  const pool = candidatos.filter((p) => args.pendiente.candidatosSlugs.includes(p.slug));

  if (refinado.juegoCompleto4) {
    const kit = armarCotizacionJuegoAmortiguadores(refinado.ctx, pool.length ? pool : candidatos);
    if (kit) {
      const items: ItemCotizacionWa[] = kit.productos.map((p, i) => ({
        estado: "ok" as const,
        segmento: args.pendiente.segmento,
        ctx: refinado.ctx,
        alcance: detectarAlcanceMensaje(args.pendiente.segmento),
        linea: mapLinea(p, args.taller, kit.cantidades[i] ?? 1),
        aplicacion: p.aplicacion,
        cantidadSugerida: kit.cantidades[i] ?? 1,
      }));
      return {
        tipo: "cotizacion_multiple",
        items,
        esPrecioTaller: items.some((i) => i.estado === "ok" && i.linea.esPrecioTaller),
        nombreTaller: items.find((i) => i.estado === "ok")?.linea.nombreTaller,
      };
    }
  }

  const decision = resolverConAclaracion(refinado.ctx, pool.length ? pool : candidatos, refinado.cantidad);

  if (decision.tipo === "preguntar") {
    return {
      tipo: "necesita_aclaracion",
      pendiente: {
        segmento: args.pendiente.segmento,
        ctx: decision.ctx,
        candidatosSlugs: decision.candidatosSlugs,
        cantidadSugerida: decision.cantidad,
        pregunta: decision.pregunta,
      },
    };
  }

  if (decision.tipo !== "ok") {
    return { tipo: "sin_match", ctx: refinado.ctx };
  }

  const linea = mapLinea(decision.producto, args.taller, decision.cantidad);
  return {
    tipo: "cotizacion",
    linea,
    aplicacion: decision.producto.aplicacion,
    ctx: refinado.ctx,
    alcance: detectarAlcanceMensaje(args.pendiente.segmento),
    esPrecioTaller: linea.esPrecioTaller,
    nombreTaller: linea.nombreTaller,
  };
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
    const conAclaracion = items.filter((i) => i.estado === "necesita_aclaracion");
    if (conMatch.length === 0 && conAclaracion.length === 0) {
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
    const { candidatos } = await resolverCandidatosMostrador(ultimo || texto);
    if (candidatos.length === 0) return { tipo: "fuera_alcance" };
  }

  const marcas = extraerMarcasMencionadas(ultimo || texto);
  const marcaNoVendida = marcas.find((m) => !vendemosMarca(m));

  if (ctx.pieza && !ctx.marcaVehiculo && !ctx.vehiculo && extraerReferencias(ultimo || texto).length === 0) {
    return { tipo: "falta_contexto", ctx };
  }

  const cantidad = extraerCantidadSolicitada(ultimo || texto);
  const { candidatos } = await resolverCandidatosMostrador(ultimo || texto, ctx.pieza);

  if (candidatos.length === 0) {
    return { tipo: "sin_match", ctx };
  }

  if (marcaNoVendida && candidatos.every((p) => p.marcaProducto.toUpperCase() !== marcaNoVendida)) {
    return { tipo: "marca_no_vendida", marca: marcaNoVendida };
  }

  const decision = resolverConAclaracion(ctx, candidatos, cantidad);

  if (decision.tipo === "preguntar") {
    return {
      tipo: "necesita_aclaracion",
      pendiente: {
        segmento: ultimo || texto,
        ctx: decision.ctx,
        candidatosSlugs: decision.candidatosSlugs,
        cantidadSugerida: decision.cantidad,
        pregunta: decision.pregunta,
      },
    };
  }

  if (decision.tipo !== "ok") {
    return { tipo: "sin_match", ctx };
  }

  const linea = mapLinea(decision.producto, tallerRow, decision.cantidad);

  return {
    tipo: "cotizacion",
    linea,
    aplicacion: decision.producto.aplicacion,
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
