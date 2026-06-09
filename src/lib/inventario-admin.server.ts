import { listarPiezas } from "./inventario";
import { loadCatalogo } from "./inventario.server";
import { normalizeSupabaseUrl } from "./supabase-env";

type SupabaseEnv = {
  url: string;
  serviceRoleKey: string;
};

export type ProductoAdmin = {
  id: string;
  slug: string;
  referencia: string;
  nombre: string;
  marca: string;
  precioLista: number;
  stockActual: number;
  activo: boolean;
};

type ProductoRow = {
  id: string;
  slug: string;
  referencia: string;
  nombre: string;
  marca: string;
  precio_lista: number;
  stock_actual: number;
  activo: boolean;
};

function getSupabaseEnv(): SupabaseEnv | null {
  const rawUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !serviceRoleKey) return null;
  return { url: normalizeSupabaseUrl(rawUrl), serviceRoleKey };
}

function headers(env: SupabaseEnv, extra?: Record<string, string>) {
  return {
    apikey: env.serviceRoleKey,
    Authorization: `Bearer ${env.serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function mapProducto(r: ProductoRow): ProductoAdmin {
  return {
    id: r.id,
    slug: r.slug,
    referencia: r.referencia,
    nombre: r.nombre,
    marca: r.marca,
    precioLista: Number(r.precio_lista),
    stockActual: Math.max(0, Math.floor(Number(r.stock_actual))),
    activo: Boolean(r.activo),
  };
}

export async function getResumenCatalogoAdmin(): Promise<{
  fuente: "supabase" | "json";
  totalProductos: number;
  conStock: number;
  sinStock: number;
}> {
  const catalogo = await loadCatalogo();
  const conStock = catalogo.piezas.filter((p) => p.stock > 0).length;
  return {
    fuente: catalogo.fuente,
    totalProductos: catalogo.piezas.length,
    conStock,
    sinStock: catalogo.piezas.length - conStock,
  };
}

export async function buscarProductosAdmin(
  query: string,
  limit = 25,
): Promise<{ ok: true; productos: ProductoAdmin[] } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const q = query.trim();
  const url = new URL(`${env.url}/rest/v1/productos`);
  url.searchParams.set(
    "select",
    "id,slug,referencia,nombre,marca,precio_lista,stock_actual,activo",
  );
  url.searchParams.set("order", "nombre.asc");
  url.searchParams.set("limit", String(Math.min(50, Math.max(1, limit))));

  if (q.length > 0) {
    const pattern = encodeURIComponent(`%${q.replace(/%/g, "")}%`);
    url.searchParams.set(
      "or",
      `(referencia.ilike.${pattern},nombre.ilike.${pattern},slug.ilike.${pattern})`,
    );
  } else {
    url.searchParams.set("activo", "eq.true");
  }

  const res = await fetch(url.toString(), { headers: headers(env) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Búsqueda falló (${res.status}) ${text}`.slice(0, 180) };
  }

  const rows = (await res.json()) as ProductoRow[];
  return { ok: true, productos: rows.map(mapProducto) };
}

export async function getProductoIdBySlug(slug: string): Promise<string | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const url = new URL(`${env.url}/rest/v1/productos`);
  url.searchParams.set("select", "id");
  url.searchParams.set("slug", `eq.${slug}`);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), { headers: headers(env) });
  if (!res.ok) return null;
  const rows = (await res.json()) as { id: string }[];
  return rows[0]?.id ?? null;
}

export async function registrarMovimientoStock(input: {
  productoId: string;
  delta: number;
  motivo: string;
}): Promise<
  { ok: true; stockActual: number } | { ok: false; reason: string }
> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const delta = Math.trunc(input.delta);
  if (delta === 0) return { ok: false, reason: "El movimiento no puede ser cero" };

  const motivo = input.motivo.trim().slice(0, 200);
  if (!motivo) return { ok: false, reason: "Indica un motivo para el movimiento" };

  const prodUrl = new URL(`${env.url}/rest/v1/productos`);
  prodUrl.searchParams.set("select", "id,stock_actual");
  prodUrl.searchParams.set("id", `eq.${input.productoId}`);
  prodUrl.searchParams.set("limit", "1");

  const prodRes = await fetch(prodUrl.toString(), { headers: headers(env) });
  if (!prodRes.ok) return { ok: false, reason: "No se pudo leer el producto" };
  const prodRows = (await prodRes.json()) as { id: string; stock_actual: number }[];
  const prod = prodRows[0];
  if (!prod) return { ok: false, reason: "Producto no encontrado" };

  const nuevo = prod.stock_actual + delta;
  if (nuevo < 0) {
    return {
      ok: false,
      reason: `Stock insuficiente (actual: ${prod.stock_actual}, movimiento: ${delta})`,
    };
  }

  const movRes = await fetch(`${env.url}/rest/v1/stock_movimientos`, {
    method: "POST",
    headers: headers(env, { Prefer: "return=minimal" }),
    body: JSON.stringify({
      producto_id: input.productoId,
      delta,
      motivo,
    }),
  });

  if (!movRes.ok) {
    const text = await movRes.text().catch(() => "");
    return { ok: false, reason: `Movimiento falló (${movRes.status}) ${text}`.slice(0, 200) };
  }

  return { ok: true, stockActual: nuevo };
}

/** Fallback cuando no hay Supabase: búsqueda en JSON local (solo lectura). */
export function buscarProductosJsonLocal(query: string, limit = 25): ProductoAdmin[] {
  const q = query.trim().toLowerCase();
  let list = listarPiezas();
  if (q) {
    list = list.filter((p) => {
      const blob = `${p.referencia} ${p.nombre} ${p.slug} ${p.marca}`.toLowerCase();
      return blob.includes(q);
    });
  }
  return list.slice(0, limit).map((p) => ({
    id: p.slug,
    slug: p.slug,
    referencia: p.referencia,
    nombre: p.nombre,
    marca: p.marca,
    precioLista: p.precioLista,
    stockActual: p.stock,
    activo: true,
  }));
}
