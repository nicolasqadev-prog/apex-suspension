/** Origen del proyecto Supabase, sin `/rest/v1` al final. */
export function normalizeSupabaseUrl(raw: string): string {
  let u = raw.trim().replace(/\/$/, "");
  u = u.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
  return u;
}

/** Evita colgar el Worker si Supabase no responde. */
export async function supabaseFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8_000,
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
