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
const NUEVA_PIEZA_RX =
  /\b(bieleta|barra\s+estabilizadora|r[oó]tula|terminal|amortiguador|buje|brazo|tijera|link)\b/i;

const VALIDAR_RX = /\b(es para|esa es|sirve para|es del|es de el|compatible con|me sirve para)\b/i;

const CONFIRMO_STRICT_RX = /^\s*confirmo\s*$/i;
const CANCELAR_RX = /\b(cancelar|cancela|no quiero|dejalo|olvida|anula)\b/i;
const MODIFICAR_RX = /\b(modificar|cambiar|otra referencia|otra pieza|cambia|corrige)\b/i;
const GRACIAS_RX = /\b(gracias|muchas gracias|ok gracias|perfecto gracias|listo gracias)\b/i;
const RECHAZAR_RX = /\b(no gracias|no es|no esa|busco otra|otra pieza|otra ref|nel|nop)\b/i;
const ACEPTAR_STRICT_RX =
  /^\s*(s[ií]|si|sip|sep|dale|ok|okay|listo|perfecto|esa|esa misma|la quiero|quiero|me sirve|de una|va|vamos)\s*[!.?]*\s*$/i;
const ACEPTAR_LOOSE_RX =
  /\b(s[ií]\s*(la quiero|quiero|por favor)?|dale|la quiero|me sirve|de una|agregala|agrégal[ao]|esa misma)\b/i;

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
    if (ACEPTAR_STRICT_RX.test(t) || ACEPTAR_LOOSE_RX.test(t)) return "aceptar_cotizacion";
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

export function buildConfirmToken(borrador: {
  referencia: string;
  cantidad: number;
  precioUnitarioCop: number;
}): string {
  return `${borrador.referencia}:${borrador.cantidad}:${borrador.precioUnitarioCop}`;
}
