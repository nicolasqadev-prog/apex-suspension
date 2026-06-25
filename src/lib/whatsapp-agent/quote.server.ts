import { calcularPrecioTaller } from "../precio-taller.server";
import {
  acumularTextoUsuario,
  detectarAlcanceMensaje,
  extraerContextoDesdeHistorial,
  extraerMarcasMencionadas,
  extraerReferencias,
  resolverBusquedaMostrador,
  vendemosMarca,
  type ContextoCotizacion,
  type ProductoMostrador,
} from "../mostrador-inventario.server";
import type { MostradorCotizacionLinea } from "../mostrador";
import { getTallerFidelizadoByWhatsapp } from "../talleres.server";
import type { BorradorPedidoWa } from "./types";
import { buildConfirmToken } from "./intents";
import { mensajeResumenPedido } from "./copy";

function mapLinea(
  p: ProductoMostrador,
  taller: Awaited<ReturnType<typeof getTallerFidelizadoByWhatsapp>>,
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
    cantidadSugerida: 1,
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
    };

/** Cotización determinística: una sola línea del catálogo (sin Groq). */
export async function cotizarDesdeCatalogoWhatsApp(args: {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  whatsapp?: string;
}): Promise<ResultadoCotizacionWa> {
  const texto = acumularTextoUsuario(args.history);
  const ctx = extraerContextoDesdeHistorial(args.history);
  const alcance = detectarAlcanceMensaje(texto);

  if (alcance === "fuera_alcance") {
    const probe = await resolverBusquedaMostrador(texto);
    if (probe.length === 0) return { tipo: "fuera_alcance" };
  }

  const marcas = extraerMarcasMencionadas(texto);
  const marcaNoVendida = marcas.find((m) => !vendemosMarca(m));

  if (ctx.pieza && !ctx.marcaVehiculo && !ctx.vehiculo && extraerReferencias(texto).length === 0) {
    return { tipo: "falta_contexto", ctx };
  }

  const productos = await resolverBusquedaMostrador(texto, ctx.pieza);
  if (productos.length === 0) {
    return { tipo: "sin_match", ctx };
  }

  const producto = productos[0];
  const w = args.whatsapp?.trim();
  const tallerRow = w ? await getTallerFidelizadoByWhatsapp(w) : null;
  const linea = mapLinea(producto, tallerRow);

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
