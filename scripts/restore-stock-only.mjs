/**
 * Restablece solo stock_actual en Supabase según inventario-vivo.json.
 * No modifica precios, nombres ni otros campos del catálogo.
 *
 * Uso:
 *   npm run restore:stock
 *   node scripts/restore-stock-only.mjs [ruta/al/inventario-vivo.json]
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvLocal() {
  const p = join(root, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

let url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
url = url.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

let jsonPath = join(root, "data", "inventario-vivo.json");
for (const arg of process.argv.slice(2)) {
  if (!arg.startsWith("-")) {
    jsonPath = arg.includes("/") || arg.includes("\\") ? arg : join(root, arg);
  }
}

if (!url || !key) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

function rest(path, init = {}) {
  return fetch(`${url}/rest/v1${path}`, { ...init, headers: { ...headers, ...init.headers } });
}

async function findByReferencia(referencia) {
  const res = await rest(
    `/productos?referencia=eq.${encodeURIComponent(referencia)}&activo=eq.true&select=id,referencia,stock_actual&limit=1`,
  );
  if (!res.ok) throw new Error(`GET productos: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

async function insertStockMovement(productoId, delta, motivo) {
  const res = await rest("/stock_movimientos", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ producto_id: productoId, delta, motivo }),
  });
  if (!res.ok) throw new Error(`POST stock_movimientos: ${res.status} ${await res.text()}`);
}

const raw = readFileSync(jsonPath, "utf8");
const data = JSON.parse(raw);
const piezas = data.piezas;
if (!Array.isArray(piezas)) {
  console.error("JSON inválido: falta array piezas");
  process.exit(1);
}

let ajustados = 0;
let sinCambio = 0;
let omitidos = 0;
let unidadesObjetivo = 0;

for (let i = 0; i < piezas.length; i++) {
  const p = piezas[i];
  if (i > 0 && i % 25 === 0) {
    console.error(`Progreso ${i}/${piezas.length}…`);
  }

  const referencia = (p.referencia ?? "").trim();
  const stock = Math.max(0, Math.floor(Number(p.stock ?? 0)));
  unidadesObjetivo += stock;

  if (!referencia) {
    omitidos += 1;
    continue;
  }

  const prod = await findByReferencia(referencia);
  if (!prod) {
    console.warn(`No encontrado en BD (activo): ${referencia}`);
    omitidos += 1;
    continue;
  }

  const actual = Math.max(0, Math.floor(Number(prod.stock_actual ?? 0)));
  const delta = stock - actual;
  if (delta === 0) {
    sinCambio += 1;
    continue;
  }

  await insertStockMovement(prod.id, delta, "Restablecer bodega — solo stock");
  ajustados += 1;
}

console.log(
  JSON.stringify(
    {
      archivo: jsonPath,
      piezas: piezas.length,
      unidadesObjetivo,
      ajustados,
      sinCambio,
      omitidos,
      nota: "Solo stock_actual vía stock_movimientos. Precios y catálogo intactos.",
    },
    null,
    2,
  ),
);
