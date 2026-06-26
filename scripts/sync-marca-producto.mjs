/**
 * Actualiza marca_producto en Supabase solo donde difiere del JSON (rápido).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
const headers = { apikey: key, Authorization: `Bearer ${key}` };
const patchHeaders = { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" };

const catalogo = JSON.parse(
  readFileSync(join(root, "data/inventario-catalogo-completo.json"), "utf8"),
);
const jsonBySlug = new Map(
  catalogo.piezas.filter((p) => p.slug && p.marcaProducto).map((p) => [p.slug, p.marcaProducto]),
);

const PAGE = 1000;
const bdBySlug = new Map();
let offset = 0;

console.error("Descargando marca_producto de BD…");
while (true) {
  const res = await fetch(
    `${url}/rest/v1/productos?select=slug,marca_producto&order=slug.asc&limit=${PAGE}&offset=${offset}`,
    { headers },
  );
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  for (const r of rows) bdBySlug.set(r.slug, r.marca_producto);
  if (rows.length < PAGE) break;
  offset += PAGE;
}
console.error(`BD: ${bdBySlug.size} productos`);

const cambios = [];
for (const [slug, marcaJson] of jsonBySlug) {
  const marcaBd = bdBySlug.get(slug);
  if (marcaBd == null) continue;
  if (marcaBd !== marcaJson) cambios.push({ slug, marcaJson });
}

console.error(`A actualizar: ${cambios.length}`);

let actualizados = 0;
let errores = 0;
const CONC = 20;

for (let i = 0; i < cambios.length; i += CONC) {
  const lote = cambios.slice(i, i + CONC);
  await Promise.all(
    lote.map(async ({ slug, marcaJson }) => {
      const res = await fetch(
        `${url}/rest/v1/productos?slug=eq.${encodeURIComponent(slug)}`,
        { method: "PATCH", headers: patchHeaders, body: JSON.stringify({ marca_producto: marcaJson }) },
      );
      if (res.ok) actualizados += 1;
      else errores += 1;
    }),
  );
  if (i > 0 && i % 200 === 0) console.error(`  ${i}/${cambios.length}…`);
}

console.log(JSON.stringify({ totalJson: jsonBySlug.size, bd: bdBySlug.size, cambios: cambios.length, actualizados, errores }, null, 2));
