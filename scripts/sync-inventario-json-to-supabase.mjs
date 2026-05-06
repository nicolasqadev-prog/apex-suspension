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

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// URL debe ser solo el origen: https://xxxx.supabase.co (sin /rest/v1 al final).
let url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
url = url.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const jsonPath = process.argv[2] ?? join(root, "data", "inventario.ejemplo.json");

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
    `/productos?slug=eq.${encodeURIComponent(slug)}&select=id,slug,referencia&limit=1`,
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
const piezas = data.piezas;
if (!Array.isArray(piezas)) {
  console.error("JSON inválido: falta array piezas");
  process.exit(1);
}

let created = 0;
let updated = 0;
let skippedStock = 0;

for (const p of piezas) {
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
    skippedStock += 1;
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

console.log(
  JSON.stringify(
    {
      archivo: jsonPath,
      creados: created,
      actualizadosMetadatos: updated,
      existentesSinMovimientoExtra: skippedStock,
      nota: "Stock solo se cargó por movimiento en productos nuevos. Para ajustar stock de existentes usá movimientos o un flujo interno.",
    },
    null,
    2,
  ),
);
