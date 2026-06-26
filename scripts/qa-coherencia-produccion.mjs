/**
 * Auditoría coherencia proveedores + anti-frankenstein (producción/BD).
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
const h = { apikey: key, Authorization: `Bearer ${key}` };
const hCount = { ...h, Prefer: "count=exact" };

function parseCount(range) {
  if (!range) return null;
  const m = String(range).match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

async function count(filter) {
  const r = await fetch(`${url}/rest/v1/productos?${filter}&select=id&limit=1`, { headers: hCount });
  return parseCount(r.headers.get("content-range"));
}

async function fetchJson(path) {
  const r = await fetch(`${url}/rest/v1${path}`, { headers: h });
  if (!r.ok) return { error: r.status, text: await r.text() };
  return r.json();
}

const catalogo = JSON.parse(readFileSync(join(root, "data/inventario-catalogo-completo.json"), "utf8"));
const vivo = JSON.parse(readFileSync(join(root, "data/inventario-vivo.json"), "utf8"));

const jsonByRef = new Map(catalogo.piezas.map((p) => [p.referencia, p]));
const jsonSlugs = new Set(catalogo.piezas.map((p) => p.slug));
const dupRefsJson = catalogo.piezas.length - jsonByRef.size;
const dupSlugsJson = catalogo.piezas.length - jsonSlugs.size;

const activos = await count("activo=eq.true");
const inactivos = await count("activo=eq.false");
const distActivos = await count("marca_producto=ilike.districamiones&activo=eq.true");
const distInactivos = await count("marca_producto=ilike.districamiones&activo=eq.false");
const yoko = await count("marca_producto=eq.Yokomitsu&activo=eq.true");
const universal = await count("marca_producto=eq.Universal&activo=eq.true");
const ktc = await count("marca_producto=eq.KTC&activo=eq.true");
const stockBodega = await count("stock_actual=gt.0&activo=eq.true");
const sinPrecioTaller = await count("activo=eq.true&precio_taller=is.null");
const activosSinPrecioLista = await count("activo=eq.true&precio_lista=eq.0");

// Muestras cruzadas JSON ↔ BD
const MUESTRAS = [
  "KTR-4016",
  "KSL-1001",
  "HY07719",
  "7185723001",
  "KSA-RE047",
];
const cruce = [];
for (const ref of MUESTRAS) {
  const j = jsonByRef.get(ref);
  const rows = await fetchJson(
    `/productos?referencia=eq.${encodeURIComponent(ref)}&select=referencia,slug,precio_lista,precio_taller,stock_actual,activo,marca_producto&limit=5`,
  );
  const activo = Array.isArray(rows) ? rows.find((r) => r.activo) : null;
  const inactivo = Array.isArray(rows) ? rows.filter((r) => !r.activo) : [];
  cruce.push({
    referencia: ref,
    enJson: Boolean(j),
    json: j ? { precioLista: j.precioLista, precioTaller: j.precioTaller, marcaProducto: j.marcaProducto, stock: j.stock } : null,
    bdActivo: activo ?? null,
    bdInactivosDuplicados: inactivo.length,
  });
}

// Districamiones visibles si alguno activo con stock
const distStock = await fetchJson(
  "/productos?marca_producto=ilike.districamiones&stock_actual=gt.0&select=referencia,stock_actual,activo&limit=10",
);

// Productos activos en BD que NO están en JSON catálogo (frankenstein huérfanos)
const activosMuestra = await fetchJson(
  "/productos?activo=eq.true&marca_producto=eq.KTC&select=referencia&order=referencia.asc&limit=5000",
);
let huerfanosKtc = 0;
const huerfanosEjemplo = [];
if (Array.isArray(activosMuestra)) {
  for (const r of activosMuestra) {
    if (!jsonByRef.has(r.referencia)) {
      huerfanosKtc += 1;
      if (huerfanosEjemplo.length < 5) huerfanosEjemplo.push(r.referencia);
    }
  }
}

// JSON sin activo en BD — muestra por proveedor (rápido)
const porProveedor = ["KTC", "Yokomitsu", "Universal"];
const jsonSinActivoBd = {};
for (const mp of porProveedor) {
  const muestra = catalogo.piezas.filter((p) => p.marcaProducto === mp).slice(0, 3);
  let faltan = 0;
  for (const p of muestra) {
    const rows = await fetchJson(
      `/productos?referencia=eq.${encodeURIComponent(p.referencia)}&activo=eq.true&select=referencia&limit=1`,
    );
    if (!Array.isArray(rows) || !rows[0]) faltan += 1;
  }
  jsonSinActivoBd[mp] = { muestra: muestra.length, faltanEnBd: faltan };
}

const fallos = [];
if (distActivos > 0) fallos.push(`Districamiones aún activos: ${distActivos}`);
if (activos !== catalogo.piezas.length) fallos.push(`Activos BD ${activos} != JSON catálogo ${catalogo.piezas.length}`);
if (stockBodega !== vivo.piezas.filter((p) => p.stock > 0).length)
  fallos.push(`Stock bodega BD ${stockBodega} != vivo ${vivo.piezas.filter((p) => p.stock > 0).length}`);
if (dupRefsJson > 0) fallos.push(`Refs duplicadas en JSON: ${dupRefsJson}`);
if (sinPrecioTaller > 0) fallos.push(`Activos sin precio_taller: ${sinPrecioTaller}`);
if (yoko < 2000) fallos.push(`Yokomitsu bajo (${yoko})`);
// Universal ya no se usa; CTR reemplaza lista Apex
const ctr = await count("marca_producto=eq.CTR&activo=eq.true");
if (ctr < 1500) fallos.push(`CTR bajo (${ctr})`);

const veredicto = fallos.length === 0 ? "APROBADO" : fallos.length <= 2 ? "APROBADO_CON_OBSERVACIONES" : "REVISAR";

console.log(
  JSON.stringify(
    {
      generado: new Date().toISOString(),
      veredicto,
      fallos,
      resumen: {
        catalogoJson: catalogo.piezas.length,
        bodegaVivo: vivo.piezas.length,
        productosActivosBd: activos,
        productosInactivosBd: inactivos,
        stockBodegaBd: stockBodega,
      },
      proveedoresActivos: { KTC: ktc, Yokomitsu: yoko, Universal: universal, Districamiones: distActivos },
      districamiones: { activos: distActivos, inactivos: distInactivos, conStock: distStock },
      integridadJson: { dupRefs: dupRefsJson, dupSlugs: dupSlugsJson },
      calidadPrecios: { sinPrecioTallerActivos: sinPrecioTaller, precioListaCero: activosSinPrecioLista },
      cruceMuestras: cruce,
      frankenstein: {
        ktcActivosNoEnJson: huerfanosKtc,
        ktcHuerfanosEjemplo: huerfanosEjemplo,
        jsonSinActivoBd_muestraPorProveedor: jsonSinActivoBd,
        nota: "Huérfanos = activos en BD fuera del JSON actual; revisar si son legacy",
      },
    },
    null,
    2,
  ),
);
