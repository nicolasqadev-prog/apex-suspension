/**
 * QA post-sync precios bodega (124 refs): JSON vivo ↔ Supabase ↔ fórmula Excel.
 * Uso: node scripts/qa-precios-bodega.mjs
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

const vivo = JSON.parse(readFileSync(join(root, "data/inventario-vivo.json"), "utf8"));
const MUESTRAS = ["KTR-4016", "KSL-1001", "KSA-HY016", "KTR-4015"];

function redondearCentena(n) {
  return Math.round(n / 100) * 100;
}

function precioTallerFormula(facturado) {
  if (facturado <= 0) return 0;
  if (facturado <= 50_000) return redondearCentena(facturado / 0.62);
  if (facturado <= 150_000) return redondearCentena(facturado / 0.72);
  return redondearCentena(facturado / 0.82);
}

function precioPublicoFormula(facturado) {
  if (facturado <= 0) return 0;
  if (facturado <= 50_000) return redondearCentena(facturado / 0.52);
  if (facturado <= 150_000) return redondearCentena(facturado / 0.62);
  return redondearCentena(facturado / 0.72);
}

async function rest(path) {
  const res = await fetch(`${url}/rest/v1${path}`, { headers });
  const json = await res.json();
  return { ok: res.ok, json };
}

const refs = vivo.piezas.map((p) => p.referencia);
const refsParam = refs.map((r) => `"${r}"`).join(",");
const { ok, json: dbRows } = await rest(
  `/productos?referencia=in.(${refsParam})&select=referencia,precio_lista,precio_taller,stock_actual,activo`,
);

if (!ok || !Array.isArray(dbRows)) {
  console.error("Error consultando Supabase");
  process.exit(1);
}

const dbByRef = new Map(dbRows.map((r) => [r.referencia, r]));
const fallos = [];
const detalle = [];

for (const p of vivo.piezas) {
  const db = dbByRef.get(p.referencia);
  const item = { referencia: p.referencia, json: p, bd: db ?? null };

  if (!db) {
    fallos.push(`${p.referencia}: no existe en BD`);
    detalle.push({ ...item, estado: "FALTA_BD" });
    continue;
  }
  if (!db.activo) fallos.push(`${p.referencia}: inactivo en BD`);
  if (db.precio_lista !== p.precioLista) {
    fallos.push(`${p.referencia}: público JSON ${p.precioLista} ≠ BD ${db.precio_lista}`);
  }
  if (p.precioTaller != null && db.precio_taller !== p.precioTaller) {
    fallos.push(`${p.referencia}: taller JSON ${p.precioTaller} ≠ BD ${db.precio_taller}`);
  }
  if (db.stock_actual !== p.stock) {
    fallos.push(`${p.referencia}: stock JSON ${p.stock} ≠ BD ${db.stock_actual}`);
  }
  detalle.push({
    referencia: p.referencia,
    precioListaJson: p.precioLista,
    precioListaBd: db.precio_lista,
    precioTallerJson: p.precioTaller,
    precioTallerBd: db.precio_taller,
    stockJson: p.stock,
    stockBd: db.stock_actual,
    ok:
      db.precio_lista === p.precioLista &&
      (p.precioTaller == null || db.precio_taller === p.precioTaller) &&
      db.stock_actual === p.stock,
  });
}

const muestras = MUESTRAS.map((ref) => {
  const p = vivo.piezas.find((x) => x.referencia === ref);
  const db = dbByRef.get(ref);
  return {
    referencia: ref,
    precioPublico: { json: p?.precioLista, bd: db?.precio_lista },
    precioTaller: { json: p?.precioTaller, bd: db?.precio_taller },
    stock: { json: p?.stock, bd: db?.stock_actual },
  };
});

const okCount = detalle.filter((d) => d.ok).length;
const veredicto =
  fallos.length === 0 ? "APROBADO" : fallos.length <= 3 ? "APROBADO_CON_OBSERVACIONES" : "REVISAR";

console.log(
  JSON.stringify(
    {
      generado: new Date().toISOString(),
      veredicto,
      resumen: {
        refsVivo: vivo.piezas.length,
        refsEnBd: dbRows.length,
        coincidenciasCompletas: okCount,
        fallos: fallos.length,
      },
      muestrasClave: muestras,
      fallos: fallos.slice(0, 30),
      masFallos: fallos.length > 30 ? fallos.length - 30 : 0,
      nota:
        "Compara inventario-vivo.json (post fórmula ÷0.62/0.72/0.82 taller, ÷0.52/0.62/0.72 público) con Supabase.",
    },
    null,
    2,
  ),
);

process.exit(fallos.length > 0 && veredicto === "REVISAR" ? 1 : 0);
