/**
 * E2E WhatsApp → Supabase → PWA (mismo número de pedido #XXXXXX).
 *
 * Flujo: cotizar (carrito) → CONFIRMO → pedido en BD → visible como en /taller/pedidos/{id}
 *
 * Uso: npm run qa:whatsapp-pedido-pwa
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "./parse-env-local.mjs";
import { ejecutarTurnoAgenteWhatsApp } from "../src/lib/whatsapp-agent/orchestrator.server";
import { freshWaSession, type WaSession } from "../src/lib/whatsapp-agent/types";
import { refPedidoCorta } from "../src/lib/pedidos-estado-taller";
import {
  getPedidoById,
  getPedidoLineas,
  listPedidosPorTelefono,
} from "../src/lib/pedidos.server";
import { normalizeWhatsapp } from "../src/lib/talleres.server";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const [k, v] of Object.entries(loadEnvLocal(join(root, ".env.local")))) {
  if (!process.env[k]) process.env[k] = v;
}

process.env.WHATSAPP_AUDIT_ES_PRUEBA = "1";

const PHONE = process.env.WA_AUDIT_PHONE?.trim() || "573171687777";

const ESCENARIO_CARRITO = [
  "cancelar",
  "Hola buen dia necesito los amortiguadores de un Renault megane 2",
  "Delanteros",
  "Okay también necesito los amortiguadores traseros de un Kia rio XCITE los tienes?",
  "Si me sirven ambas, cuánto sería todo?",
  "CONFIRMO",
];

function fail(msg: string): never {
  console.error("\n❌ E2E PWA FALLIDO:", msg);
  process.exit(1);
}

function ok(msg: string) {
  console.log("  ✓", msg);
}

function extractPedidoId(texto: string): string | null {
  const m = texto.match(/\/taller\/pedidos\/([0-9a-f-]{36})/i);
  return m?.[1] ?? null;
}

function extractRefEnMensaje(texto: string): string | null {
  const m = texto.match(/#([A-Z0-9]{6})\b/);
  return m?.[1] ?? null;
}

async function turno(session: WaSession, msg: string) {
  session.history.push({ role: "user", content: msg });
  const res = await ejecutarTurnoAgenteWhatsApp({
    session,
    mensajeUsuario: msg,
    phone: PHONE,
    contactName: "QA Pedido PWA",
  });
  session.history.push({ role: "assistant", content: res.texto });
  return { cliente: msg, haku: res.texto, fase: res.session.agent.phase, session: res.session };
}

/** Misma validación que hace la PWA en obtenerDetallePedidoTaller (sin server fn). */
async function validarAccesoPwa(pedidoId: string, whatsapp: string) {
  const pedidoRes = await getPedidoById(pedidoId);
  if (!pedidoRes.ok) fail(pedidoRes.reason);

  const telPedido = pedidoRes.pedido.telefono.replace(/\D/g, "");
  const telTaller = normalizeWhatsapp(whatsapp).replace(/\D/g, "");
  if (telPedido !== telTaller) {
    fail(`Teléfono pedido (${telPedido}) ≠ taller (${telTaller}) — PWA no autorizaría el detalle`);
  }
  ok("Teléfono del pedido coincide con el taller (acceso PWA OK)");

  const lineasRes = await getPedidoLineas(pedidoId);
  if (!lineasRes.ok) fail(lineasRes.reason);

  let totalCop = 0;
  for (const l of lineasRes.lineas) {
    totalCop += Number(l.precio_unitario) * l.cantidad;
  }

  return {
    pedido: pedidoRes.pedido,
    lineas: lineasRes.lineas,
    totalCop,
  };
}

async function main() {
  console.log("=== E2E WhatsApp → Pedido PWA (carrito + #ref) ===\n");
  console.log("Teléfono:", PHONE);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    fail("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }

  const session = freshWaSession();
  let ultimaRespuesta = "";

  for (const msg of ESCENARIO_CARRITO) {
    const paso = await turno(session, msg);
    ultimaRespuesta = paso.haku;
    console.log(`\n→ CLIENTE: ${msg}`);
    console.log(`  HAKU (${paso.fase}): ${paso.haku.slice(0, 280)}${paso.haku.length > 280 ? "…" : ""}`);
  }

  if (session.agent.phase !== "pedido_creado") {
    fail(`Fase final esperada pedido_creado, obtuvo: ${session.agent.phase}`);
  }
  ok("Flujo WhatsApp completado (CONFIRMO → pedido_creado)");

  const pedidoId = extractPedidoId(ultimaRespuesta);
  if (!pedidoId) fail("No hay URL /taller/pedidos/{uuid} en la confirmación");

  const refEsperada = refPedidoCorta(pedidoId);
  const refEnMensaje = extractRefEnMensaje(ultimaRespuesta);
  if (!refEnMensaje) fail("La confirmación WhatsApp no incluye número de pedido #XXXXXX");
  if (refEnMensaje !== refEsperada) {
    fail(`Ref WhatsApp #${refEnMensaje} ≠ PWA #${refEsperada}`);
  }
  ok(`Número de pedido coherente: #${refEsperada} (igual en WhatsApp y PWA)`);

  const detalle = await validarAccesoPwa(pedidoId, PHONE);
  ok(`Pedido en Supabase: estado=${detalle.pedido.estado}, es_prueba=${detalle.pedido.es_prueba}`);

  if (detalle.lineas.length < 2) {
    fail(`Se esperaban ≥2 líneas (carrito Megane+Rio), hay ${detalle.lineas.length}`);
  }
  ok(`${detalle.lineas.length} línea(s) en pedido_lineas (mismo registro que ve la PWA)`);

  const refs = detalle.lineas.map((l) => l.productos?.referencia).filter(Boolean);
  if (!refs.includes("KSA-RE008")) fail("Falta línea KSA-RE008 (Megane) en el pedido");
  if (!refs.includes("KSA-HY016")) fail("Falta línea KSA-HY016 (Rio) en el pedido");
  ok(`Referencias en pedido: ${refs.join(", ")}`);

  const listRes = await listPedidosPorTelefono(PHONE, { dias: 1, incluirPrueba: true });
  if (!listRes.ok) fail(listRes.reason);
  const enLista = listRes.pedidos.some((p) => p.id === pedidoId);
  if (!enLista) fail("Pedido no aparece en listPedidosPorTelefono (Mis pedidos PWA)");
  ok("Pedido listado en historial del taller (como /taller/pedidos)");

  const site =
    process.env.VITE_SITE_URL?.trim().replace(/\/$/, "") || "https://apex-suspension.com.co";
  const pwaUrl = `${site}/taller/pedidos/${pedidoId}`;
  ok(`URL PWA detalle: ${pwaUrl}`);
  ok(`Total pedido: $${detalle.totalCop.toLocaleString("es-CO")}`);

  console.log("\n✅ E2E PWA EXITOSO — WhatsApp y portal comparten el mismo pedido #" + refEsperada);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
