import { listarPiezas } from "./inventario";
import { normalizeSupabaseUrl } from "./supabase-env";

export const SITEMAP_CHUNK_SIZE = 1000;

const STATIC_PATHS = ["/", "/catalogo", "/legal", "/taller", "/taller/acceso", "/taller/inscripcion"];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
}

function urlsetXml(locs: string[]): string {
  const urls = locs.map((loc) => `  <url><loc>${escapeXml(loc)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function sitemapIndexXml(entries: string[]): string {
  const body = entries.map((loc) => `  <sitemap><loc>${escapeXml(loc)}</loc></sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>
`;
}

async function supabaseHeaders(): Promise<{
  base: string;
  headers: Record<string, string>;
} | null> {
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !key) return null;
  const base = normalizeSupabaseUrl(rawUrl);
  return {
    base,
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  };
}

/** Total productos activos (solo conteo). */
export async function countActiveProductSlugs(): Promise<number> {
  const cfg = await supabaseHeaders();
  if (!cfg) return listarPiezas().length;

  const u = new URL(`${cfg.base}/rest/v1/productos`);
  u.searchParams.set("select", "slug");
  u.searchParams.set("activo", "eq.true");

  const res = await fetch(u.toString(), {
    headers: { ...cfg.headers, Prefer: "count=exact" },
  });
  if (!res.ok) return listarPiezas().length;

  const range = res.headers.get("content-range");
  const m = range?.match(/\/(\d+)$/);
  return m ? Number(m[1]) : listarPiezas().length;
}

/** Slugs activos paginados (ligero para sitemap). */
export async function fetchActiveSlugsPage(page: number): Promise<string[]> {
  const cfg = await supabaseHeaders();
  if (!cfg) {
    const all = listarPiezas()
      .map((p) => p.slug)
      .sort();
    const start = (page - 1) * SITEMAP_CHUNK_SIZE;
    return all.slice(start, start + SITEMAP_CHUNK_SIZE);
  }

  const start = (page - 1) * SITEMAP_CHUNK_SIZE;
  const end = start + SITEMAP_CHUNK_SIZE - 1;
  const u = new URL(`${cfg.base}/rest/v1/productos`);
  u.searchParams.set("select", "slug");
  u.searchParams.set("activo", "eq.true");
  u.searchParams.set("order", "slug.asc");

  const res = await fetch(u.toString(), {
    headers: { ...cfg.headers, Range: `${start}-${end}` },
  });
  if (!res.ok) return [];

  const rows = (await res.json()) as { slug: string }[];
  return rows.map((r) => r.slug).filter(Boolean);
}

export function productSitemapPageCount(totalProducts: number): number {
  return Math.max(1, Math.ceil(totalProducts / SITEMAP_CHUNK_SIZE));
}

/** Índice: estáticas + chunks de productos. */
export async function buildSitemapIndexXml(origin: string): Promise<string> {
  const base = origin.replace(/\/$/, "");
  const total = await countActiveProductSlugs();
  const pages = productSitemapPageCount(total);

  const entries = [
    `${base}/sitemap-static.xml`,
    ...Array.from({ length: pages }, (_, i) => `${base}/sitemap-products/${i + 1}`),
  ];

  return sitemapIndexXml(entries);
}

export function buildStaticSitemapXml(origin: string): string {
  const base = origin.replace(/\/$/, "");
  const locs = STATIC_PATHS.map((p) => (p === "/" ? `${base}/` : `${base}${p}`));
  return urlsetXml(locs);
}

export async function buildProductSitemapXml(origin: string, page: number): Promise<string | null> {
  const slugs = await fetchActiveSlugsPage(page);
  if (slugs.length === 0) return null;

  const base = origin.replace(/\/$/, "");
  const locs = slugs.map((slug) => `${base}/repuesto/${encodeURIComponent(slug)}`);
  return urlsetXml(locs);
}

export function buildRobotsTxt(origin: string): string {
  const base = origin.replace(/\/$/, "");
  return [
    "User-agent: *",
    "Allow: /",
    "",
    "Disallow: /admin",
    "",
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");
}

export function sitemapXmlResponse(xml: string): Response {
  return xmlResponse(xml);
}
