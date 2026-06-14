import { normalizeSupabaseUrl } from "./supabase-env";

type SupabaseEnv = {
  url: string;
  serviceRoleKey: string;
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

let tablaDisponible: boolean | null = null;

function envModoDemostracion(): boolean {
  return (
    process.env.APEX_MODO_DEMOSTRACION === "true" ||
    process.env.VITE_APEX_MODO_DEMOSTRACION === "true"
  );
}

/** Pedidos portal taller se marcan prueba y no descuentan stock. */
export async function getModoDemostracion(): Promise<boolean> {
  if (envModoDemostracion()) return true;

  const env = getSupabaseEnv();
  if (!env) return false;

  if (tablaDisponible === false) return false;

  const url = new URL(`${env.url}/rest/v1/apex_operacion_config`);
  url.searchParams.set("select", "modo_demostracion");
  url.searchParams.set("id", "eq.1");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), { headers: headers(env) });
  if (!res.ok) {
    if (res.status === 404 || res.status === 400) {
      tablaDisponible = false;
    }
    return false;
  }

  tablaDisponible = true;
  const rows = (await res.json()) as { modo_demostracion?: boolean }[];
  return Boolean(rows[0]?.modo_demostracion);
}

export async function setModoDemostracion(
  activo: boolean,
): Promise<{ ok: true; modoDemostracion: boolean } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const res = await fetch(`${env.url}/rest/v1/apex_operacion_config?id=eq.1`, {
    method: "PATCH",
    headers: headers(env, { Prefer: "return=representation" }),
    body: JSON.stringify({ modo_demostracion: activo, updated_at: new Date().toISOString() }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 404 || text.includes("apex_operacion_config")) {
      return {
        ok: false,
        reason:
          "Falta migración apex_operacion_config en Supabase. Ejecuta el SQL de modo demostración.",
      };
    }
    return { ok: false, reason: `No se pudo guardar (${res.status})`.slice(0, 120) };
  }

  tablaDisponible = true;
  const rows = (await res.json()) as { modo_demostracion?: boolean }[];
  return { ok: true, modoDemostracion: Boolean(rows[0]?.modo_demostracion ?? activo) };
}
