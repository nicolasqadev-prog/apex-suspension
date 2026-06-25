/**
 * Auditoría E2E del agente WhatsApp (sin Meta):
 * cotización → aceptación → CONFIRMO → pedido en Supabase/PWA.
 *
 * Uso: npm run audit:whatsapp-e2e
 * Variables opcionales en .env.local:
 *   WA_AUDIT_PHONE=57317...  (WhatsApp del taller de prueba)
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "./parse-env-local.mjs";
import { ejecutarTurnoAgenteWhatsApp } from "../src/lib/whatsapp-agent/orchestrator.server";
import { freshWaSession, type WaSession } from "../src/lib/whatsapp-agent/types";
import { getTallerFidelizadoByWhatsapp } from "../src/lib/talleres.server";
import { getPedidoById, getPedidoLineas, listPedidosPorTelefono } from "../src/lib/pedidos.server";
import { refPedidoCorta } from "../src/lib/pedidos-estado-taller";
import { calcularPrecioTaller } from "../src/lib/precio-taller.server";
import { loadPiezaBySlug } from "../src/lib/inventario.server";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const [k, v] of Object.entries(loadEnvLocal(join(root, ".env.local")))) {
  if (!process.env[k]) process.env[k] = v;
}

// Pedidos de auditoría marcados como prueba (no afectan métricas reales).
process.env.WHATSAPP_AUDIT_ES_PRUEBA = "1";

const PHONE = process.env.WA_AUDIT_PHONE?.trim() || "573171687777";
const ESCENARIO = [
  "cancelar",
  "Tienes la referencia KSL-1011?",
  "sí",
  "CONFIRMO",
];

type Paso = { cliente: string; haku: string; fase: string };

type SnapshotCotizacion = {
  slug: string;
  referencia: string;
  precioUnitarioCop: number;
  esPrecioTaller: boolean;
};

function fail(msg: string): never {
  console.error("\n❌ AUDITORÍA FALLIDA:", msg);
  process.exit(1);
}

function ok(msg: string) {
  console.log("✓", msg);
}

function extractPedidoId(texto: string): string | null {
  const m = texto.match(/\/taller\/pedidos\/([0-9a-f-]{36})/i);
  return m?.[1] ?? null;
}

async function turno(session: WaSession, msg: string): Promise<Paso> {
  session.history.push({ role: "user", content: msg });
  const res = await ejecutarTurnoAgenteWhatsApp({
    session,
    mensajeUsuario: msg,
    phone: PHONE,
    contactName: "Auditoría E2E",
  });
  session.history.push({ role: "assistant", content: res.texto });
  return {
    cliente: msg,
    haku: res.texto,
    fase: res.session.agent.phase,
  };
}

async function main() {
  console.log("=== Auditoría E2E — Agente WhatsApp Apex ===\n");
  console.log("Teléfono de prueba:", PHONE);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    fail("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  }

  const taller = await getTallerFidelizadoByWhatsapp(PHONE);
  if (taller) {
    ok(`Taller fidelizado: ${taller.nombreTaller} (descuento ${taller.descuentoPorcentaje}%)`);
  } else {
    console.warn(
      "⚠ Este WhatsApp NO está en talleres_fidelizados — la cotización usará precio público.",
    );
    console.warn(
      "  Regístralo en admin con activo=true y publicado=true para probar precio taller.\n",
    );
  }

  const session = freshWaSession();
  const pasos: Paso[] = [];
  let snapshot: SnapshotCotizacion | null = null;

  for (const msg of ESCENARIO) {
    const paso = await turno(session, msg);
    pasos.push(paso);

    if (session.agent.phase === "cotizado" && session.agent.borrador) {
      const b = session.agent.borrador;
      snapshot = {
        slug: b.slug,
        referencia: b.referencia,
        precioUnitarioCop: b.precioUnitarioCop,
        esPrecioTaller: b.esPrecioTaller,
      };
      if (taller && !b.esPrecioTaller) {
        fail("Taller fidelizado detectado pero la cotización no aplicó precio taller");
      }
      if (taller && !paso.haku.toLowerCase().includes("precio taller")) {
        fail('La cotización no muestra etiqueta "Precio taller"');
      }
      ok(
        snapshot.esPrecioTaller
          ? `Cotización con precio taller: $${snapshot.precioUnitarioCop.toLocaleString("es-CO")}`
          : `Cotización precio público: $${snapshot.precioUnitarioCop.toLocaleString("es-CO")}`,
      );
    }

    console.log(`\nCLIENTE: ${paso.cliente}`);
    console.log(`HAKU (${paso.fase}):\n${paso.haku.slice(0, 500)}${paso.haku.length > 500 ? "…" : ""}`);
    console.log("─".repeat(50));
  }

  if (session.agent.phase !== "pedido_creado") {
    fail(`Fase final esperada pedido_creado, obtuvo: ${session.agent.phase}`);
  }
  ok("Flujo conversacional completado hasta pedido_creado");

  if (!snapshot) fail("No se capturó snapshot de cotización");

  const ultimaRespuesta = pasos[pasos.length - 1]?.haku ?? "";
  const pedidoId = extractPedidoId(ultimaRespuesta);
  if (!pedidoId) fail("No se encontró URL /taller/pedidos/{id} en la respuesta final");
  ok(`Pedido ID extraído: ${pedidoId}`);

  const refEsperada = refPedidoCorta(pedidoId);
  if (!new RegExp(`#${refEsperada}\\b`).test(ultimaRespuesta)) {
    fail(`La confirmación debe incluir #${refEsperada} (mismo número que la PWA)`);
  }
  ok(`Número de pedido en WhatsApp: #${refEsperada}`);

  const pedidoRes = await getPedidoById(pedidoId);
  if (!pedidoRes.ok) fail(pedidoRes.reason);
  const pedido = pedidoRes.pedido;
  ok(`Pedido en Supabase: estado=${pedido.estado}, taller=${pedido.taller_nombre}, es_prueba=${pedido.es_prueba}`);

  if (!pedido.es_prueba) {
    console.warn("⚠ Pedido no marcado como prueba — revisa WHATSAPP_AUDIT_ES_PRUEBA en confirm.server");
  }

  const lineasRes = await getPedidoLineas(pedidoId);
  if (!lineasRes.ok) fail(lineasRes.reason);
  if (lineasRes.lineas.length === 0) fail("Pedido sin líneas en pedido_lineas");
  ok(`${lineasRes.lineas.length} línea(s) en pedido_lineas`);

  const linea = lineasRes.lineas[0];
  const ref = linea.productos?.referencia;
  if (!ref) fail("Línea sin referencia de producto");
  if (ref !== snapshot.referencia) {
    fail(`Referencia pedido (${ref}) ≠ cotización (${snapshot.referencia})`);
  }
  ok(`Referencia en pedido: ${ref}`);

  const piezaData = await loadPiezaBySlug(snapshot.slug);
  if (!piezaData.pieza) fail(`No se encontró pieza slug=${snapshot.slug}`);
  const pricing = calcularPrecioTaller(
    { precioLista: piezaData.pieza.precioLista, precioTallerRef: piezaData.pieza.precioTallerRef },
    taller,
  );
  if (linea.precio_unitario !== pricing.precioUnitarioCop) {
    fail(
      `Precio pedido ($${linea.precio_unitario}) ≠ esperado ($${pricing.precioUnitarioCop})`,
    );
  }
  if (linea.precio_unitario !== snapshot.precioUnitarioCop) {
    fail(
      `Precio pedido ($${linea.precio_unitario}) ≠ cotización ($${snapshot.precioUnitarioCop})`,
    );
  }
  ok(`Precio coherente cotización ↔ pedido: $${linea.precio_unitario?.toLocaleString("es-CO")}`);

  const site =
    process.env.VITE_SITE_URL?.trim().replace(/\/$/, "") || "https://apex-suspension.com.co";
  const pwaUrl = `${site}/taller/pedidos/${pedidoId}`;
  ok(`URL PWA: ${pwaUrl}`);

  const listRes = await listPedidosPorTelefono(PHONE, { dias: 1, incluirPrueba: true });
  if (!listRes.ok) fail(listRes.reason);
  if (!listRes.pedidos.some((p) => p.id === pedidoId)) {
    fail("Pedido no visible en listado del taller (Mis pedidos PWA)");
  }
  ok("Pedido visible en historial PWA del taller");

  console.log("\n✅ AUDITORÍA E2E EXITOSA");
  console.log(`   Cotización → CONFIRMO → pedido #${refEsperada} en Supabase y PWA`);
  if (!taller) {
    console.log("\n   Para precio taller: agrega este WhatsApp en talleres_fidelizados (admin).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
