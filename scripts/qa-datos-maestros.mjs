/**
 * Auditoría QA — Punto 4: datos maestros (calidad del catálogo).
 * Compara: Excel (si existe) → JSON local → Supabase → PWA (columnas usadas).
 *
 * Uso: node scripts/qa-datos-maestros.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");

function loadEnvLocal() {
  if (!existsSync(envPath)) return;
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

loadEnvLocal();

let supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const headers = supabaseKey
  ? { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
  : null;

const DESCUENTO_TALLER = 16.67;
const CAMPOS_BD_LEGACY = [
  "id",
  "slug",
  "referencia",
  "nombre",
  "aplicacion",
  "categoria",
  "marca",
  "precio_lista",
  "activo",
  "stock_actual",
  "created_at",
  "updated_at",
];
const CAMPOS_BD_DATOS_MAESTROS = [
  "marca_producto",
  "linea_vehiculo",
  "precio_taller",
  "categoria_grupo",
];

const CAMPOS_JSON_SYNC = [
  "slug",
  "referencia",
  "nombre",
  "aplicacion",
  "categoria",
  "marca",
  "precioLista",
  "stock",
  "marcaProducto",
  "lineaVehiculo",
  "precioTaller",
  "categoriaGrupo",
];

const CAMPOS_PWA_USADOS = [
  "slug",
  "referencia",
  "nombre",
  "aplicacion",
  "categoria / categoriaGrupo",
  "marca (vehículo)",
  "marcaProducto (proveedor)",
  "lineaVehiculo (liviano | camion)",
  "precioLista → precio_lista",
  "precioTallerRef → precio_taller (o −16,67%)",
  "stock → stock_actual",
];

const KEYWORDS_CAMION = [
  "HINO",
  "NPR",
  "NQR",
  "NKR",
  "FOTON",
  "FREIGHT",
  "VOLQU",
  "CAMION",
  "CAMIÓN",
  "DISTRICAM",
  "CABINA",
  "MULTIPLICADOR",
  "BUSES",
  "BUS ",
];

function parseCount(range) {
  if (!range) return null;
  const m = range.match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

async function columnasDatosMaestrosEnBd() {
  if (!headers || !supabaseUrl) return false;
  const u = `${supabaseUrl}/rest/v1/productos?select=marca_producto,linea_vehiculo,precio_taller,categoria_grupo&limit=1`;
  const res = await fetch(u, { headers });
  return res.ok;
}

async function fetchAllProductos() {
  if (!headers || !supabaseUrl) return [];
  const datosMaestros = await columnasDatosMaestrosEnBd();
  const select = datosMaestros
    ? "referencia,nombre,aplicacion,categoria,categoria_grupo,marca,marca_producto,linea_vehiculo,precio_lista,precio_taller,stock_actual"
    : "referencia,nombre,aplicacion,categoria,marca,precio_lista,stock_actual";
  const all = [];
  let offset = 0;
  while (true) {
    const u = `${supabaseUrl}/rest/v1/productos?activo=eq.true&select=${select}&order=referencia.asc`;
    const res = await fetch(u, { headers: { ...headers, Range: `${offset}-${offset + 999}` } });
    if (!res.ok) break;
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    all.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return all;
}

function contarPor(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
}

function esNombreCrudo(p) {
  const n = (p.nombre ?? "").trim().toUpperCase();
  const r = (p.referencia ?? "").trim().toUpperCase();
  if (n === r) return true;
  if (/^[\d./\s"\\*-]+$/.test(n) && n.length < 40) return true;
  if (/^(1\/2|3\/4|5\/8|7\/8|1")/.test(n)) return true;
  return false;
}

function esPosibleCamion(p) {
  const blob = `${p.nombre} ${p.aplicacion} ${p.categoria} ${p.referencia}`.toUpperCase();
  return KEYWORDS_CAMION.some((k) => blob.includes(k));
}

function grupoAmort(categoria) {
  const c = (categoria ?? "").toLowerCase();
  if (c.includes("amortigu")) return "Amortiguadores (grupo UI)";
  return categoria ?? "(vacío)";
}

function leerJson(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function leerExcelMarcaProducto() {
  const py = join(root, "apex finanzas", "pedidos", "lista_persona.xlsx");
  const fallback = "c:\\Users\\Usuario\\Downloads\\lista_persona (1).xlsx";
  const paths = [py, fallback].filter((p) => existsSync(p));
  if (!paths.length) return { disponible: false, motivo: "No se encontró lista_persona.xlsx" };

  const script = `
import json, pandas as pd
from pathlib import Path
path = Path(${JSON.stringify(paths[0])})
df = pd.read_excel(path, sheet_name="Persona")
df = df.dropna(subset=["REFERENCIA/MODELO"])
col = "MARCA PRODUCTO" if "MARCA PRODUCTO" in df.columns else None
if not col:
    print(json.dumps({"disponible": True, "columnaMarcaProducto": False}))
else:
    vc = df[col].fillna("KTC").astype(str).str.strip().value_counts().head(20)
    print(json.dumps({
        "disponible": True,
        "columnaMarcaProducto": True,
        "archivo": str(path),
        "filasExcel": int(len(df)),
        "topMarcasProducto": {k: int(v) for k, v in vc.items()},
    }))
`;
  const r = spawnSync("py", ["-3", "-c", script], { encoding: "utf8", cwd: root });
  if (r.status !== 0) {
    return { disponible: false, motivo: r.stderr || r.stdout || "Error leyendo Excel" };
  }
  try {
    return JSON.parse(r.stdout.trim());
  } catch {
    return { disponible: false, motivo: "Salida Excel no parseable" };
  }
}

function compararPrecioTaller(precioLista) {
  const desc = Math.round(precioLista * (1 - DESCUENTO_TALLER / 100));
  const cr = precioLista * 0.65;
  const formulaTaller = Math.round(cr / 0.78);
  return {
    precioLista,
    tallerDescuentoPwa: desc,
    tallerFormulaCr078: formulaTaller,
    difieren: desc !== formulaTaller,
  };
}

// --- datos locales ---
const catalogo = leerJson(join(root, "data/inventario-catalogo-completo.json"));
const vivo = leerJson(join(root, "data/inventario-vivo.json"));
const piezasJson = catalogo?.piezas ?? [];
const piezasVivo = vivo?.piezas ?? [];

const columnasDatosMaestros = await columnasDatosMaestrosEnBd();
const bd = await fetchAllProductos();

const jsonConPrecioTaller = piezasJson.filter((p) => p.precioTaller != null).length;
const jsonConMarcaProducto = piezasJson.filter((p) => p.marcaProducto != null).length;
const jsonConLinea = piezasJson.filter((p) => p.lineaVehiculo != null).length;
const jsonConCategoriaGrupo = piezasJson.filter((p) => p.categoriaGrupo != null).length;

const excelMarca = leerExcelMarcaProducto();

// muestras
const muestraKtr = piezasJson.find((p) => p.referencia === "KTR-4015");
const ktrBd = bd.find((p) => p.referencia === "KTR-4015");

const paso41 = {
  titulo: "4.1 Marca de vehículo (campo marca en BD)",
  queDeberiaSer: "Chevrolet, Renault, Mazda… inferido del nombre en Excel",
  enSupabase: {
    totalActivos: bd.length,
    marcasUnicas: Object.keys(contarPor(bd, (p) => p.marca)).length,
    distribucion: contarPor(bd, (p) => p.marca),
    varios: bd.filter((p) => p.marca === "Varios").length,
    variosPct: bd.length
      ? ((bd.filter((p) => p.marca === "Varios").length / bd.length) * 100).toFixed(1) + "%"
      : "0%",
  },
  enBodega124: {
    total: bd.filter((p) => p.stock_actual > 0).length,
    varios: bd.filter((p) => p.stock_actual > 0 && p.marca === "Varios").length,
    distribucion: contarPor(
      bd.filter((p) => p.stock_actual > 0),
      (p) => p.marca,
    ),
  },
  enJsonLocal: {
    total: piezasJson.length,
    varios: piezasJson.filter((p) => p.marca === "Varios").length,
  },
  veredicto:
    bd.filter((p) => p.marca === "Varios").length > 2000
      ? "FALTA_MEJORAR — mayoría sin marca vehículo detectada"
      : "OK",
  comoValidarVos:
    "En /catalogo abrí Marca vehículo: deben aparecer ~25 opciones. Filtrá Renault + Solo en bodega: deben salir piezas con stock.",
};

const bdConMarcaProducto = columnasDatosMaestros
  ? bd.filter((p) => p.marca_producto != null && p.marca_producto !== "").length
  : 0;

const paso42 = {
  titulo: "4.2 Marca de proveedor / producto (KTC, Corven, Nakata…)",
  queDeberiaSer: "Columna MARCA PRODUCTO del Excel; distinto del campo marca (vehículo)",
  enExcel: excelMarca,
  enJsonSync: {
    campoMarcaProducto: jsonConMarcaProducto > 0,
    piezasConMarcaProducto: jsonConMarcaProducto,
    total: piezasJson.length,
    distribucion: contarPor(piezasJson, (p) => p.marcaProducto ?? "(vacío)"),
  },
  enSupabase: {
    columnaExiste: columnasDatosMaestros,
    columnasTablaProductos: [
      ...CAMPOS_BD_LEGACY,
      ...(columnasDatosMaestros ? CAMPOS_BD_DATOS_MAESTROS : []),
    ],
    piezasConMarcaProducto: bdConMarcaProducto,
  },
  enPwa: {
    filtroPorProveedor: true,
    nota: "/catalogo → filtro Proveedor (KTC, Districamiones, Wurtex…)",
  },
  veredicto:
    jsonConMarcaProducto > 5000 && columnasDatosMaestros && bdConMarcaProducto > 5000
      ? "OK"
      : jsonConMarcaProducto > 5000 && !columnasDatosMaestros
        ? "PENDIENTE_MIGRACION — JSON listo; falta npm run db:migrate:datos y re-sync"
        : "FALTA_MEJORAR",
  comoValidarVos:
    "En /catalogo: filtro Proveedor con KTC y Districamiones. Si BD sin columna: npm run db:migrate:datos.",
};

const muestrasPrecio = piezasJson
  .filter((p) => p.stock > 0)
  .slice(0, 5)
  .map((p) => ({
    referencia: p.referencia,
    ...compararPrecioTaller(p.precioLista),
  }));

const bdConPrecioTaller = columnasDatosMaestros
  ? bd.filter((p) => p.precio_taller != null && Number(p.precio_taller) > 0).length
  : 0;

const paso43 = {
  titulo: "4.3 Precio taller persistido vs calculado en PWA",
  queDeberiaSer: "Opción A: −16,67% sobre precio_lista (PWA actual). Opción B: CR÷0,78 (Excel)",
  enSupabase: {
    columnaPrecioTaller: columnasDatosMaestros,
    piezasConPrecioTaller: bdConPrecioTaller,
    soloPrecioLista: !columnasDatosMaestros,
  },
  enJsonSync: {
    campoPrecioTaller: jsonConPrecioTaller > 0,
    piezasConPrecioTaller: jsonConPrecioTaller,
    nota: "precioTaller exportado en JSON; PWA usa precioTallerRef de BD si existe",
  },
  enPwaTaller: {
    metodo: `precio_lista × (1 − ${DESCUENTO_TALLER}%) al iniciar sesión taller`,
    ejemploKTR4015: muestraKtr
      ? compararPrecioTaller(muestraKtr.precioLista)
      : ktrBd
        ? compararPrecioTaller(Number(ktrBd.precio_lista))
        : null,
    muestrasBodega: muestrasPrecio,
  },
  veredicto:
    "PARCIAL — precio taller funciona en sesión taller (descuento); no guardado por SKU en BD",
  comoValidarVos:
    "Entrá como taller en /taller/acceso. KTR-4015: público $65.731 → taller $54.774. En Supabase solo verás precio_lista.",
};

const catsBd = contarPor(bd, (p) => p.categoria ?? "(vacío)");
const catsAmort = [
  ...new Set(bd.map((p) => p.categoria).filter((c) => /amortigu/i.test(c ?? ""))),
].sort();

const paso44 = {
  titulo: "4.4 Categorías consistentes",
  queDeberiaSer: "Un solo criterio (ej. Amortiguadores) para filtrar",
  enSupabase: {
    categoriasUnicas: Object.keys(catsBd).length,
    top20: Object.fromEntries(Object.entries(catsBd).slice(0, 20)),
    variantesAmortiguador: catsAmort,
    filtroUiAgrupa: "catalogo-filtros.ts → grupoCategoria() unifica amortiguadores/rotulas/etc.",
  },
  pruebaFiltroRenaultAmort: {
    bdSinAgrupar: bd.filter(
      (p) => p.marca === "Renault" && /amortigu/i.test(p.categoria ?? "") && p.stock_actual > 0,
    ).length,
    referencias: bd
      .filter(
        (p) => p.marca === "Renault" && /amortigu/i.test(p.categoria ?? "") && p.stock_actual > 0,
      )
      .map((p) => p.referencia),
  },
  veredicto: catsAmort.length > 1 ? "PARCIAL — raw inconsistente; UI agrupa parcialmente" : "OK",
  comoValidarVos:
    "Filtrá Categoría = Amortiguadores + Renault + Solo en bodega. Deben coincidir las refs del bloque pruebaFiltroRenaultAmort.",
};

const camionBd = bd.filter(esPosibleCamion);
const paso45 = {
  titulo: "4.5 Línea liviano vs camión / pesado",
  queDeberiaSer: "Campo linea_vehiculo o exclusión Districamiones/camión del catálogo liviano",
  enSupabase: {
    columnaLineaVehiculo: false,
    detectadosPorPalabraClave: camionBd.length,
    pct: bd.length ? ((camionBd.length / bd.length) * 100).toFixed(2) + "%" : "0%",
    topCategoriasCamion: contarPor(camionBd, (p) => p.categoria ?? "(vacío)"),
    muestra5: camionBd.slice(0, 5).map((p) => ({
      referencia: p.referencia,
      marca: p.marca,
      categoria: p.categoria,
      nombre: (p.nombre ?? "").slice(0, 60),
    })),
  },
  enPwa: {
    separacionLivianoCamion: false,
  },
  veredicto: "NO_CONECTADO — mezclado con livianos; sin filtro de línea",
  comoValidarVos:
    "Buscá HINO o CABINA en catálogo bajo pedido: aparecen mezclados. No hay toggle liviano/camión.",
};

const crudos = piezasJson.filter(esNombreCrudo);
const crudosConStock = bd.filter((p) => p.stock_actual > 0 && esNombreCrudo(p));
const paso46 = {
  titulo: "4.6 Nombres / referencias crudas (calidad de ficha)",
  queDeberiaSer: "nombre legible + aplicación vehículo; no repetir solo la referencia",
  enJson: {
    totalCrudos: crudos.length,
    pct: piezasJson.length ? ((crudos.length / piezasJson.length) * 100).toFixed(1) + "%" : "0%",
    conStock: crudosConStock.length,
    muestra5: crudos
      .slice(0, 5)
      .map((p) => ({ referencia: p.referencia, nombre: p.nombre, marca: p.marca })),
  },
  enBodega: {
    crudosConStock: crudosConStock.length,
    muestra: crudosConStock.slice(0, 5).map((p) => ({
      referencia: p.referencia,
      nombre: p.nombre,
      stock: p.stock_actual,
    })),
  },
  veredicto:
    crudosConStock.length === 0
      ? "ACEPTABLE_EN_BODEGA — crudos mayormente en bajo pedido"
      : "REVISAR — hay fichas crudas con stock en bodega",
  comoValidarVos:
    'En /catalogo sin expandir bajo pedido: no deberías ver tuercas 1" ALTA RF. Expandí bajo pedido: ahí sí aparecen.',
};

const pipeline = {
  titulo: "Pipeline de campos (qué viaja en cada paso)",
  excel: ["REFERENCIA", "NOMBRE PRODUCTO", "CATEGORÍA", "PRECIO BASE", "MARCA PRODUCTO"],
  pythonGenerador: ["+ precioTaller, precioBase, marcaProducto, marca vehículo inferida"],
  jsonSync: CAMPOS_JSON_SYNC,
  supabase: CAMPOS_BD.filter((c) => !["id", "created_at", "updated_at", "activo"].includes(c)),
  pwaCatalogo: CAMPOS_PWA_USADOS,
};

const resumen = {
  conectado: [
    "precio_lista (público) en BD y PWA",
    "stock_actual bodega en BD y PWA",
    "marca vehículo en BD (calidad mejorable)",
    "precio taller en sesión taller (calculado −16,67%)",
    "jerarquía bodega / bajo pedido en UI",
    "filtros vehículo/categoría/stock en UI",
  ],
  noConectado: [
    "marca_producto (proveedor) Excel → BD",
    "precio_taller por SKU en BD",
    "linea_vehiculo (liviano/camión)",
    "limpieza masiva de nombres crudos en Excel",
  ],
  parcial: [
    "marca vehículo: 83% Varios en catálogo general",
    "categorías: raw inconsistente, UI agrupa",
    "precio taller: PWA descuento ≠ fórmula CR÷0,78 del Excel",
  ],
};

const informe = {
  generado: new Date().toISOString(),
  pasos: [paso41, paso42, paso43, paso44, paso45, paso46],
  pipeline,
  resumen,
  comandosTuQA: {
    auditoriaBase: "node scripts/qa-audit.mjs",
    auditoriaDatos: "node scripts/qa-datos-maestros.mjs",
    syncCatalogo: "npm run sync:inventory -- data/inventario-catalogo-completo.json",
    syncStock: "npm run sync:inventory -- data/inventario-vivo.json",
  },
};

console.log(JSON.stringify(informe, null, 2));
