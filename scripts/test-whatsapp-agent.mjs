/**
 * Pruebas del agente WhatsApp (plantilla Apex) — sin red ni Supabase.
 */
import assert from "node:assert/strict";

// --- greeting (copiado inline para evitar import TS en script) ---
function saludoPorHoraColombia(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Bogota",
    }).format(now),
  );
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function esConfirmoEstricto(texto) {
  return /^\s*confirmo\s*$/i.test(texto.trim());
}

function clasificarIntencion(texto, phase) {
  const t = texto.trim();
  if (/^\s*confirmo\s*$/i.test(t)) return "confirmar_pedido";
  if (/\b(cancelar|cancela)\b/i.test(t)) return "cancelar";
  if (/\b(gracias)\b/i.test(t) && t.length < 80 && phase === "idle") return "agradecimiento";
  if ((phase === "cotizado" || phase === "esperando_confirmacion") && /^(\d{1,2})\s*(unidad)?/i.test(t))
    return "cantidad";
  if (phase === "cotizado" && /^\s*(s[ií]|si|dale|ok|la quiero)\s*$/i.test(t)) return "aceptar_cotizacion";
  return "consulta";
}

assert.equal(clasificarIntencion("sí", "cotizado"), "aceptar_cotizacion");
assert.equal(clasificarIntencion("sí", "esperando_confirmacion"), "consulta");

assert.equal(saludoPorHoraColombia(new Date("2026-06-24T14:00:00Z")), "Buenos días");
assert.equal(saludoPorHoraColombia(new Date("2026-06-24T20:00:00Z")), "Buenas tardes");
assert.equal(saludoPorHoraColombia(new Date("2026-06-25T02:00:00Z")), "Buenas noches");

assert.equal(esConfirmoEstricto("CONFIRMO"), true);
assert.equal(esConfirmoEstricto("sí"), false);
assert.equal(clasificarIntencion("gracias", "idle"), "agradecimiento");
assert.equal(clasificarIntencion("2", "cotizado"), "cantidad");

console.log("OK: whatsapp-agent unit tests passed");
