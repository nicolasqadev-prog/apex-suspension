import { createFileRoute } from "@tanstack/react-router";

import { normalizeSupabaseUrl } from "@/lib/supabase-env";

async function pingSupabase(): Promise<boolean> {
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !key) return false;

  const base = normalizeSupabaseUrl(rawUrl);
  const u = new URL(`${base}/rest/v1/productos`);
  u.searchParams.set("select", "slug");
  u.searchParams.set("activo", "eq.true");
  u.searchParams.set("limit", "1");

  const res = await fetch(u.toString(), {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(8000),
  });
  return res.ok;
}

/** Ping liviano para uptime y post-deploy (sin cargar el catálogo completo). */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const checks = { worker: true, supabase: false };
        try {
          checks.supabase = await pingSupabase();
        } catch {
          checks.supabase = false;
        }

        const ok = checks.worker && checks.supabase;
        return new Response(
          JSON.stringify({
            ok,
            service: "apex-suspension",
            checks,
            ts: new Date().toISOString(),
          }),
          {
            status: ok ? 200 : 503,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        );
      },
    },
  },
});
