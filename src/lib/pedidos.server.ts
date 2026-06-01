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

type PedidoRow = {
  id: string;
  estado: string;
  taller_nombre: string;
  telefono: string;
  direccion: string | null;
  notas: string | null;
  created_at: string;
};

export type CreatePedidoInput = {
  tallerNombre: string;
  whatsapp: string;
  municipio: string;
  direccion: string;
  referencia?: string;
  requerimiento?: string;
  notas?: string;
};

export async function createPedido(
  input: CreatePedidoInput,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado en servidor" };

  const direccionFull = `${input.direccion}${input.municipio ? `, ${input.municipio}` : ""}`;
  const notas = [
    input.referencia ? `Requerimiento: ${input.referencia}` : null,
    input.requerimiento ? `Categoría: ${input.requerimiento}` : null,
    input.notas ? `Notas: ${input.notas}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const payload = {
    estado: "borrador",
    taller_nombre: input.tallerNombre,
    telefono: input.whatsapp,
    direccion: direccionFull,
    notas: notas || null,
  };

  const res = await fetch(`${env.url}/rest/v1/pedidos`, {
    method: "POST",
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Supabase insert falló (${res.status}) ${text}`.slice(0, 220) };
  }

  return { ok: true };
}

export async function listPedidosRecientes(
  minutes: number,
): Promise<{ ok: true; pedidos: PedidoRow[] } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado en servidor" };

  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const url = new URL(`${env.url}/rest/v1/pedidos`);
  url.searchParams.set("select", "id,estado,taller_nombre,telefono,direccion,notas,created_at");
  url.searchParams.set("created_at", `gte.${since}`);
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", "50");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Supabase select falló (${res.status}) ${text}`.slice(0, 220) };
  }

  const pedidos = (await res.json()) as PedidoRow[];
  return { ok: true, pedidos };
}

const ESTADOS_PEDIDO = [
  "borrador",
  "cotizado",
  "confirmado",
  "empacando",
  "en_ruta",
  "entregado",
  "cancelado",
] as const;

export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export function esEstadoPedidoValido(value: string): value is EstadoPedido {
  return (ESTADOS_PEDIDO as readonly string[]).includes(value);
}

export async function getPedidoById(
  id: string,
): Promise<{ ok: true; pedido: PedidoRow } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado en servidor" };

  const url = new URL(`${env.url}/rest/v1/pedidos`);
  url.searchParams.set("select", "id,estado,taller_nombre,telefono,direccion,notas,created_at");
  url.searchParams.set("id", `eq.${id}`);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Supabase select falló (${res.status}) ${text}`.slice(0, 220) };
  }

  const rows = (await res.json()) as PedidoRow[];
  const pedido = rows[0];
  if (!pedido) return { ok: false, reason: "Pedido no encontrado" };
  return { ok: true, pedido };
}

export async function updatePedidoEstado(
  id: string,
  estado: EstadoPedido,
): Promise<{ ok: true; pedido: PedidoRow } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado en servidor" };

  const res = await fetch(`${env.url}/rest/v1/pedidos?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ estado }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Actualizar pedido falló (${res.status}) ${text}`.slice(0, 220) };
  }

  const rows = (await res.json()) as PedidoRow[];
  const pedido = rows[0];
  if (!pedido) return { ok: false, reason: "Pedido no encontrado tras actualizar" };
  return { ok: true, pedido };
}
