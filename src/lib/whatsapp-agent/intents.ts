import type { WaAgentPhase } from "./types";

export type WaUserIntent =
  | "confirmar_pedido"
  | "aceptar_cotizacion"
  | "rechazar"
  | "validar_compatibilidad"
  | "consulta_plazo"
  | "modificar_pedido"
  | "cancelar"
  | "agradecimiento"
  | "consulta"
  | "cantidad";

const PLAZO_RX =
  /\b(cu[aá]nto\s+(se\s+)?demora|cu[aá]nto\s+tarda|tiempo\s+de\s+llegada|cu[aá]ndo\s+llega|en\s+cu[aá]nto\s+llega|plazo\s+de\s+entrega|tarda\s+en\s+llegar)\b/i;
const ACEPTAR_CON_SIRVE_RX = /\b(s[ií]|si)\s*,?\s*(me\s+)?sirve\b/i;
const TOTAL_CARRITO_RX =
  /\b(cu[aá]nto\s+(ser[ií]a|es|sale|queda)\s+(todo|el total|en total)|total\s+(del\s+)?pedido|(?:las?|los)\s+dos|ambas?\b|ambos\b|todo\s+junto|en\s+conjunto|suma(?:r)?|ponderado)\b/i;
const LOGISTICA_MIXTA_RX =
  /\b(?:uno|una).*(?:stock|bodega).*(?:otro|otra).*(?:bajo\s+pedido|pedido)|(?:bodega|en\s+stock).*(?:bajo\s+pedido)|(?:vender|entregar|despach).*(?:ya|ahora).*(?:agendar|bajo\s+pedido|pedido)|(?:agendar|programar).*(?:bajo\s+pedido)|podr[ií]as?\s+vender.*y\s+agendar/i;
const NUEVA_PIEZA_RX =
  /\b(bieletas?|barra\s+estabilizadora|r[oó]tulas?|terminales?|amortiguador(?:es)?|bujes?|brazos?|tijeras?|links?)\b/i;

const VALIDAR_RX = /\b(es para|esa es|sirve para|es del|es de el|compatible con|me sirve para)\b/i;

const CONFIRMO_STRICT_RX = /^\s*confirmo\s*$/i;
const CANCELAR_RX = /\b(cancelar|cancela|no quiero|dejalo|olvida|anula)\b/i;
const MODIFICAR_RX = /\b(modificar|cambiar|otra referencia|otra pieza|cambia|corrige)\b/i;
const GRACIAS_RX = /\b(gracias|muchas gracias|ok gracias|perfecto gracias|listo gracias)\b/i;
const RECHAZAR_RX = /\b(no gracias|no es|no esa|busco otra|otra pieza|otra ref|nel|nop)\b/i;
const ACEPTAR_STRICT_RX =
  /^\s*(s[ií]|si|sip|sep|dale|ok|okay|listo|perfecto|esa|esa misma|la quiero|quiero|me sirve|de una|va|vamos)\s*[!.?]*\s*$/i;
const ACEPTAR_LOOSE_RX =
  /\b(s[ií]\s*,?\s*(me\s+)?sirve|s[ií]\s+(la quiero|quiero|por favor)|dale|la quiero|me sirve|agregala|agrégal[ao]|esa misma)\b/i;
const COTIZACION_ADICIONAL_RX =
  /\b(?:cotiz(?:ar|a|ame|as|es)?|siguientes?\s+repuestos?|estos?\s+repuestos?|tambi[eé]n\s+necesito)\b/i;

/** CONFIRMO solo como palabra única (evita falsos positivos con "sí"). */
export function esConfirmoEstricto(texto: string): boolean {
  return CONFIRMO_STRICT_RX.test(texto.trim());
}

export function clasificarIntencion(texto: string, phase: WaAgentPhase): WaUserIntent {
  const t = texto.trim();
  if (!t) return "consulta";
  if (esConfirmoEstricto(t)) return "confirmar_pedido";
  if (CANCELAR_RX.test(t)) return "cancelar";
  if (MODIFICAR_RX.test(t)) return "modificar_pedido";

  if (phase === "esperando_aclaracion") {
    return "consulta";
  }

  const qty = extraerCantidad(t);
  if ((phase === "cotizado" || phase === "esperando_confirmacion") && qty != null && t.length < 20) {
    return "cantidad";
  }

  if ((phase === "cotizado" || phase === "esperando_confirmacion") && PLAZO_RX.test(t)) {
    return "consulta_plazo";
  }

  if (phase === "cotizado" || phase === "esperando_confirmacion") {
    if (ACEPTAR_CON_SIRVE_RX.test(t) && !NUEVA_PIEZA_RX.test(t)) {
      return PLAZO_RX.test(t) ? "consulta_plazo" : "aceptar_cotizacion";
    }
  }

  if (phase === "cotizado") {
    if (VALIDAR_RX.test(t)) return "validar_compatibilidad";
    if (RECHAZAR_RX.test(t)) return "rechazar";
    if (!esSolicitudCotizacionAdicional(t)) {
      const pareceListaCotizacion = NUEVA_PIEZA_RX.test(t) && t.length > 35;
      if (
        !pareceListaCotizacion &&
        (ACEPTAR_STRICT_RX.test(t) || (t.length < 80 && ACEPTAR_LOOSE_RX.test(t)))
      ) {
        return "aceptar_cotizacion";
      }
    }
  }

  if (GRACIAS_RX.test(t) && t.length < 80 && phase === "idle") return "agradecimiento";

  return "consulta";
}

/** Cantidad 1–99 si el mensaje es corto y numérico. */
export function extraerCantidad(texto: string): number | null {
  const t = texto.trim();
  const m = t.match(/^(\d{1,2})\s*(unidad(?:es)?|u)?\.?$/i);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 99) return n;
  }
  const inline = t.match(/\b(\d{1,2})\s*(unidad(?:es)?)\b/i);
  if (inline) {
    const n = Number(inline[1]);
    if (n >= 1 && n <= 99) return n;
  }
  const quiero = t.match(/\b(?:quiero|necesito)\s+(\d{1,2})\b/i);
  if (quiero) {
    const n = Number(quiero[1]);
    if (n >= 1 && n <= 99) return n;
  }
  return null;
}

export function esNuevaConsultaPieza(texto: string): boolean {
  return NUEVA_PIEZA_RX.test(texto) && !PLAZO_RX.test(texto);
}

/** Tras una cotización: pide más ítems o lista nueva (aunque empiece con "sí, pero…"). */
export function esSolicitudCotizacionAdicional(texto: string): boolean {
  const t = texto.trim();
  if (esNuevaConsultaPieza(t)) return true;
  return COTIZACION_ADICIONAL_RX.test(t);
}

/** "2 y 2 delanteros y traseros", juego de 4 amortiguadores. */
export function esJuegoAmortiguadoresCompleto(texto: string): boolean {
  const t = texto.toLowerCase();
  const mencionaDel = /\bdelantera?s?\b|\bdelanteros?\b/.test(t);
  const mencionaTras = /\btrasera?s?\b|\btraseros?\b/.test(t);
  return (
    /\b2\s*y\s*2\b/i.test(t) ||
    (mencionaDel && mencionaTras && /\b(dos|2|cuatro|4)\b/i.test(t)) ||
    /\b(juego\s+completo|los\s+4\s+amortiguador)\b/i.test(t)
  );
}

/** Pregunta sobre la cotización en curso (posición, referencias, etc.). */
export function esConsultaDetalleCotizacion(texto: string): boolean {
  return /\b(?:solo\s+los?|esos\s+son|son\s+solo|cu[aá]l\s+es\s+cu[aá]l|son\s+(?:delanter|traser|solo)|me\s+d(?:a|as)\s+una\s+referencia|no\s+me\s+dices|cu[aá]ntos?\s+amortiguador|te\s+pregunt[eé]|pero\s+esos)\b/i.test(
    texto,
  );
}

export function esPedidoTotalCarrito(texto: string): boolean {
  return TOTAL_CARRITO_RX.test(texto.trim());
}

export function esConsultaLogisticaMixta(texto: string): boolean {
  return LOGISTICA_MIXTA_RX.test(texto.trim());
}

const SEGUIMIENTO_REPUESTOS_RX =
  /\b(?:otros?|resto|dem[aá]s|faltan?)\b.*\b(?:repuestos?|piezas?|cotiz)/i;
const PEDIDO_SIN_COTIZAR_RX =
  /\bque\s+te\s+ped[ií]\b.*\b(?:cotiz|repuestos?|piezas?)\b/i;

/** Cliente reclama que faltan piezas de una lista enviada antes. */
export function esSeguimientoRepuestosPendientes(texto: string): boolean {
  const t = texto.trim();
  return SEGUIMIENTO_REPUESTOS_RX.test(t) || PEDIDO_SIN_COTIZAR_RX.test(t);
}

export function buildConfirmToken(borrador: {
  referencia: string;
  cantidad: number;
  precioUnitarioCop: number;
}): string {
  return `${borrador.referencia}:${borrador.cantidad}:${borrador.precioUnitarioCop}`;
}
