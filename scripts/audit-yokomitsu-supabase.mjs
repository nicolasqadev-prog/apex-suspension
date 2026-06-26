/**
 * Auditoría Yokomitsu Excel vs Supabase.
 * Uso: node scripts/audit-yokomitsu-supabase.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { loadEnvLocal } from "./parse-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnvLocal(join(root, ".env.local"));
for (const [k, v] of Object.entries(env)) {
  if (!process.env[k]) process.env[k] = v;
}

const excelPath = join(root, "apex finanzas", "YOKOMITSU_Actualizado_v2.xlsx");
const url = env.SUPABASE_URL?.replace(/\/$/, "").replace(/\/rest\/v1\/?$/i, "");
const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!existsSync(excelPath)) {
  console.error("No se encontró:", excelPath);
  process.exit(1);
}
if (!url || !key) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const py = `
import json, sys
import pandas as pd
path = sys.argv[1]
df = pd.read_excel(path, sheet_name=0, header=0)
df.columns = [str(c).strip().upper() for c in df.columns]
codigo_col = next((c for c in df.columns if "CODIGO" in c), df.columns[0])
marca_col = next((c for c in df.columns if "MARCA INT" in c or c == "MARCA INT"), None)
precio_col = next((c for c in df.columns if "PRECIO" in c and "TALLER" not in c and "PUBLIC" not in c and "COSTO" not in c), None)
desc_col = next((c for c in df.columns if "DESCRIPCION" in c), None)
modelo_col = next((c for c in df.columns if "MODELO" in c), None)
linea_col = next((c for c in df.columns if "LINEA" in c), None)

rows = []
for _, r in df.iterrows():
    cod = str(r.get(codigo_col, "")).strip()
    if not cod or cod.lower() == "nan" or cod.upper() == "CODIGO":
        continue
    marca_int = str(r.get(marca_col, "")).strip().upper() if marca_col else ""
    if marca_int and marca_int not in ("YOKOMITSU", "NAN", ""):
        continue
    precio = r.get(precio_col) if precio_col else None
    try:
        precio = int(float(precio)) if precio == precio else None
    except Exception:
        precio = None
    rows.append({
        "referencia": cod,
        "descripcion": str(r.get(desc_col, "")).strip() if desc_col else "",
        "modelo": str(r.get(modelo_col, "")).strip() if modelo_col else "",
        "linea": str(r.get(linea_col, "")).strip() if linea_col else "",
        "precioExcel": precio,
    })
print(json.dumps(rows, ensure_ascii=False))
`;

const pyRes = spawnSync("python", ["-c", py, excelPath], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
if (pyRes.status !== 0) {
  console.error("Error leyendo Excel:", pyRes.stderr);
  process.exit(1);
}

const excelRows = JSON.parse(pyRes.stdout);
const excelByRef = new Map(excelRows.map((r) => [r.referencia, r]));

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function fetchAllYokomitsu() {
  const all = [];
  let offset = 0;
  while (true) {
    const u = new URL(`${url}/rest/v1/productos`);
    u.searchParams.set(
      "select",
      "referencia,nombre,aplicacion,precio_lista,stock_actual,activo,marca_producto",
    );
    u.searchParams.set("marca_producto", "ilike.Yokomitsu");
    u.searchParams.set("order", "referencia.asc");
    const res = await fetch(u.toString(), {
      headers: { ...headers, Range: `${offset}-${offset + 999}` },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
    const page = await res.json();
    all.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return all;
}

async function fetchRef(ref) {
  const u = `${url}/rest/v1/productos?referencia=eq.${encodeURIComponent(ref)}&select=referencia,nombre,precio_lista,stock_actual,activo,marca_producto&limit=1`;
  const res = await fetch(u, { headers });
  const rows = await res.json();
  return rows[0] ?? null;
}

const supabaseYoko = await fetchAllYokomitsu();
const supabaseByRef = new Map(supabaseYoko.map((r) => [r.referencia, r]));

const faltanEnSupabase = [];
const inactivosEnSupabase = [];
const precioDivergente = [];

for (const [ref, ex] of excelByRef) {
  const db = supabaseByRef.get(ref);
  if (!db) {
    faltanEnSupabase.push(ex);
    continue;
  }
  if (!db.activo) inactivosEnSupabase.push({ referencia: ref, nombre: db.nombre });
  if (ex.precioExcel != null && db.precio_lista != null) {
    const diff = Math.abs(Number(db.precio_lista) - ex.precioExcel);
    if (diff > 500) {
      precioDivergente.push({
        referencia: ref,
        precioExcel: ex.precioExcel,
        precioBd: db.precio_lista,
        diff,
      });
    }
  }
}

const soloEnSupabase = supabaseYoko
  .filter((r) => !excelByRef.has(r.referencia))
  .map((r) => ({ referencia: r.referencia, nombre: r.nombre, activo: r.activo }));

const caso716 = await fetchRef("7168251306");
const bt50Amort = supabaseYoko.filter(
  (r) =>
    r.activo &&
    /amort/i.test(`${r.nombre} ${r.aplicacion}`) &&
    /bt.?50|ranger/i.test(`${r.nombre} ${r.aplicacion}`),
);

const report = {
  fecha: new Date().toISOString(),
  excel: {
    archivo: "apex finanzas/YOKOMITSU_Actualizado_v2.xlsx",
    filasYokomitsu: excelRows.length,
  },
  supabase: {
    yokomitsuTotal: supabaseYoko.length,
    yokomitsuActivos: supabaseYoko.filter((r) => r.activo).length,
    productosActivosTotales: null,
  },
  cobertura: {
    enExcelYEnBd: excelRows.length - faltanEnSupabase.length,
    faltanEnSupabase: faltanEnSupabase.length,
    pctCobertura: Math.round(((excelRows.length - faltanEnSupabase.length) / excelRows.length) * 1000) / 10,
    inactivosEnSupabase: inactivosEnSupabase.length,
    soloEnSupabase: soloEnSupabase.length,
    precioDivergente: precioDivergente.length,
  },
  caso7168251306: caso716,
  bt50AmortiguadoresYokomitsu: bt50Amort.map((r) => ({
    referencia: r.referencia,
    nombre: r.nombre,
    stock: r.stock_actual,
    precio: r.precio_lista,
  })),
  muestras: {
    faltanEnSupabase: faltanEnSupabase.slice(0, 25),
    precioDivergente: precioDivergente.slice(0, 15),
    soloEnSupabase: soloEnSupabase.slice(0, 15),
  },
};

const totalRes = await fetch(`${url}/rest/v1/productos?activo=eq.true&select=id&limit=1`, {
  headers: { ...headers, Prefer: "count=exact" },
});
const range = totalRes.headers.get("content-range");
const m = range?.match(/\/(\d+)$/);
report.supabase.productosActivosTotales = m ? Number(m[1]) : null;

const outPath = join(root, "data", "audit-yokomitsu-report.json");
writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

console.log("=== Auditoría Yokomitsu vs Supabase ===\n");
console.log(`Excel Yokomitsu:     ${report.excel.filasYokomitsu} referencias`);
console.log(`Supabase Yokomitsu:  ${report.supabase.yokomitsuActivos} activos / ${report.supabase.yokomitsuTotal} total`);
console.log(`Cobertura:           ${report.cobertura.pctCobertura}% (${report.cobertura.enExcelYEnBd}/${report.excel.filasYokomitsu})`);
console.log(`Faltan en Supabase:  ${report.cobertura.faltanEnSupabase}`);
console.log(`Inactivos en BD:     ${report.cobertura.inactivosEnSupabase}`);
console.log(`Precio divergente:   ${report.cobertura.precioDivergente} (umbral >$500)`);
console.log(`Solo en Supabase:    ${report.cobertura.soloEnSupabase}`);
console.log(`\n7168251306 en BD:   ${caso716 ? "SÍ" : "NO"}`, caso716 ? `(stock ${caso716.stock_actual}, $${caso716.precio_lista})` : "");
console.log(`BT-50 amort Yokomitsu en BD: ${bt50Amort.length}`);
for (const r of bt50Amort.slice(0, 5)) {
  console.log(`  · ${r.referencia} — ${r.nombre.slice(0, 50)}`);
}
if (faltanEnSupabase.length) {
  console.log("\nPrimeras refs en Excel que FALTAN en Supabase:");
  for (const r of faltanEnSupabase.slice(0, 10)) {
    console.log(`  · ${r.referencia} — ${r.descripcion.slice(0, 60)}`);
  }
}
console.log(`\nReporte completo: ${outPath}`);

const veredicto =
  report.cobertura.pctCobertura >= 95 && report.cobertura.faltanEnSupabase < 50
    ? "OK"
    : report.cobertura.pctCobertura >= 85
      ? "ATENCION"
      : "CRITICO";
console.log(`\nVeredicto cobertura Yokomitsu: ${veredicto}`);
process.exit(veredicto === "CRITICO" ? 1 : 0);
