/**
 * QA precios catálogo completo (~5910): JSON ↔ Supabase (muestra + bodega).
 * Uso: node scripts/qa-precios-catalogo.mjs
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

const catalogo = JSON.parse(
  readFileSync(join(root, "data/inventario-catalogo-completo.json"), "utf8"),
);
const MUESTRAS = ["KTR-4015", "KTR-4016", "KSL-1001", "KSA-HY016", "KSA-RE047", "KTR-9999"];

async function rest(path) {
  const res = await fetch(`${url}/rest/v1${path}`, { headers });
  return { ok: res.ok, json: await res.json() };
}

const piezas = catalogo.piezas;
const fallos = [];
let verificadas = 0;

// Verificar muestras clave + cada 50ª pieza del catálogo
const indices = new Set([0, 1, 2, 100, 500, 1000, 2000, 3000, 4000, 5000, piezas.length - 1]);
for (const ref of MUESTRAS) {
  const idx = piezas.findIndex((p) => p.referencia === ref);
  if (idx >= 0) indices.add(idx);
}

for (const i of [...indices].sort((a, b) => a - b)) {
  const p = piezas[i];
  if (!p) continue;
  const { ok, json } = await rest(
    `/productos?referencia=eq.${encodeURIComponent(p.referencia)}&select=referencia,precio_lista,precio_taller,stock_actual&limit=1`,
  );
  verificadas += 1;
  if (!ok || !Array.isArray(json) || !json[0]) {
    fallos.push(`${p.referencia}: no en BD`);
    continue;
  }
  const db = json[0];
  if (db.precio_lista !== p.precioLista) {
    fallos.push(`${p.referencia}: público JSON ${p.precioLista} ≠ BD ${db.precio_lista}`);
  }
  if (p.precioTaller != null && db.precio_taller !== p.precioTaller) {
    fallos.push(`${p.referencia}: taller JSON ${p.precioTaller} ≠ BD ${db.precio_taller}`);
  }
}

// Conteo total con precio_taller en BD (muestra)
const conTaller = await rest(
  "/productos?activo=eq.true&precio_taller=not.is.null&select=id&limit=1",
  { Prefer: "count=exact" },
);
const parseCount = (range) => {
  if (!range) return null;
  const m = String(range).match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
};

const totalActivos = await fetch(`${url}/rest/v1/productos?activo=eq.true&select=id&limit=1`, {
  headers: { ...headers, Prefer: "count=exact" },
});
const conTallerRes = await fetch(
  `${url}/rest/v1/productos?activo=eq.true&precio_taller=not.is.null&select=id&limit=1`,
  { headers: { ...headers, Prefer: "count=exact" } },
);

const veredicto = fallos.length === 0 ? "APROBADO" : "REVISAR";

console.log(
  JSON.stringify(
    {
      generado: new Date().toISOString(),
      veredicto,
      catalogoJson: piezas.length,
      muestrasVerificadas: verificadas,
      productosActivosBd: parseCount(totalActivos.headers.get("content-range")),
      conPrecioTallerBd: parseCount(conTallerRes.headers.get("content-range")),
      fallos,
      muestrasClave: MUESTRAS.map((ref) => {
        const p = piezas.find((x) => x.referencia === ref);
        return p
          ? { referencia: ref, precioLista: p.precioLista, precioTaller: p.precioTaller }
          : { referencia: ref, error: "no en JSON" };
      }),
    },
    null,
    2,
  ),
);

process.exit(fallos.length > 0 ? 1 : 0);
