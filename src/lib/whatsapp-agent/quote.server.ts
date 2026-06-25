import { calcularPrecioTaller } from "../precio-taller.server";
import {
  acumularTextoUsuario,
  buscarPorReferenciaExacta,
  detectarAlcanceMensaje,
  esConsultaMultiplePiezas,
  extraerCantidadSolicitada,
  extraerContextoCotizacion,
  extraerContextoDesdeHistorial,
  extraerMarcasMencionadas,
  extraerReferencias,
  normalizarCtxVehiculo,
  resolverCandidatosMostrador,
  segmentarConsultasPieza,
  vendemosMarca,
  type ContextoCotizacion,
  type ProductoMostrador,
} from "../mostrador-inventario.server";
import type { MostradorCotizacionLinea } from "../mostrador";
import { getTallerFidelizadoByWhatsapp } from "../talleres.server";
import type { AclaracionPendienteWa, BorradorPedidoWa } from "./types";
import { buildConfirmToken, esMensajeSinDatosCotizacion } from "./intents";
import { mensajeResumenPedido } from "./copy";
import {
  armarCotizacionJuegoAmortiguadores,
  refinarContextoDesdeRespuesta,
  resolverConAclaracion,
} from "./aclaracion.server";
import {
  groqInterpretacionHabilitada,
  interpretarMensajeWhatsAppConGroq,
  itemGroqASegmento,
} from "./groq-interpret.server";

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

async function cotizarProductoDirecto(
  producto: ProductoMostrador,
  segmento: string,
  ctx: ContextoCotizacion,
  taller: Awaited<ReturnType<typeof getTallerFidelizadoByWhatsapp>>,
  cantidadSugerida = 1,
): Promise<ItemCotizacionWa> {
  const linea = mapLinea(producto, taller, cantidadSugerida);
  return {
    estado: "ok",
    segmento,
    ctx,
    alcance: detectarAlcanceMensaje(segmento),
    linea,
    aplicacion: producto.aplicacion,
    cantidadSugerida,
  };
}

/** Cotiza por referencia(s) KSA-XXXX sin depender de marca/modelo en el mensaje. */
async function cotizarPorReferencias(
  refs: string[],
  mensaje: string,
  taller: Awaited<ReturnType<typeof getTallerFidelizadoByWhatsapp>>,
): Promise<ItemCotizacionWa[]> {
  const items: ItemCotizacionWa[] = [];
  const ctx = extraerContextoCotizacion(mensaje);
  const cantidad = extraerCantidadSolicitada(mensaje);

  for (const ref of refs) {
    const p = await buscarPorReferenciaExacta(ref);
    if (!p) {
      items.push({ estado: "sin_match", segmento: ref, ctx, cantidadSugerida: cantidad });
      continue;
    }
    items.push(await cotizarProductoDirecto(p, mensaje, ctx, taller, cantidad));
  }
  return items;
}

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

function empaquetarResultadoItems(
  items: ItemCotizacionWa[],
  ultimo: string,
  tallerRow: Awaited<ReturnType<typeof getTallerFidelizadoByWhatsapp>>,
): ResultadoCotizacionWa {
  const esPrecioTaller = Boolean(tallerRow);
  const nombreTaller = tallerRow?.nombreTaller;
  const conMatch = items.filter((i) => i.estado === "ok");
  const conAclaracion = items.filter((i) => i.estado === "necesita_aclaracion");

  if (conMatch.length === 0 && conAclaracion.length === 0) {
    const primero = items[0];
    if (primero?.estado === "falta_contexto") {
      return { tipo: "falta_contexto", ctx: primero.ctx };
    }
    return { tipo: "sin_match", ctx: primero?.ctx ?? extraerContextoCotizacion(ultimo) };
  }

  if (conAclaracion.length === 1 && conMatch.length === 0) {
    const a = conAclaracion[0]!;
    return {
      tipo: "necesita_aclaracion",
      pendiente: {
        segmento: a.segmento,
        ctx: a.ctx,
        candidatosSlugs: a.candidatosSlugs,
        cantidadSugerida: a.cantidadSugerida,
        pregunta: a.pregunta,
      },
    };
  }

  return { tipo: "cotizacion_multiple", items, esPrecioTaller, nombreTaller };
}

/** Groq interpreta el mensaje → segmentos → catálogo (sin inventar precios). */
async function intentarCotizarConGroqInterpretacion(args: {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  whatsapp?: string;
}): Promise<ResultadoCotizacionWa | null> {
  if (!groqInterpretacionHabilitada()) return null;

  const interp = await interpretarMensajeWhatsAppConGroq(args);
  if (!interp || interp.intencion !== "cotizar" || interp.items.length === 0) return null;

  const ultimo = ultimoMensajeUsuario(args.history);
  const w = args.whatsapp?.trim();
  const tallerRow = w ? await getTallerFidelizadoByWhatsapp(w) : null;
  const segmentos = interp.items.map((item) => itemGroqASegmento(item)).filter(Boolean);

  if (segmentos.length === 0) return null;

  if (segmentos.length === 1) {
    const item = await cotizarSegmento(segmentos[0]!, tallerRow);
    if (item.estado === "ok") {
      return {
        tipo: "cotizacion",
        linea: item.linea,
        aplicacion: item.aplicacion,
        ctx: item.ctx,
        alcance: item.alcance,
        esPrecioTaller: item.linea.esPrecioTaller,
        nombreTaller: item.linea.nombreTaller,
      };
    }
    if (item.estado === "necesita_aclaracion") {
      return {
        tipo: "necesita_aclaracion",
        pendiente: {
          segmento: item.segmento,
          ctx: item.ctx,
          candidatosSlugs: item.candidatosSlugs,
          cantidadSugerida: item.cantidadSugerida,
          pregunta: item.pregunta,
        },
      };
    }
    if (item.estado === "falta_contexto") {
      return { tipo: "falta_contexto", ctx: item.ctx };
    }
    return { tipo: "sin_match", ctx: item.ctx };
  }

  const items = await cotizarMultiples(segmentos, tallerRow);
  return empaquetarResultadoItems(items, ultimo, tallerRow);
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
  const ctxRefinado: ContextoCotizacion = {
    ...args.pendiente.ctx,
    ...refinado.ctx,
    pieza: args.pendiente.ctx.pieza ?? refinado.ctx.pieza,
    vehiculo: args.pendiente.ctx.vehiculo ?? refinado.ctx.vehiculo,
    marcaVehiculo: args.pendiente.ctx.marcaVehiculo ?? refinado.ctx.marcaVehiculo,
    textoCompleto: args.pendiente.segmento,
  };

  const { candidatos } = await resolverCandidatosMostrador(
    args.pendiente.segmento,
    ctxRefinado.pieza,
  );
  const pool = candidatos.filter((p) => args.pendiente.candidatosSlugs.includes(p.slug));

  if (refinado.juegoCompleto4) {
    const kit = armarCotizacionJuegoAmortiguadores(
      ctxRefinado,
      pool.length ? pool : candidatos,
    );
    if (kit) {
      const items: ItemCotizacionWa[] = kit.productos.map((p, i) => ({
        estado: "ok" as const,
        segmento: args.pendiente.segmento,
        ctx: ctxRefinado,
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

  const elegibles = pool.length ? pool : candidatos;
  const decision = resolverConAclaracion(ctxRefinado, elegibles, refinado.cantidad);

  if (decision.tipo === "preguntar") {
    return {
      tipo: "necesita_aclaracion",
      pendiente: {
        segmento: args.pendiente.segmento,
        ctx: { ...ctxRefinado, ...decision.ctx },
        candidatosSlugs: decision.candidatosSlugs,
        cantidadSugerida: decision.cantidad,
        pregunta: decision.pregunta,
      },
    };
  }

  if (decision.tipo !== "ok") {
    return { tipo: "sin_match", ctx: ctxRefinado };
  }

  const linea = mapLinea(decision.producto, args.taller, decision.cantidad);
  return {
    tipo: "cotizacion",
    linea,
    aplicacion: decision.producto.aplicacion,
    ctx: ctxRefinado,
    alcance: detectarAlcanceMensaje(args.pendiente.segmento),
    esPrecioTaller: linea.esPrecioTaller,
    nombreTaller: linea.nombreTaller,
  };
}

const RESPUESTA_ACLARACION_CORTA_RX =
  /^\s*(delantero?s?|trasero?s?|izquierd[ao]?|derech[ao]?|s[ií]|si|sip|sep|dale|ok)\s*[!.?]*$/i;

/** Cliente respondió solo "delanteros", "traseros", etc. con contexto en el historial. */
export async function intentarCotizarRespuestaCorta(args: {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  whatsapp?: string;
}): Promise<ResultadoCotizacionWa | null> {
  const ultimo = ultimoMensajeUsuario(args.history);
  if (!RESPUESTA_ACLARACION_CORTA_RX.test(ultimo)) return null;

  const textoHist = acumularTextoUsuario(args.history);
  const ctxBase = extraerContextoDesdeHistorial(args.history);
  if (!ctxBase.pieza || (!ctxBase.vehiculo && !ctxBase.marcaVehiculo)) return null;

  const cantidad = extraerCantidadSolicitada(textoHist) || 1;
  const refinado = refinarContextoDesdeRespuesta(ultimo, ctxBase, cantidad);
  const ctx: ContextoCotizacion = {
    ...ctxBase,
    ...refinado.ctx,
    textoCompleto: textoHist,
  };

  const w = args.whatsapp?.trim();
  const tallerRow = w ? await getTallerFidelizadoByWhatsapp(w) : null;
  const { candidatos } = await resolverCandidatosMostrador(textoHist, ctx.pieza);
  if (!candidatos.length) return null;

  const decision = resolverConAclaracion(ctx, candidatos, refinado.cantidad);
  if (decision.tipo === "preguntar") {
    return {
      tipo: "necesita_aclaracion",
      pendiente: {
        segmento: textoHist,
        ctx: { ...ctx, ...decision.ctx },
        candidatosSlugs: decision.candidatosSlugs,
        cantidadSugerida: decision.cantidad,
        pregunta: decision.pregunta,
      },
    };
  }
  if (decision.tipo !== "ok") return null;

  const linea = mapLinea(decision.producto, tallerRow, decision.cantidad);
  return {
    tipo: "cotizacion",
    linea,
    aplicacion: decision.producto.aplicacion,
    ctx,
    alcance: detectarAlcanceMensaje(textoHist),
    esPrecioTaller: linea.esPrecioTaller,
    nombreTaller: linea.nombreTaller,
  };
}

/** Juego 4 amortiguadores (2 del + 2 tras) tras aclaración o en cotizado. */
export async function intentarCotizarJuegoAmortiguadores(args: {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  whatsapp?: string;
}): Promise<ResultadoCotizacionWa | null> {
  const ultimo = ultimoMensajeUsuario(args.history);
  const textoHist = acumularTextoUsuario(args.history);
  const ctxBase = extraerContextoDesdeHistorial(args.history);
  if (!ctxBase.pieza && /\bamortiguador/i.test(textoHist)) ctxBase.pieza = "amortiguador";
  if (!ctxBase.pieza?.includes("amortiguador")) return null;
  if (!ctxBase.vehiculo && !ctxBase.marcaVehiculo) return null;

  const cantidad = Math.max(
    extraerCantidadSolicitada(textoHist),
    extraerCantidadSolicitada(ultimo),
    1,
  );
  const refinado = refinarContextoDesdeRespuesta(ultimo, ctxBase, cantidad);
  if (!refinado.juegoCompleto4) return null;

  const w = args.whatsapp?.trim();
  const tallerRow = w ? await getTallerFidelizadoByWhatsapp(w) : null;
  const { candidatos } = await resolverCandidatosMostrador(textoHist, ctxBase.pieza);
  if (!candidatos.length) return null;

  const kit = armarCotizacionJuegoAmortiguadores(ctxBase, candidatos);
  if (!kit) return null;

  const items: ItemCotizacionWa[] = kit.productos.map((p, i) => ({
    estado: "ok",
    segmento: textoHist,
    ctx: ctxBase,
    alcance: detectarAlcanceMensaje(textoHist),
    linea: mapLinea(p, tallerRow, kit.cantidades[i] ?? 1),
    aplicacion: p.aplicacion,
    cantidadSugerida: kit.cantidades[i] ?? 1,
  }));

  return {
    tipo: "cotizacion_multiple",
    items,
    esPrecioTaller: items.some((i) => i.linea.esPrecioTaller),
    nombreTaller: items.find((i) => i.linea.nombreTaller)?.linea.nombreTaller,
  };
}

/** Cotización desde catálogo; Groq solo como respaldo si el motor determinístico no resuelve. */
export async function cotizarDesdeCatalogoWhatsApp(args: {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  whatsapp?: string;
}): Promise<ResultadoCotizacionWa> {
  const respuestaCorta = await intentarCotizarRespuestaCorta(args);
  if (respuestaCorta) return respuestaCorta;

  const juegoAmort = await intentarCotizarJuegoAmortiguadores(args);
  if (juegoAmort) return juegoAmort;

  const ultimo = ultimoMensajeUsuario(args.history);
  const w = args.whatsapp?.trim();
  const tallerRow = w ? await getTallerFidelizadoByWhatsapp(w) : null;
  const esPrecioTaller = Boolean(tallerRow);
  const nombreTaller = tallerRow?.nombreTaller;

  if (esMensajeSinDatosCotizacion(ultimo)) {
    return { tipo: "falta_contexto", ctx: extraerContextoCotizacion(ultimo) };
  }

  const refsUltimo = extraerReferencias(ultimo);
  if (refsUltimo.length > 0) {
    const itemsRef = await cotizarPorReferencias(refsUltimo, ultimo, tallerRow);
    const ok = itemsRef.filter((i) => i.estado === "ok");
    if (ok.length === 1) {
      const item = ok[0]!;
      return {
        tipo: "cotizacion",
        linea: item.linea,
        aplicacion: item.aplicacion,
        ctx: item.ctx,
        alcance: item.alcance,
        esPrecioTaller: item.linea.esPrecioTaller,
        nombreTaller: item.linea.nombreTaller,
      };
    }
    if (ok.length > 1) {
      return { tipo: "cotizacion_multiple", items: ok, esPrecioTaller, nombreTaller };
    }
  }

  if (esConsultaMultiplePiezas(ultimo)) {
    const segmentos = segmentarConsultasPieza(ultimo);
    const items = await cotizarMultiples(segmentos, tallerRow);
    return empaquetarResultadoItems(items, ultimo, tallerRow);
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
    const groqCot = await intentarCotizarConGroqInterpretacion(args);
    if (groqCot && groqCot.tipo !== "sin_match") return groqCot;
    return { tipo: "sin_match", ctx: normalizarCtxVehiculo(ctx) };
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
    const groqCot = await intentarCotizarConGroqInterpretacion(args);
    if (groqCot && groqCot.tipo !== "sin_match") return groqCot;
    return { tipo: "sin_match", ctx: normalizarCtxVehiculo(ctx) };
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
