/**
 * URL pública del sitio (sin barra final).
 *
 * Usá un dominio real con DNS y HTTPS, p. ej. `https://apex.com.co`.
 * No escribas en la barra del navegador texto tipo `tu_dominio/sitemap.xml`: el host literal
 * `tu_dominio` no existe y verás errores DNS (DNS_PROBE_*).
 */
export function siteOriginForHead(): string {
  const v = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  if (v) return v.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:8080";
  return "";
}

/** Origen para sitemap/robots: env primero; si no, el host de la petición. */
export function resolvePublicOrigin(request: Request): string {
  const v = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim().replace(/\/$/, "");
  if (v) return v;
  return new URL(request.url).origin;
}

/** Canonical absoluto, o null si no hay base (mejor que apuntar mal). */
export function canonicalHref(path: string): string | null {
  const base = siteOriginForHead();
  if (!base) return null;
  if (path === "/") return `${base}/`;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
