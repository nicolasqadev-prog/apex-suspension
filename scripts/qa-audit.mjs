/**
 * Auditoría QA post-saneamiento: coherencia PWA ↔ Supabase ↔ JSON.
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
const ejemplo = JSON.parse(readFileSync(join(root, "data/inventario.ejemplo.json"), "utf8"));
const vivo = JSON.parse(readFileSync(join(root, "data/inventario-vivo.json"), "utf8"));

const ejSlugs = ejemplo.piezas.map((p) => p.slug);
const catByRef = new Map(catalogo.piezas.map((p) => [p.referencia, p]));
const DESCUENTO = 16.67;

async function rest(path, extraHeaders = {}) {
  const res = await fetch(`${url}/rest/v1${path}`, {
    headers: { ...headers, ...extraHeaders },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json, range: res.headers.get("content-range") };
}

const totalActivos = await rest("/productos?activo=eq.true&select=id&limit=1", {
  Prefer: "count=exact",
});
const totalTodos = await rest("/productos?select=id&limit=1", { Prefer: "count=exact" });
const stockActivo = await rest(
  "/productos?stock_actual=gt.0&activo=eq.true&select=referencia,stock_actual&limit=1",
  { Prefer: "count=exact" },
);
const ktr = await rest(
  "/productos?referencia=eq.KTR-4015&activo=eq.true&select=referencia,precio_lista,stock_actual,marca",
);
const demosActivos = await rest(
  `/productos?slug=in.(${ejSlugs.map((s) => `"${s}"`).join(",")})&activo=eq.true&select=slug`,
);
const demosInactivos = await rest(
  `/productos?slug=in.(${ejSlugs.map((s) => `"${s}"`).join(",")})&activo=eq.false&select=slug`,
);
const talleres = await rest(
  "/talleres_fidelizados?activo=eq.true&select=whatsapp,nombre_taller,descuento_porcentaje",
);

const catKtr = catByRef.get("KTR-4015");
const ktrDb = ktr.ok && Array.isArray(ktr.json) ? ktr.json[0] : null;
const precioTallerEsperado = catKtr ? Math.round(catKtr.precioLista * (1 - DESCUENTO / 100)) : null;

const talleresList = talleres.ok && Array.isArray(talleres.json) ? talleres.json : [];
const talleresOk = talleresList.every(
  (t) => Math.abs(Number(t.descuento_porcentaje) - DESCUENTO) < 0.02,
);

const parseCount = (range) => {
  if (!range) return null;
  const m = range.match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
};

const checks = {
  supabaseConectado: !!url && !!key,
  productosActivos: parseCount(totalActivos.range),
  productosTotales: parseCount(totalTodos.range),
  stockActivoBodega: parseCount(stockActivo.range),
  stockEsperadoVivo: vivo.piezas.filter((p) => p.stock > 0).length,
  demoVisiblesEnCatalogo: demosActivos.ok ? (demosActivos.json?.length ?? 0) : -1,
  demoDesactivados: demosInactivos.ok ? (demosInactivos.json?.length ?? 0) : -1,
  ktrPrecioCoincide: ktrDb?.precio_lista === catKtr?.precioLista,
  ktrStockCoincide: ktrDb?.stock_actual === catKtr?.stock,
  precioTaller16_67: precioTallerEsperado,
  talleresDescuentoOk: talleresOk,
  talleres: talleresList,
};

const fallos = [];
if (checks.demoVisiblesEnCatalogo > 0) fallos.push("Demo activo en catálogo");
if (checks.demoDesactivados !== ejSlugs.length) fallos.push("Demo no desactivado por completo");
if (checks.stockActivoBodega !== checks.stockEsperadoVivo)
  fallos.push(`Stock activo ${checks.stockActivoBodega} != vivo ${checks.stockEsperadoVivo}`);
if (!checks.ktrPrecioCoincide) fallos.push("KTR-4015 precio no coincide JSON/BD");
if (!checks.ktrStockCoincide) fallos.push("KTR-4015 stock no coincide JSON/BD");
if (!checks.talleresDescuentoOk && talleresList.length) fallos.push("Taller sin 16.67%");
if (checks.productosActivos < 5900) fallos.push("Pocos productos activos en BD");

const veredicto =
  fallos.length === 0 ? "APROBADO" : fallos.length <= 2 ? "APROBADO_CON_OBSERVACIONES" : "REVISAR";

console.log(
  JSON.stringify(
    {
      veredicto,
      fallos,
      checks,
      flujo: {
        runtime: "Supabase productos activos → loadCatalogo()",
        catalogoJson: catalogo.piezas.length,
        fallback: "inventario.ejemplo.json (10 SKUs, solo sin Supabase)",
        syncCatalogo: "inventario-catalogo-completo.json — NO pisa stock existente",
        syncStock: "inventario-vivo.json — ajusta stock",
      },
    },
    null,
    2,
  ),
);
