/** Prueba búsqueda catálogo (mismo flujo que el bot). */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal } from "./parse-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const [k, v] of Object.entries(loadEnvLocal(join(root, ".env.local")))) {
  if (!process.env[k]) process.env[k] = v;
}

const { resolverBusquedaMostrador, extraerContextoCotizacion, acumularTextoUsuario } =
  await import("../dist/server/assets/worker-entry-C6oiLW9k.js").catch(() => ({}));

// Import from built bundle is messy — query Supabase directly
const url = process.env.SUPABASE_URL?.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function search(q) {
  const pattern = `%${q.replace(/[%_,.()]/g, " ").replace(/\s+/g, " ").trim()}%`;
  const u = new URL(`${url}/rest/v1/productos`);
  u.searchParams.set("select", "referencia,nombre,aplicacion,stock_actual,precio_lista,marca_producto");
  u.searchParams.set("activo", "eq.true");
  u.searchParams.set("limit", "5");
  u.searchParams.set(
    "or",
    `(referencia.ilike.${pattern},nombre.ilike.${pattern},aplicacion.ilike.${pattern})`,
  );
  const r = await fetch(u.toString(), { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  return r.json();
}

const queries = [
  "bieleta aveo",
  "bieleta chevrolet aveo",
  "Necesito BIELETA delantera izquierda para Chevrolet Aveo 2015",
  "barra estabilizadora aveo",
  "aveo",
  "bieleta",
  "estabilizadora",
];

for (const q of queries) {
  const rows = await search(q);
  console.log(`\n"${q}" → ${Array.isArray(rows) ? rows.length : 0} resultados`);
  for (const row of (rows ?? []).slice(0, 3)) {
    console.log(`  ${row.referencia} | ${row.nombre?.slice(0, 50)} | stock ${row.stock_actual} | $${row.precio_lista}`);
  }
}
