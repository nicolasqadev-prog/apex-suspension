/**
 * Guardrails anti-regresión catálogo (Worker 1102 / CPU).
 * Uso: node scripts/qa-catalogo-guards.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const { modelosVehiculoOpciones } = await import("../src/lib/catalogo-vehiculo.ts");
const { filtrarPiezas, ordenarPiezas, ordenarBajoPedido } = await import(
  "../src/lib/catalogo-filtros.ts"
);

let fail = 0;
function ok(msg) {
  console.log(`✓ ${msg}`);
}
function bad(msg) {
  fail++;
  console.log(`✗ ${msg}`);
}

console.log("=== QA guardrails catálogo ===\n");

// 1) Código: no volver a escanear miles de piezas para opciones de modelo
const catalogoTsx = readFileSync(join(root, "src/routes/catalogo.tsx"), "utf8");
if (/modelosVehiculoOpciones\s*\(\s*piezas/i.test(catalogoTsx)) {
  bad("catalogo.tsx pasa el array de piezas a modelosVehiculoOpciones (riesgo Worker 1102)");
} else {
  ok("catalogo.tsx no escanea piezas para el dropdown de modelo");
}

const vehiculoTs = readFileSync(join(root, "src/lib/catalogo-vehiculo.ts"), "utf8");
if (/for\s*\(\s*const\s+p\s+of\s+piezas/i.test(vehiculoTs)) {
  bad("catalogo-vehiculo.ts itera piezas en modelosVehiculoOpciones");
} else {
  ok("modelosVehiculoOpciones es lista estática (sin loop de piezas)");
}

// 2) Presupuesto CPU: filtrar/ordenar catálogo simulado debe ser rápido
function piezaMock(i) {
  const modelos = ["kwid", "optra", "megane ii", "bt50", "rio"];
  const m = modelos[i % modelos.length];
  return {
    slug: `p-${i}`,
    referencia: `REF-${i}`,
    nombre: `Amortiguador ${m}`,
    aplicacion: `Renault ${m} delantero`,
    categoria: "Amortiguadores",
    marca: "Renault",
    marcaProducto: "KTC",
    precioLista: 100000 + i,
    stock: i % 3 === 0 ? 2 : 0,
  };
}

const N = 10_000;
const piezas = Array.from({ length: N }, (_, i) => piezaMock(i));
const conStock = piezas.filter((p) => p.stock > 0);
const sinStock = piezas.filter((p) => p.stock <= 0);

const t0 = performance.now();
modelosVehiculoOpciones("Renault");
modelosVehiculoOpciones();
const tModelos = performance.now() - t0;
if (tModelos > 50) bad(`modelosVehiculoOpciones tardó ${tModelos.toFixed(1)}ms (máx 50ms)`);
else ok(`modelosVehiculoOpciones ${tModelos.toFixed(2)}ms (<50ms)`);

const filtros = {
  q: "",
  marcaVehiculo: "",
  modeloVehiculo: "",
  marcaProducto: "",
  categoria: "",
  lineaVehiculo: "todos",
  stockFiltro: "todos",
};

const t1 = performance.now();
const bodega = ordenarPiezas(filtrarPiezas(conStock, filtros), "stock-desc", "", (p) => p.precioLista);
const bajo = ordenarBajoPedido(
  filtrarPiezas(sinStock, filtros),
  "stock-desc",
  "",
  (p) => p.precioLista,
);
const tCatalogo = performance.now() - t1;
if (tCatalogo > 2500) bad(`filtrar+ordenar ${N} piezas tardó ${tCatalogo.toFixed(0)}ms (máx 2500ms)`);
else ok(`filtrar+ordenar ${N} piezas ${tCatalogo.toFixed(0)}ms (<2500ms)`);

if (bodega.length === 0 || bajo.length === 0) bad("mock catálogo vacío tras filtrar");
else ok(`mock catálogo bodega=${bodega.length} bajo=${bajo.length}`);

console.log(`\n${fail === 0 ? "GUARDS OK" : `${fail} FALLO(S)`}`);
process.exit(fail > 0 ? 1 : 0);
