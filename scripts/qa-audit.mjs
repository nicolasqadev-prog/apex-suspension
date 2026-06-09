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

const ejSlugs = new Set(ejemplo.piezas.map((p) => p.slug));
const catByRef = new Map(catalogo.piezas.map((p) => [p.referencia, p]));

async function rest(path, opts = {}) {
  const res = await fetch(`${url}/rest/v1${path}`, { headers: { ...headers, ...opts.headers }, ...opts });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text, range: res.headers.get("content-range") };
}

const total = await rest("/productos?select=id&limit=1", { headers: { Prefer: "count=exact" } });
const conStock = await rest("/productos?stock_actual=gt.0&select=referencia,stock_actual&limit=1", {
  headers: { Prefer: "count=exact" },
});
const ktr = await rest(
  "/productos?referencia=eq.KTR-4015&select=referencia,precio_lista,stock_actual,marca,categoria",
);
const ejInDb = await rest(
  `/productos?slug=in.(${[...ejSlugs].map((s) => `"${s}"`).join(",")})&select=slug,referencia,stock_actual`,
);
const marcas = await rest("/productos?select=marca&limit=1000");
const talleres = await rest(
  "/talleres_fidelizados?select=whatsapp,nombre_taller,descuento_porcentaje,activo,publicado",
);

const marcaCounts = {};
if (marcas.ok) {
  for (const r of JSON.parse(marcas.text)) {
    marcaCounts[r.marca] = (marcaCounts[r.marca] || 0) + 1;
  }
}

const vivoStock = vivo.piezas.filter((p) => p.stock > 0).length;
const catStock = catalogo.piezas.filter((p) => p.stock > 0).length;

// Price coherence KTR-4015
const catKtr = catByRef.get("KTR-4015");
const descuento = 16.67;
const precioTallerCalc = catKtr
  ? Math.round(catKtr.precioLista * (1 - descuento / 100))
  : null;

console.log(
  JSON.stringify(
    {
      supabase: {
        totalProductos: total.range,
        conStock: conStock.range,
        ktr4015: ktr.ok ? JSON.parse(ktr.text)[0] : ktr.text,
        productosEjemploEnDb: ejInDb.ok ? JSON.parse(ejInDb.text).length : 0,
        ejemploDetalle: ejInDb.ok ? JSON.parse(ejInDb.text).slice(0, 3) : null,
        topMarcas: Object.entries(marcaCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8),
        talleres: talleres.ok ? JSON.parse(talleres.text) : null,
      },
      json: {
        catalogoPiezas: catalogo.piezas.length,
        catalogoConStock: catStock,
        vivoPiezas: vivo.piezas.length,
        vivoConStock: vivoStock,
        ejemploPiezas: ejemplo.piezas.length,
        ktr4015Catalogo: catKtr
          ? { precioLista: catKtr.precioLista, stock: catKtr.stock, marca: catKtr.marca }
          : null,
        precioTallerEsperado16_67: precioTallerCalc,
      },
      checks: {
        ktrPrecioOk: ktr.ok && JSON.parse(ktr.text)[0]?.precio_lista === catKtr?.precioLista,
        ejemploMezcladoEnDb: ejInDb.ok && JSON.parse(ejInDb.text).length > 0,
      },
    },
    null,
    2,
  ),
);
