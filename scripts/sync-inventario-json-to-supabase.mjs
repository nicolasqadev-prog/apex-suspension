/**
 * Sincroniza `data/inventario.ejemplo.json` (o la ruta que pases) hacia Supabase.
 *
 * - Producto nuevo: inserta en `productos` (stock_actual=0) + movimiento en `stock_movimientos`
 *   para respetar el trigger del esquema.
 * - Producto existente (mismo slug): actualiza datos de catálogo (precio, nombre, etc.)
 *   sin tocar stock ni insertar movimientos otra vez (evita duplicar entradas).
 *
 * Uso (con variables en el entorno o en `.env.local` cargadas manualmente):
 *   set SUPABASE_URL=... && set SUPABASE_SERVICE_ROLE_KEY=... && node scripts/sync-inventario-json-to-supabase.mjs
 *
 * Opcional: ruta al JSON
 *   node scripts/sync-inventario-json-to-supabase.mjs path/al/inventario.json
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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

// URL debe ser solo el origen: https://xxxx.supabase.co (sin /rest/v1 al final).
let url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
url = url.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

let jsonPath = join(root, "data", "inventario.ejemplo.json");
let desde = 0;
let cantidad = Infinity;

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--desde=")) {
    desde = Math.max(0, Number(arg.slice(8)) || 0);
  } else if (arg.startsWith("--cantidad=")) {
    cantidad = Math.max(1, Number(arg.slice(11)) || 1);
  } else if (!arg.startsWith("-")) {
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

async function findProductBySlug(slug) {
  const res = await rest(
    `/productos?slug=eq.${encodeURIComponent(slug)}&select=id,slug,referencia,stock_actual&limit=1`,
  );
  if (!res.ok) throw new Error(`GET productos: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

async function insertProduct(row) {
  const res = await rest("/productos", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`POST productos: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0];
}

async function patchProduct(id, patch) {
  const res = await rest(`/productos?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`PATCH productos: ${res.status} ${await res.text()}`);
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
const todas = data.piezas;
if (!Array.isArray(todas)) {
  console.error("JSON inválido: falta array piezas");
  process.exit(1);
}

const hasta = Math.min(desde + cantidad, todas.length);
const piezas = todas.slice(desde, hasta);
const total = todas.length;

console.error(
  `Lote: indices ${desde}-${hasta - 1} de ${total} (${piezas.length} piezas en este paso)`,
);

let created = 0;
let updated = 0;
let stockAjustado = 0;
let omitidos = 0;

for (let i = 0; i < piezas.length; i++) {
  const p = piezas[i];
  if (i > 0 && i % 100 === 0) {
    console.error(
      `Progreso lote: ${i}/${piezas.length} (creados ${created}, actualizados ${updated})`,
    );
  }
  const slug = p.slug;
  const referencia = p.referencia;
  const nombre = p.nombre;
  const aplicacion = p.aplicacion ?? null;
  const categoria = p.categoria ?? null;
  const marca = p.marca ?? "KTC";
  const precio_lista = Number(p.precioLista);
  const stock = Math.max(0, Math.floor(Number(p.stock ?? 0)));

  if (!slug || !referencia || !nombre || Number.isNaN(precio_lista)) {
    console.warn("Fila omitida (datos incompletos):", p);
    omitidos += 1;
    continue;
  }

  const existing = await findProductBySlug(slug);

  if (existing) {
    await patchProduct(existing.id, {
      referencia,
      nombre,
      aplicacion,
      categoria,
      marca,
      precio_lista,
      activo: true,
    });
    updated += 1;
    const actual = Math.max(0, Math.floor(Number(existing.stock_actual ?? 0)));
    const delta = stock - actual;
    if (delta !== 0) {
      await insertStockMovement(existing.id, delta, "Sync catálogo — ajuste stock");
      stockAjustado += 1;
    }
    continue;
  }

  const row = {
    slug,
    referencia,
    nombre,
    aplicacion,
    categoria,
    marca,
    precio_lista,
    activo: true,
    stock_actual: 0,
  };

  const inserted = await insertProduct(row);
  if (stock > 0) {
    await insertStockMovement(inserted.id, stock, "Carga inicial desde inventario JSON");
  }
  created += 1;
}

const siguiente = hasta < total ? hasta : null;
console.log(
  JSON.stringify(
    {
      archivo: jsonPath,
      lote: { desde, hasta: hasta - 1, total },
      creados: created,
      actualizadosMetadatos: updated,
      omitidos,
      stockAjustadoEnExistentes: stockAjustado,
      siguiente_desde: siguiente,
      completado: siguiente === null,
      nota: "Siguiente paso: --desde=siguiente_desde --cantidad=N",
    },
    null,
    2,
  ),
);
