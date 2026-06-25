import { formatoCop, type DisponibilidadMostrador } from "../mostrador";
import type { BorradorPedidoWa, CarritoItemWa } from "./types";
import { lineaPresentacionAgente } from "./greeting";
import { WA_AGENT_BRAND } from "./types";
import { carritoTieneMixtoStock, totalCarritoCop } from "./carrito.server";

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
  return (
    `${estado}\n${plazo}\n` +
    `_La referencia está en catálogo; confirmamos con proveedor al registrar tu pedido._\n` +
    `${etiquetaPrecio}: *${formatoCop(args.linea.precioUnitarioCop)}* c/u`
  );
}

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

function bloqueLineaCotizacion(args: {
  indice: number;
  piezaResumen: string;
  vehiculoResumen: string;
  linea: {
    referencia: string;
    nombre: string;
    marcaProducto: string;
    precioUnitarioCop: number;
    stock: number;
    disponibilidad: DisponibilidadMostrador;
    cantidadSugerida?: number;
  };
  alcance: BorradorPedidoWa["alcance"];
  esPrecioTaller?: boolean;
  nombreTaller?: string;
}): string {
  const veh = args.vehiculoResumen ? ` · ${args.vehiculoResumen}` : "";
  const qty = args.linea.cantidadSugerida && args.linea.cantidadSugerida > 1
    ? ` (×${args.linea.cantidadSugerida})`
    : "";
  const bloque = bloqueDisponibilidadYPrecio({
    linea: args.linea,
    alcance: args.alcance,
    esPrecioTaller: args.esPrecioTaller,
    nombreTaller: args.nombreTaller,
  });
  return [
    `*${args.indice}.* ${args.piezaResumen}${veh}${qty}`,
    `*${args.linea.referencia}* (${args.linea.marcaProducto}) — ${args.linea.nombre}`,
    bloque,
  ].join("\n");
}

/** Varias piezas en un solo mensaje del cliente. */
export function mensajeCotizacionMultiple(args: {
  items: Array<{
    estado: "ok" | "sin_match" | "falta_contexto" | "necesita_aclaracion";
    piezaResumen: string;
    vehiculoResumen: string;
    cantidadSugerida: number;
    pregunta?: string;
    linea?: {
      referencia: string;
      nombre: string;
      marcaProducto: string;
      precioUnitarioCop: number;
      stock: number;
      disponibilidad: DisponibilidadMostrador;
      cantidadSugerida?: number;
    };
    alcance?: BorradorPedidoWa["alcance"];
  }>;
  incluirSaludo: boolean;
  esPrecioTaller?: boolean;
  nombreTaller?: string;
  brand?: string;
}): string {
  const brand = args.brand ?? WA_AGENT_BRAND;
  const saludo = args.incluirSaludo ? `${lineaPresentacionAgente(brand)}\n\n` : "";
  const bloques: string[] = [];

  args.items.forEach((item, i) => {
    const n = i + 1;
    if (item.estado === "ok" && item.linea && item.alcance) {
      bloques.push(
        bloqueLineaCotizacion({
          indice: n,
          piezaResumen: item.piezaResumen,
          vehiculoResumen: item.vehiculoResumen,
          linea: { ...item.linea, cantidadSugerida: item.cantidadSugerida },
          alcance: item.alcance,
          esPrecioTaller: args.esPrecioTaller,
          nombreTaller: args.nombreTaller,
        }),
      );
      return;
    }
    const veh = item.vehiculoResumen ? ` · ${item.vehiculoResumen}` : "";
    const pieza = item.piezaResumen || "repuesto";
    const qty =
      item.cantidadSugerida > 1 ? ` (×${item.cantidadSugerida})` : "";
    if (item.estado === "falta_contexto") {
      bloques.push(`*${n}.* ${pieza}${veh}\n_Falta marca/modelo del vehículo._`);
    } else if (item.estado === "necesita_aclaracion" && item.pregunta) {
      bloques.push(`*${n}.* ${pieza}${veh}${qty}\n_${item.pregunta}_`);
    } else {
      bloques.push(`*${n}.* ${pieza}${veh}\n_No encontré referencia exacta en catálogo con esos datos._`);
    }
  });

  return (
    `${saludo}Te cotizo *${args.items.length}* repuestos:\n\n` +
    bloques.join("\n\n") +
    "\n\nSi alguna línea necesita aclaración, respóndeme por ese ítem (ej. *delanteros*, *traseros*, *sí son los 4*).\n" +
    "Para pedir una referencia concreta, escríbela (ej. *KSL-1001*)."
  );
}

export function mensajePreguntaCotizacionLista(): string {
  return "¿Cuál referencia quieres pedir? Escríbela (ej. *KSL-1001*) y te paso el resumen para confirmar.";
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
  refPedido: string;
  referencia: string;
  cantidad: number;
  totalCop: number;
  urlPedido: string;
  /** Varios ítems: texto ya formateado (ej. "KSA-RE008 ×1, KSA-HY016 ×1"). */
  resumenLineas?: string;
}): string {
  const detalle = args.resumenLineas ?? `${args.referencia} ×${args.cantidad}`;
  return [
    "✅ *Pedido registrado en Apex*",
    `Número de pedido: *#${args.refPedido}*`,
    detalle,
    `Total: *${formatoCop(args.totalCop)}*`,
    "",
    "Seguimiento en la app:",
    args.urlPedido,
    "",
    "Ahí verás el mismo pedido *#" + args.refPedido + "* con su estado (revisión, bodega, en camino).",
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

export function mensajeDetallePosicionCotizada(args: {
  referencia: string;
  nombre: string;
}): string {
  const n = args.nombre.toUpperCase();
  const esDel = /\bDEL\b|\bDELANT/i.test(n);
  const esTras = /\bTRAS\b/i.test(n);
  if (esDel) {
    return `La referencia *${args.referencia}* que te cotizé es *delantera* (${args.nombre}).`;
  }
  if (esTras) {
    return `La referencia *${args.referencia}* que te cotizé es *trasera* (${args.nombre}).`;
  }
  return `La referencia *${args.referencia}*: ${args.nombre}.`;
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
    `No encontré una referencia exacta de ${pieza}${veh} con los datos que me diste.\n` +
    "Si tienes *referencia* o *foto*, la reviso. ¿Te puedo ayudar con otra pieza?"
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

function notaMixtoStock(items: CarritoItemWa[]): string {
  if (!carritoTieneMixtoStock(items)) return "";
  return (
    "\n_Nota:_ Tienes referencias *en bodega* y *bajo pedido*. " +
    "Podemos despachar lo de bodega según operación del día y coordinar el bajo pedido al registrar — " +
    "te confirmamos el plazo exacto en ese momento._"
  );
}

function lineaCarritoResumen(item: CarritoItemWa, indice: number): string {
  const veh = item.vehiculoResumen ? ` · ${item.vehiculoResumen}` : "";
  const subtotal = item.precioUnitarioCop * item.cantidad;
  const disp = textoDisponibilidad(item.disponibilidad, item.stock, item.alcance);
  return [
    `*${indice}.* *${item.referencia}* — ${item.nombre}${veh}`,
    `   Cantidad: ${item.cantidad} · Subtotal: *${formatoCop(subtotal)}* · ${disp}`,
  ].join("\n");
}

export function mensajeResumenCarrito(items: CarritoItemWa[]): string {
  const lineas = items.map((item, i) => lineaCarritoResumen(item, i + 1));
  const total = totalCarritoCop(items);
  return [
    ...lineas,
    "",
    `*Total general:* *${formatoCop(total)}*`,
    notaMixtoStock(items),
    "",
    "¿Así queda el pedido o necesitas cambiar algo?",
    "Si está bien, escribe *CONFIRMO*.",
  ].join("\n");
}

export function mensajeTransicionCarrito(items: CarritoItemWa[]): string {
  if (items.length === 1) {
    const i = items[0]!;
    return `Perfecto. Este sería tu pedido:\n\n${lineaCarritoResumen(i, 1).replace(/^\*1\.\* /, "")}\n\n¿Así queda? Escribe *CONFIRMO*.`;
  }
  return `Perfecto. Este sería tu pedido con *${items.length}* referencias:\n\n${mensajeResumenCarrito(items)}`;
}

export function mensajeLogisticaMixta(items: CarritoItemWa[]): string {
  const mixto = carritoTieneMixtoStock(items);
  if (!mixto) {
    return "Sí, podemos gestionar tu pedido. Te dejo el resumen actualizado:";
  }
  return (
    "Sí, podemos hacerlo así: *despachamos lo que está en bodega* según la operación del día " +
    "y el *bajo pedido* lo agendamos al registrar tu pedido (te confirmamos el plazo exacto en ese momento).\n\n" +
    "Tu cotización actual:"
  );
}

export function mensajeReferenciaYaEnCarrito(referencia: string): string {
  return `La ref. *${referencia}* ya está en tu cotización. Te dejo el resumen:`;
}
