/**
 * QA — cobertura catálogo completo (referencia directa, bodega + bajo pedido).
 * Muestrea productos activos y verifica que Haku cotice cada referencia.
 *
 * Uso: npm run qa:whatsapp-catalogo
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "./parse-env-local.mjs";
import { normalizeSupabaseUrl } from "../src/lib/supabase-env";
import { ejecutarTurnoAgenteWhatsApp } from "../src/lib/whatsapp-agent/orchestrator.server";
import { freshWaSession } from "../src/lib/whatsapp-agent/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const [k, v] of Object.entries(loadEnvLocal(join(root, ".env.local")))) {
  if (!process.env[k]) process.env[k] = v;
}

const PHONE = process.env.WA_AUDIT_PHONE?.trim() || "573171687777";
const MUESTRA = Number(process.env.WA_QA_CATALOGO_MUESTRA ?? 40);
const MUESTRA_BODEGA = Math.ceil(MUESTRA / 2);
const MUESTRA_PEDIDO = Math.floor(MUESTRA / 2);

type ProductoRow = {
  referencia: string;
  stock_actual: number;
  nombre: string;
};

async function cargarProductosActivos(): Promise<ProductoRow[]> {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");

  const base = normalizeSupabaseUrl(rawUrl);
  const all: ProductoRow[] = [];
  let offset = 0;

  while (true) {
    const u = new URL(`${base}/rest/v1/productos`);
    u.searchParams.set("select", "referencia,stock_actual,nombre");
    u.searchParams.set("activo", "eq.true");
    u.searchParams.set("order", "stock_actual.desc,referencia.asc");

    const res = await fetch(u.toString(), {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${offset}-${offset + 999}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const page = (await res.json()) as ProductoRow[];
    all.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return all;
}

function muestrear<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]!);
  return out;
}

async function cotizarReferencia(ref: string): Promise<string> {
  const session = freshWaSession();
  session.history.push({ role: "user", content: `Tienes la referencia ${ref}?` });
  const res = await ejecutarTurnoAgenteWhatsApp({
    session,
    mensajeUsuario: `Tienes la referencia ${ref}?`,
    phone: PHONE,
  });
  return res.texto;
}

function validarRespuesta(ref: string, stock: number, texto: string): string | null {
  const refRx = new RegExp(ref.replace(/[- ]/g, "[- ]?"), "i");
  if (!refRx.test(texto)) return `no menciona ${ref}`;
  if (stock > 0 && !/bodega/i.test(texto)) return "tiene stock pero no dice EN BODEGA";
  if (stock <= 0 && !/bajo pedido/i.test(texto)) return "sin stock pero no dice BAJO PEDIDO";
  if (!/\$\s*[\d.]/.test(texto)) return "no muestra precio";
  if (/no encontr[eé]/i.test(texto)) return "respondió sin match";
  return null;
}

async function main() {
  console.log("=== QA WhatsApp — cobertura catálogo por referencia ===\n");

  const productos = await cargarProductosActivos();
  const bodega = productos.filter((p) => p.stock_actual > 0);
  const pedido = productos.filter((p) => p.stock_actual <= 0);

  console.log(`Catálogo activo: ${productos.length} referencias`);
  console.log(`  EN BODEGA: ${bodega.length}`);
  console.log(`  BAJO PEDIDO: ${pedido.length}`);
  console.log(`Muestra QA: ${MUESTRA_BODEGA} bodega + ${MUESTRA_PEDIDO} bajo pedido\n`);

  const muestra = [
    ...muestrear(bodega, MUESTRA_BODEGA),
    ...muestrear(pedido, MUESTRA_PEDIDO),
  ];

  let ok = 0;
  let fallos = 0;

  for (const p of muestra) {
    const ref = p.referencia.trim();
    process.stdout.write(`  ${ref} (stock ${p.stock_actual})… `);
    try {
      const texto = await cotizarReferencia(ref);
      const err = validarRespuesta(ref, p.stock_actual, texto);
      if (err) {
        fallos++;
        console.log(`❌ ${err}`);
        console.log(`     ${texto.slice(0, 120)}…`);
      } else {
        ok++;
        console.log("OK");
      }
    } catch (e) {
      fallos++;
      console.log(`❌ ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`Resultado: ${ok} OK, ${fallos} fallos de ${muestra.length} muestras`);
  if (fallos > 0) process.exit(1);
  console.log("\n✅ Cobertura por referencia OK — catálogo listo para WhatsApp");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
