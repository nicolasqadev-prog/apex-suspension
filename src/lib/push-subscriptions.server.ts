import { normalizeSupabaseUrl } from "./supabase-env";
import { normalizeWhatsapp } from "./talleres.server";

type SupabaseEnv = {
  url: string;
  serviceRoleKey: string;
};

export type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  telefono: string | null;
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

export async function upsertPushSubscription(input: {
  endpoint: string;
  keysP256dh: string;
  keysAuth: string;
  telefono?: string;
  userAgent?: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const telefono = input.telefono ? normalizeWhatsapp(input.telefono) : null;
  const payload = {
    endpoint: input.endpoint,
    keys_p256dh: input.keysP256dh,
    keys_auth: input.keysAuth,
    telefono: telefono || null,
    user_agent: input.userAgent?.slice(0, 280) ?? null,
    updated_at: new Date().toISOString(),
  };

  const res = await fetch(
    `${env.url}/rest/v1/push_subscriptions?on_conflict=endpoint`,
    {
      method: "POST",
      headers: headers(env, {
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Guardar suscripción falló (${res.status}) ${text}`.slice(0, 200) };
  }

  return { ok: true };
}

export async function listPushSubscriptions(): Promise<
  { ok: true; rows: PushSubscriptionRow[] } | { ok: false; reason: string }
> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const url = new URL(`${env.url}/rest/v1/push_subscriptions`);
  url.searchParams.set("select", "id,endpoint,keys_p256dh,keys_auth,telefono");
  url.searchParams.set("order", "updated_at.desc");
  url.searchParams.set("limit", "500");

  const res = await fetch(url.toString(), {
    headers: headers(env),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Listar suscripciones falló (${res.status}) ${text}`.slice(0, 200) };
  }

  const rows = (await res.json()) as PushSubscriptionRow[];
  return { ok: true, rows };
}

export async function listPushSubscriptionsByTelefono(
  rawTelefono: string,
): Promise<{ ok: true; rows: PushSubscriptionRow[] } | { ok: false; reason: string }> {
  const telefono = normalizeWhatsapp(rawTelefono);
  if (!telefono) return { ok: true, rows: [] };

  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const url = new URL(`${env.url}/rest/v1/push_subscriptions`);
  url.searchParams.set("select", "id,endpoint,keys_p256dh,keys_auth,telefono");
  url.searchParams.set("telefono", `eq.${telefono}`);

  const res = await fetch(url.toString(), { headers: headers(env) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Buscar suscripción falló (${res.status}) ${text}`.slice(0, 200) };
  }

  const rows = (await res.json()) as PushSubscriptionRow[];
  return { ok: true, rows };
}

export async function deletePushSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  const env = getSupabaseEnv();
  if (!env) return;

  const url = new URL(`${env.url}/rest/v1/push_subscriptions`);
  url.searchParams.set("endpoint", `eq.${endpoint}`);

  await fetch(url.toString(), {
    method: "DELETE",
    headers: headers(env),
  });
}
