/** Origen del proyecto Supabase, sin `/rest/v1` al final. */
export function normalizeSupabaseUrl(raw: string): string {
  let u = raw.trim().replace(/\/$/, "");
  u = u.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
  return u;
}
