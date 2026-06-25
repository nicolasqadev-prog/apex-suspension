import {
  esConsultaMultiplePiezas,
  extraerContextoCotizacion,
  segmentarConsultasPieza,
} from "../mostrador-inventario.server";
import { esNuevaConsultaPieza } from "./intents";
import type { AclaracionPendienteWa } from "./types";

const RESPUESTA_ACLARACION_RX =
  /^\s*(s[ií]|si|sip|sep|dale|ok|delantero?s?|trasero?s?|izquierd[ao]?|derech[ao]?|\d{1,2})\b/i;

/**
 * El cliente cambió de tema (nueva lista, otro vehículo) en vez de responder la aclaración.
 */
export function debeAbandonarAclaracionPendiente(
  texto: string,
  pendiente: AclaracionPendienteWa,
): boolean {
  const t = texto.trim();
  if (!t) return false;

  if (esConsultaMultiplePiezas(t)) return true;
  if (segmentarConsultasPieza(t).length > 1) return true;

  if (t.length > 70 && (t.match(/\b(?:los|las)\s+/gi)?.length ?? 0) >= 2) return true;

  const ctx = extraerContextoCotizacion(t);
  const pendV = pendiente.ctx.vehiculo?.toLowerCase();
  const nuevoV = ctx.vehiculo?.toLowerCase();

  const modelosEnTexto = [
    "kwid",
    "rio",
    "xcite",
    "megane",
    "aveo",
    "captiva",
    "c3",
    "sandero",
    "logan",
  ].filter((m) => new RegExp(`\\b${m}\\b`, "i").test(t));

  if (modelosEnTexto.length >= 2) return true;

  if (pendV && nuevoV && nuevoV !== pendV && !new RegExp(`\\b${pendV}\\b`, "i").test(t)) {
    return true;
  }

  if (RESPUESTA_ACLARACION_RX.test(t) && t.length < 120) return false;

  if (esNuevaConsultaPieza(t) && pendV && nuevoV && nuevoV !== pendV) return true;

  return false;
}
