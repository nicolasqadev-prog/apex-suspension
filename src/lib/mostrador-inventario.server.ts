import { metaMarcaProveedor, normalizarMarcaProveedor } from "./marcas-proveedor";
import type { DisponibilidadMostrador } from "./mostrador";
import { normalizeSupabaseUrl } from "./supabase-env";

export type { DisponibilidadMostrador };

export type ProductoMostrador = {
  slug: string;
  referencia: string;
  nombre: string;
  aplicacion: string;
  categoria: string;
  marcaVehiculo: string;
  marcaProducto: string;
  precioPublico: number;
  stock: number;
  disponibilidad: DisponibilidadMostrador;
};

type ProductoRow = {
  slug: string;
  referencia: string;
  nombre: string;
  aplicacion: string | null;
  categoria: string | null;
  marca: string;
  marca_producto: string | null;
  precio_lista: number;
  stock_actual: number;
};

const MARCAS_VENDEMOS = new Set([
  "KTC",
  "STP",
  "WURTEX",
  "YOKOMITSU",
  "CTR",
  "MOBIS",
  "TOYAMA",
  "DMB",
]);

const FUERA_ALCANCE = [
  /\b(motor|culata|pist[oó]n|biela|correa\s+de\s+distribuci[oó]n|empaque\s+de\s+culata)\b/i,
  /\b(transmisi[oó]n|caja\s+de\s+cambios|clutch\s+completo|embrague\s+completo)\b/i,
  /\b(radio|pantalla\s+multimedia|bater[ií]a\s+de\s+carro|alternador|arranque)\b/i,
  /\b(llanta|neum[aá]tico|rin\s+\d{2})\b/i,
  /\b(aire\s+acondicionado|compresor\s+a\/?c)\b/i,
];

const BAJO_ENCARGO = [
  /\b(freno|frenos|frena|pastilla|pastillas|disco|discos|caliper|balata)\b/i,
  /\b(embrague|disco\s+de\s+embrague)\b/i,
];

const EN_ALCANCE = [
  /\b(amortiguador|rotula|r[oó]tula|terminal|bieleta|bujes?|tijera|brazo|suspensi[oó]n|direcci[oó]n)\b/i,
  /\b(kit\s+de\s+suspensi[oó]n|barra\s+estabilizadora)\b/i,
];

const REF_PATTERN = /\b[A-Z]{2,5}[- ]?\d{3,6}[A-Z0-9]*\b/gi;

function getSupabaseEnv() {
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !key) return null;
  return { url: normalizeSupabaseUrl(rawUrl), key };
}

function headers(env: { key: string }) {
  return { apikey: env.key, Authorization: `Bearer ${env.key}` };
}

function mapRow(r: ProductoRow): ProductoMostrador {
  const stock = Math.max(0, Math.floor(Number(r.stock_actual ?? 0)));
  const marcaProducto = normalizarMarcaProveedor(r.marca_producto);
  return {
    slug: r.slug,
    referencia: r.referencia,
    nombre: r.nombre,
    aplicacion: r.aplicacion ?? "",
    categoria: r.categoria ?? "",
    marcaVehiculo: r.marca,
    marcaProducto,
    precioPublico: Math.round(Number(r.precio_lista)),
    stock,
    disponibilidad: stock > 0 ? "bodega" : "bajo_pedido",
  };
}

export type AlcanceMensaje = "en_alcance" | "bajo_encargo" | "fuera_alcance";

export function detectarAlcanceMensaje(texto: string): AlcanceMensaje {
  const t = texto.trim();
  if (!t) return "en_alcance";
  if (FUERA_ALCANCE.some((rx) => rx.test(t))) return "fuera_alcance";
  if (BAJO_ENCARGO.some((rx) => rx.test(t))) return "bajo_encargo";
  if (EN_ALCANCE.some((rx) => rx.test(t))) return "en_alcance";
  return "en_alcance";
}

export function extraerReferencias(texto: string): string[] {
  const found = texto.match(REF_PATTERN) ?? [];
  return [...new Set(found.map((r) => r.replace(/\s+/g, "-").toUpperCase()))];
}

export function extraerMarcasMencionadas(texto: string): string[] {
  const t = texto.toUpperCase();
  const marcas: string[] = [];
  for (const m of MARCAS_VENDEMOS) {
    if (t.includes(m)) marcas.push(m);
  }
  const competidoras = ["MOOG", "CORVEN", "NAKATA", "SABO", "MONROE", "BOSCH", "MANN", "FRAM"];
  for (const c of competidoras) {
    if (t.includes(c)) marcas.push(c);
  }
  return [...new Set(marcas)];
}

export function vendemosMarca(marca: string): boolean {
  const k = marca.trim().toUpperCase();
  return MARCAS_VENDEMOS.has(k);
}

export async function buscarProductosMostrador(
  query: string,
  limit = 8,
): Promise<{ ok: true; productos: ProductoMostrador[] } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const q = query.trim();
  if (!q) return { ok: true, productos: [] };

  const safe = q
    .replace(/[%_,.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!safe) return { ok: true, productos: [] };

  const pattern = `%${safe}%`;
  const url = new URL(`${env.url}/rest/v1/productos`);
  url.searchParams.set(
    "select",
    "slug,referencia,nombre,aplicacion,categoria,marca,marca_producto,precio_lista,stock_actual",
  );
  url.searchParams.set("activo", "eq.true");
  url.searchParams.set("limit", String(Math.min(12, Math.max(1, limit))));
  url.searchParams.set(
    "or",
    `(referencia.ilike.${pattern},nombre.ilike.${pattern},aplicacion.ilike.${pattern},categoria.ilike.${pattern})`,
  );
  url.searchParams.set("order", "stock_actual.desc,precio_lista.asc");

  const res = await fetch(url.toString(), { headers: headers(env) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Búsqueda falló (${res.status}) ${text}`.slice(0, 180) };
  }

  const rows = (await res.json()) as ProductoRow[];
  const productos = rows
    .map(mapRow)
    .filter((p) => p.marcaProducto.toUpperCase() !== "DISTRICAMIONES");
  return { ok: true, productos };
}

export async function buscarPorReferenciaExacta(
  referencia: string,
): Promise<ProductoMostrador | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const ref = referencia.trim().toUpperCase();
  const url = new URL(`${env.url}/rest/v1/productos`);
  url.searchParams.set(
    "select",
    "slug,referencia,nombre,aplicacion,categoria,marca,marca_producto,precio_lista,stock_actual",
  );
  url.searchParams.set("activo", "eq.true");
  url.searchParams.set("referencia", `eq.${ref}`);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), { headers: headers(env) });
  if (!res.ok) return null;
  const rows = (await res.json()) as ProductoRow[];
  const row = rows[0];
  if (!row) return null;
  const p = mapRow(row);
  if (p.marcaProducto.toUpperCase() === "DISTRICAMIONES") return null;
  return p;
}

export async function resolverBusquedaMostrador(
  mensajeUsuario: string,
  piezaPrioritaria?: string,
): Promise<ProductoMostrador[]> {
  const refs = extraerReferencias(mensajeUsuario);
  const found: ProductoMostrador[] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    const p = await buscarPorReferenciaExacta(ref);
    if (p && !seen.has(p.slug)) {
      seen.add(p.slug);
      found.push(p);
    }
  }

  const queries = [mensajeUsuario.trim(), piezaPrioritaria?.trim()].filter(Boolean) as string[];
  for (const q of queries) {
    const res = await buscarProductosMostrador(q, 6);
    if (!res.ok) continue;
    for (const p of res.productos) {
      if (!seen.has(p.slug)) {
        seen.add(p.slug);
        found.push(p);
      }
    }
  }

  return found.slice(0, 8);
}

export function formatoInventarioParaPrompt(productos: ProductoMostrador[]): string {
  if (!productos.length) return "[]";
  return JSON.stringify(
    productos.map((p) => ({
      referencia: p.referencia,
      nombre: p.nombre,
      marca: p.marcaProducto,
      precioPublicoCop: p.precioPublico,
      stock: p.stock,
      disponibilidad: p.disponibilidad,
      categoria: p.categoria,
      aplicacion: p.aplicacion.slice(0, 120),
    })),
    null,
    0,
  );
}

export function marcasQueVendemosTexto(): string {
  return [...MARCAS_VENDEMOS].map((k) => metaMarcaProveedor(k)?.nombre ?? k).join(", ");
}
