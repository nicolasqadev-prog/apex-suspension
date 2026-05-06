import { listarPiezas, monedaInventario, piezaPorSlug, type PiezaInventario } from "./inventario";
import { normalizeSupabaseUrl } from "./supabase-env";

type ProductoRow = {
  slug: string;
  referencia: string;
  nombre: string;
  aplicacion: string | null;
  categoria: string | null;
  marca: string;
  precio_lista: number;
  stock_actual: number;
  activo: boolean;
};

function mapRow(r: ProductoRow): PiezaInventario {
  return {
    slug: r.slug,
    referencia: r.referencia,
    nombre: r.nombre,
    aplicacion: r.aplicacion ?? "",
    categoria: r.categoria ?? "",
    marca: r.marca,
    precioLista: Number(r.precio_lista),
    stock: Math.max(0, Math.floor(Number(r.stock_actual))),
  };
}

async function fetchProductosActivos(): Promise<ProductoRow[] | null> {
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !key) return null;

  const base = normalizeSupabaseUrl(rawUrl);
  const u = new URL(`${base}/rest/v1/productos`);
  u.searchParams.set(
    "select",
    "slug,referencia,nombre,aplicacion,categoria,marca,precio_lista,stock_actual,activo",
  );
  u.searchParams.set("activo", "eq.true");
  u.searchParams.set("order", "nombre.asc");

  const res = await fetch(u.toString(), {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as ProductoRow[];
}

export type CatalogoLoaderData = {
  piezas: PiezaInventario[];
  moneda: string;
  fuente: "supabase" | "json";
};

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
    piezas: listarPiezas(),
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
    const u = new URL(`${base}/rest/v1/productos`);
    u.searchParams.set(
      "select",
      "slug,referencia,nombre,aplicacion,categoria,marca,precio_lista,stock_actual,activo",
    );
    u.searchParams.set("slug", `eq.${slug}`);
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
    }
  }

  const pieza = piezaPorSlug(slug);
  return {
    pieza: pieza ?? null,
    moneda: monedaInventario(),
    fuente: "json",
  };
}
