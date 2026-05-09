import { loadCatalogo } from "./inventario.server";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sitemap con URLs indexables (misma fuente que el catálogo: Supabase o JSON).
 */
export async function buildSitemapXml(origin: string): Promise<string> {
  const base = origin.replace(/\/$/, "");
  const { piezas } = await loadCatalogo();

  const staticPaths = ["/", "/catalogo", "/legal"];
  const locs: string[] = [
    ...staticPaths.map((p) => (p === "/" ? `${base}/` : `${base}${p}`)),
    ...piezas.map((pieza) => `${base}/repuesto/${encodeURIComponent(pieza.slug)}`),
  ];

  const urls = locs.map((loc) => `  <url><loc>${escapeXml(loc)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
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
