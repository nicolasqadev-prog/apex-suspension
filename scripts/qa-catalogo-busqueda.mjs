/**
 * QA búsqueda catálogo PWA (lógica flexible vs Supabase).
 * Uso: node scripts/qa-catalogo-busqueda.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "./parse-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Dynamic import after env
const env = loadEnvLocal(join(root, ".env.local"));
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

const { coincideBusquedaPieza } = await import("../src/lib/catalogo-busqueda.ts");
const { completarPieza } = await import("../src/lib/inventario-normalizar.ts");

const url = env.SUPABASE_URL?.replace(/\/$/, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

async function fetchPiezasSample() {
  if (!url || !key) return [];
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  const samples = [];
  const refs = ["KSA-RE028", "KSA-HY016", "7150441313"];
  for (const ref of refs) {
    const u = new URL(`${url}/rest/v1/productos`);
    u.searchParams.set("select", "slug,referencia,nombre,aplicacion,categoria,categoria_grupo,marca,marca_producto,linea_vehiculo,precio_lista,precio_taller,stock_actual");
    u.searchParams.set("referencia", `eq.${ref}`);
    u.searchParams.set("activo", "eq.true");
    u.searchParams.set("limit", "1");
    const res = await fetch(u.toString(), { headers: h });
    if (!res.ok) continue;
    const rows = await res.json();
    if (rows[0]) samples.push(rows[0]);
  }
  return samples.map((r) =>
    completarPieza({
      slug: r.slug,
      referencia: r.referencia,
      nombre: r.nombre,
      aplicacion: r.aplicacion ?? "",
      categoria: r.categoria ?? "",
      categoriaGrupo: r.categoria_grupo ?? undefined,
      marca: r.marca,
      marcaProducto: r.marca_producto ?? undefined,
      lineaVehiculo: r.linea_vehiculo ?? undefined,
      precioLista: Number(r.precio_lista),
      stock: Math.max(0, Math.floor(Number(r.stock_actual))),
    }),
  );
}

const piezas = await fetchPiezasSample();
const kwid = piezas.find((p) => p.referencia.includes("RE028"));
const rio = piezas.find((p) => p.referencia.includes("HY016"));
const megane = piezas.find((p) => p.referencia.includes("7150441313"));

const casos = [
  { pieza: kwid, q: "KSA RE028", esperado: true, nombre: "ref sin guión" },
  { pieza: kwid, q: "ksare028", esperado: true, nombre: "ref compacta" },
  { pieza: kwid, q: "amortiguador kwid", esperado: true, nombre: "pieza + vehículo" },
  { pieza: kwid, q: "renault kwid delantero", esperado: true, nombre: "marca modelo posición" },
  { pieza: rio, q: "rio xcite trasero", esperado: true, nombre: "rio xcite" },
  { pieza: megane, q: "megane amortiguador", esperado: true, nombre: "megane bajo pedido" },
  { pieza: kwid, q: "toyota corolla", esperado: false, nombre: "vehículo incorrecto" },
];

// Caso BT-50 sin guión (Yokomitsu 7168251306)
const bt50 = {
  referencia: "7168251306",
  nombre: "AMORTIGUADOR TRASERO RH/LH GAS",
  aplicacion: "AMORTIGUADOR TRASERO RH/LH GAS · MAZDA BT-50 2.2/2.6/2.5D 2WD/RANGER 2006-2015",
  marca: "Mazda",
  marcaProducto: "Yokomitsu",
  categoria: "Amortiguadores",
  stock: 0,
};
casos.push(
  { pieza: bt50, q: "bt50", esperado: true, nombre: "bt50 sin guión" },
  { pieza: bt50, q: "amortiguador bt50", esperado: true, nombre: "amortiguador bt50" },
  { pieza: bt50, q: "mazda bt50 amortiguador trasero", esperado: true, nombre: "mazda bt50 amort trasero" },
);

let ok = 0;
let fail = 0;
console.log("=== QA búsqueda catálogo ===\n");
for (const c of casos) {
  if (!c.pieza) {
    console.log(`⊘ SKIP ${c.nombre} (sin pieza de muestra en Supabase)`);
    continue;
  }
  const res = coincideBusquedaPieza(c.pieza, c.q);
  const pass = res === c.esperado;
  if (pass) {
    ok++;
    console.log(`✓ ${c.nombre}: "${c.q}" → ${res}`);
  } else {
    fail++;
    console.log(`✗ ${c.nombre}: "${c.q}" → ${res} (esperado ${c.esperado}) ref=${c.pieza.referencia}`);
  }
}
console.log(`\n${ok} OK, ${fail} fallos`);
process.exit(fail > 0 ? 1 : 0);
