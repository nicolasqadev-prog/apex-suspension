import { formatoCop, type DisponibilidadMostrador } from "../mostrador";
import type { BorradorPedidoWa } from "./types";
import { lineaPresentacionAgente } from "./greeting";
import { WA_AGENT_BRAND } from "./types";

export function textoDisponibilidadCorta(
  disponibilidad: DisponibilidadMostrador,
  stock: number,
  alcance: BorradorPedidoWa["alcance"],
): string {
  if (disponibilidad === "bodega" && stock > 0) return `*EN BODEGA* (${stock} und.)`;
  if (alcance === "bajo_encargo") return "*BAJO ENCARGO*";
  return "*BAJO PEDIDO*";
}

export function textoPlazoEntrega(
  disponibilidad: DisponibilidadMostrador,
  stock: number,
  alcance: BorradorPedidoWa["alcance"],
): string {
  if (disponibilidad === "bodega" && stock > 0) {
    return "Despacho según operación del día (pieza en bodega).";
  }
  return (
    "Llegada estimada: *6 a 8 horas* (piezas de rotación habitual) o hasta *24 horas hábiles* " +
    "si es de mayor complejidad. Te confirmamos el plazo exacto al registrar el pedido."
  );
}

export function textoDisponibilidad(
  disponibilidad: DisponibilidadMostrador,
  stock: number,
  alcance: BorradorPedidoWa["alcance"],
): string {
  if (disponibilidad === "bodega" && stock > 0) return `*EN BODEGA* (${stock} und.)`;
  if (alcance === "bajo_encargo") return "*BAJO ENCARGO*";
  return "*BAJO PEDIDO*";
}

function bloqueDisponibilidadYPrecio(args: {
  linea: { precioUnitarioCop: number; stock: number; disponibilidad: DisponibilidadMostrador };
  alcance: BorradorPedidoWa["alcance"];
  esPrecioTaller?: boolean;
  nombreTaller?: string;
}): string {
  const estado = textoDisponibilidadCorta(
    args.linea.disponibilidad,
    args.linea.stock,
    args.alcance,
  );
  const plazo = textoPlazoEntrega(args.linea.disponibilidad, args.linea.stock, args.alcance);
  const enBodega = args.linea.disponibilidad === "bodega" && args.linea.stock > 0;
  const etiquetaPrecio = args.esPrecioTaller
    ? `Precio taller${args.nombreTaller ? ` (${args.nombreTaller})` : ""}`
    : "Precio público";

  if (enBodega) {
    return `${estado}\n${plazo}\n${etiquetaPrecio}: *${formatoCop(args.linea.precioUnitarioCop)}* c/u`;
  }
  return `${estado}\n${plazo}\n${etiquetaPrecio}: *${formatoCop(args.linea.precioUnitarioCop)}* c/u`;
}

/** Primera respuesta: cotización corta y pregunta si le sirve (sin resumen de pedido). */
export function mensajeCotizacionBreve(args: {
  linea: {
    referencia: string;
    nombre: string;
    marcaProducto: string;
    precioUnitarioCop: number;
    stock: number;
    disponibilidad: DisponibilidadMostrador;
  };
  aplicacion: string;
  vehiculoResumen: string;
  piezaResumen: string;
  alcance: BorradorPedidoWa["alcance"];
  incluirSaludo: boolean;
  esPrecioTaller?: boolean;
  nombreTaller?: string;
  brand?: string;
}): string {
  const brand = args.brand ?? WA_AGENT_BRAND;
  const saludo = args.incluirSaludo ? `${lineaPresentacionAgente(brand)}\n\n` : "";
  const aplicacion = args.aplicacion.trim();
  const aplica =
    aplicacion && aplicacion !== args.linea.nombre
      ? `\n_${aplicacion.slice(0, 120)}_`
      : "";
  const bloque = bloqueDisponibilidadYPrecio({
    linea: args.linea,
    alcance: args.alcance,
    esPrecioTaller: args.esPrecioTaller,
    nombreTaller: args.nombreTaller,
  });

  return (
    `${saludo}Sí, manejamos esta referencia en catálogo:\n` +
    `*${args.linea.referencia}* (${args.linea.marcaProducto})${aplica}\n` +
    `${bloque}\n\n` +
    `¿Te sirve?`
  );
}

export function mensajeTransicionResumen(borrador: BorradorPedidoWa): string {
  return `Perfecto. Este sería tu pedido:\n\n${mensajeResumenPedido(borrador)}`;
}

export function mensajePlazoEntrega(borrador: BorradorPedidoWa): string {
  const plazo = textoPlazoEntrega(borrador.disponibilidad, borrador.stock, borrador.alcance);
  const estado = textoDisponibilidad(borrador.disponibilidad, borrador.stock, borrador.alcance);
  return (
    `Para la ref. *${borrador.referencia}* (${estado}):\n${plazo}\n\n` +
    `¿La quieres pedir? Responde *sí* y te paso el resumen.`
  );
}

export function mensajePlazoYAceptacion(borrador: BorradorPedidoWa): string {
  const plazo = textoPlazoEntrega(borrador.disponibilidad, borrador.stock, borrador.alcance);
  const estado = textoDisponibilidad(borrador.disponibilidad, borrador.stock, borrador.alcance);
  return (
    `¡Perfecto! Para la ref. *${borrador.referencia}* (${estado}):\n${plazo}\n\n` +
    mensajeTransicionResumen(borrador)
  );
}

export function mensajeResumenPedido(borrador: BorradorPedidoWa): string {
  const total = borrador.precioUnitarioCop * borrador.cantidad;
  const disp = textoDisponibilidad(borrador.disponibilidad, borrador.stock, borrador.alcance);
  const veh = borrador.vehiculoResumen ? ` · ${borrador.vehiculoResumen}` : "";

  return [
    `*${borrador.referencia}* — ${borrador.nombre}${veh}`,
    `Cantidad: ${borrador.cantidad} · Total: *${formatoCop(total)}* · ${disp}`,
    "",
    "¿Así queda el pedido o necesitas cambiar algo?",
    "Si está bien, escribe *CONFIRMO*.",
    "_Cantidad distinta: escribe el número (ej. 2) antes de confirmar._",
  ].join("\n");
}

export function mensajePedidoRegistrado(args: {
  referencia: string;
  cantidad: number;
  totalCop: number;
  urlPedido: string;
}): string {
  return [
    "✅ *Pedido registrado en Apex*",
    `${args.referencia} ×${args.cantidad} — ${formatoCop(args.totalCop)}`,
    "",
    "Seguimiento:",
    args.urlPedido,
    "",
    "Gracias por tu compra. Confirmamos despacho por este chat.",
    "",
    "¿Necesitas agregar algo más al pedido?",
  ].join("\n");
}

export function mensajeRechazoCotizacion(): string {
  return "Entendido. Si buscas otra referencia o pieza, cuéntame vehículo y año.";
}

export function mensajePreguntaCotizacionPendiente(): string {
  return "¿Te sirve la referencia que te cotizé? Responde *sí* si quieres pedirla, o dime qué buscas.";
}

export function mensajeDespedida(): string {
  return "Con gusto. Cualquier cosa, escríbenos. ¡Que tengas buen día!";
}

export function mensajeCancelacion(): string {
  return "Listo, cancelé el pedido en curso. Si necesitas otra pieza, dime referencia, vehículo y año.";
}

export function mensajeModificar(): string {
  return "Sin problema. ¿Qué quieres cambiar — cantidad, referencia u otra pieza?";
}

export function mensajeSinMatch(pieza: string, vehiculo: string): string {
  const veh = vehiculo ? ` para *${vehiculo}*` : "";
  return (
    `Por ahora *no tenemos* ${pieza}${veh} en catálogo.\n` +
    "Si tienes referencia o foto, la reviso con gusto. ¿Te puedo ayudar con otra pieza?"
  );
}

export function mensajeFaltaVehiculo(pieza?: string): string {
  const p = pieza ? `*${pieza}*` : "esa pieza";
  return `Para cotizar ${p} necesito saber *marca y modelo* del vehículo (año si lo tienes).`;
}

export function mensajeFueraAlcance(): string {
  return (
    "Esa línea (motor, transmisión, llantas, radio, aire acondicionado) no la manejamos en Apex — " +
    "nos enfocamos en suspensión y dirección. Si buscas rótulas, bieletas o amortiguadores, con gusto te cotizo."
  );
}

export function mensajeBienvenidaConsulta(brand?: string): string {
  const b = brand ?? WA_AGENT_BRAND;
  return `${lineaPresentacionAgente(b)}\n\n¿Qué repuesto necesitas?`;
}

export function mensajeRecordatorioConfirmo(): string {
  return "Para registrarlo en sistema escribe *CONFIRMO*. Si quieres cambiar cantidad o pieza, dímelo.";
}
