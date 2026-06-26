/**
 * Desactiva productos Districamiones (no borra filas ni pedidos históricos).
 * Solo refs sin stock en bodega — las 124 de bodega KTC/DMB no se tocan.
 *
 * Uso: node scripts/desactivar-districamiones.mjs
 *      node scripts/desactivar-districamiones.mjs --dry-run
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dryRun = process.argv.includes("--dry-run");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

let url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
url = url.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const PAGE = 200;
let desactivados = 0;
let conStock = 0;
const muestra = [];

while (true) {
  const res = await fetch(
    `${url}/rest/v1/productos?marca_producto=ilike.districamiones&activo=eq.true&select=id,referencia,stock_actual&order=referencia.asc&limit=${PAGE}`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) {
    console.error(await res.text());
    process.exit(1);
  }
  const rows = await res.json();
  if (!rows.length) break;

  for (const row of rows) {
    const stock = Math.max(0, Math.floor(Number(row.stock_actual ?? 0)));
    if (stock > 0) {
      conStock += 1;
      continue;
    }
    if (muestra.length < 5) muestra.push(row.referencia);
    if (!dryRun) {
      const patch = await fetch(`${url}/rest/v1/productos?id=eq.${row.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ activo: false }),
      });
      if (!patch.ok) {
        console.error(`Error ${row.referencia}:`, await patch.text());
        process.exit(1);
      }
    }
    desactivados += 1;
  }

  if (rows.length < PAGE) break;
}

console.log(
  JSON.stringify(
    {
      dryRun,
      desactivados,
      omitidosConStock: conStock,
      muestra,
      nota: "activo=false; filas conservadas para historial de pedidos",
    },
    null,
    2,
  ),
);
