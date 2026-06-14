import {
  listarPiezas,
  monedaInventario,
  piezaPorSlug,
  type LineaVehiculo,
  type PiezaInventario,
} from "./inventario";
import { completarPieza } from "./inventario-normalizar";
import { imagenUrlParaPieza } from "./catalogo-imagenes";
import { normalizeSupabaseUrl } from "./supabase-env";

type ProductoRow = {
  slug: string;
  referencia: string;
  nombre: string;
  aplicacion: string | null;
  categoria: string | null;
  categoria_grupo: string | null;
  marca: string;
  marca_producto: string | null;
  linea_vehiculo: string | null;
  precio_lista: number;
  precio_taller: number | null;
  stock_actual: number;
  activo: boolean;
};

const SELECT_LEGACY =
  "slug,referencia,nombre,aplicacion,categoria,marca,precio_lista,stock_actual,activo";
const SELECT_DATOS_MAESTROS = "categoria_grupo,marca_producto,linea_vehiculo,precio_taller";
const SELECT_CAMPOS = `${SELECT_LEGACY},${SELECT_DATOS_MAESTROS}`;

let selectCamposCache: string | null = null;

async function resolverSelectCampos(cfg: {
  base: string;
  headers: Record<string, string>;
}): Promise<string> {
  if (selectCamposCache) return selectCamposCache;
  const probe = new URL(`${cfg.base}/rest/v1/productos`);
  probe.searchParams.set("select", SELECT_DATOS_MAESTROS);
  probe.searchParams.set("limit", "1");
  const res = await fetch(probe.toString(), { headers: cfg.headers });
  selectCamposCache = res.ok ? SELECT_CAMPOS : SELECT_LEGACY;
  return selectCamposCache;
}

function sinPrecioTallerRef(pieza: PiezaInventario): PiezaInventario {
  const { precioTallerRef: _omit, ...rest } = pieza;
  return rest;
}

function mapRow(r: ProductoRow): PiezaInventario {
  const pieza = completarPieza({
    slug: r.slug,
    referencia: r.referencia,
    nombre: r.nombre,
    aplicacion: r.aplicacion ?? "",
    categoria: r.categoria ?? "",
    categoriaGrupo: r.categoria_grupo ?? undefined,
    marca: r.marca,
    marcaProducto: r.marca_producto ?? undefined,
    lineaVehiculo: (r.linea_vehiculo as LineaVehiculo | null) ?? undefined,
    precioLista: Number(r.precio_lista),
    precioTallerRef: r.precio_taller != null ? Number(r.precio_taller) : undefined,
    stock: Math.max(0, Math.floor(Number(r.stock_actual))),
  });
  const imagenUrl = imagenUrlParaPieza(pieza);
  return imagenUrl ? { ...pieza, imagenUrl } : pieza;
}

const SUPABASE_PAGE_SIZE = 1000;

async function supabaseFetchHeaders(): Promise<{
  base: string;
  headers: Record<string, string>;
} | null> {
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !key) return null;
  return {
    base: normalizeSupabaseUrl(rawUrl),
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  };
}

/** PostgREST devuelve máx. 1000 filas por petición; paginamos con Range. */
async function fetchProductosActivos(): Promise<ProductoRow[] | null> {
  const cfg = await supabaseFetchHeaders();
  if (!cfg) return null;

  const select = await resolverSelectCampos(cfg);
  const all: ProductoRow[] = [];
  let offset = 0;

  while (true) {
    const u = new URL(`${cfg.base}/rest/v1/productos`);
    u.searchParams.set("select", select);
    u.searchParams.set("activo", "eq.true");
    u.searchParams.set("order", "stock_actual.desc,nombre.asc");

    const end = offset + SUPABASE_PAGE_SIZE - 1;
    const res = await fetch(u.toString(), {
      headers: { ...cfg.headers, Range: `${offset}-${end}` },
    });
    if (!res.ok) return all.length > 0 ? all : null;

    const page = (await res.json()) as ProductoRow[];
    all.push(...page);
    if (page.length < SUPABASE_PAGE_SIZE) break;
    offset += SUPABASE_PAGE_SIZE;
  }

  return all;
}

export type CatalogoLoaderData = {
  piezas: PiezaInventario[];
  moneda: string;
  fuente: "supabase" | "json";
};

/** Catálogo público: sin precio de referencia taller (solo precio lista). */
export async function loadCatalogoPublico(): Promise<CatalogoLoaderData> {
  const data = await loadCatalogo();
  return { ...data, piezas: data.piezas.map(sinPrecioTallerRef) };
}

/** Detalle público por slug: sin precio taller. */
export async function loadPiezaPublicaBySlug(slug: string): Promise<PiezaLoaderData> {
  const data = await loadPiezaBySlug(slug);
  if (!data.pieza) return data;
  return { ...data, pieza: sinPrecioTallerRef(data.pieza) };
}

/** Catálogo: Supabase si hay filas; si no, JSON local. */
export async function loadCatalogo(): Promise<CatalogoLoaderData> {
  const rows = await fetchProductosActivos();
  if (rows && rows.length > 0) {
    return {
      piezas: rows.map(mapRow),
      moneda: "COP",
      fuente: "supabase",
    };
  }
  return {
    piezas: listarPiezas().map((p) => {
      const imagenUrl = imagenUrlParaPieza(p);
      return imagenUrl ? { ...p, imagenUrl } : p;
    }),
    moneda: monedaInventario(),
    fuente: "json",
  };
}

export type PiezaLoaderData = {
  pieza: PiezaInventario | null;
  moneda: string;
  fuente: "supabase" | "json";
};

/** Detalle por slug: Supabase primero; si no hay fila, JSON local. */
export async function loadPiezaBySlug(slug: string): Promise<PiezaLoaderData> {
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (rawUrl && key) {
    const base = normalizeSupabaseUrl(rawUrl);
    const cfg = { base, headers: { apikey: key, Authorization: `Bearer ${key}` } };
    const select = await resolverSelectCampos(cfg);
    const u = new URL(`${base}/rest/v1/productos`);
    u.searchParams.set("select", select);
    u.searchParams.set("slug", `eq.${slug}`);
    u.searchParams.set("activo", "eq.true");
    u.searchParams.set("limit", "1");

    const res = await fetch(u.toString(), {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (res.ok) {
      const rows = (await res.json()) as ProductoRow[];
      if (rows[0]) {
        return { pieza: mapRow(rows[0]), moneda: "COP", fuente: "supabase" };
      }
      return { pieza: null, moneda: "COP", fuente: "supabase" };
    }
  }

  const pieza = piezaPorSlug(slug);
  return {
    pieza: pieza ?? null,
    moneda: monedaInventario(),
    fuente: "json",
  };
}
