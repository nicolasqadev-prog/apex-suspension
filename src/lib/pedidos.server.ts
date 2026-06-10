import { getProductoIdBySlug } from "./inventario-admin.server";
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
  es_prueba?: boolean;
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
  opts?: { esPrueba?: boolean; lineas?: LineaPedidoInput[] },
): Promise<{ ok: true; pedidoId: string } | { ok: false; reason: string }> {
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
    es_prueba: opts?.esPrueba ?? false,
  };

  const res = await fetch(`${env.url}/rest/v1/pedidos`, {
    method: "POST",
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Supabase insert falló (${res.status}) ${text}`.slice(0, 220) };
  }

  const rows = (await res.json()) as { id: string }[];
  const pedidoId = rows[0]?.id;
  if (!pedidoId) return { ok: false, reason: "Pedido creado sin id" };

  const lineas = opts?.lineas ?? [];
  for (const linea of lineas) {
    if (linea.cantidad <= 0) continue;
    const productoId = await getProductoIdBySlug(linea.slug);
    if (!productoId) continue;

    const lineRes = await fetch(`${env.url}/rest/v1/pedido_lineas`, {
      method: "POST",
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        pedido_id: pedidoId,
        producto_id: productoId,
        cantidad: linea.cantidad,
        precio_unitario: linea.precioUnitario,
      }),
    });
    if (!lineRes.ok) {
      const text = await lineRes.text().catch(() => "");
      return {
        ok: false,
        reason: `Pedido creado pero línea falló (${lineRes.status}) ${text}`.slice(0, 200),
      };
    }
  }

  return { ok: true, pedidoId };
}

export type UltimoPedidoTaller = {
  telefono: string;
  created_at: string;
  estado: string;
};

/** Último pedido por WhatsApp de taller (para seguimiento en admin). */
export async function ultimosPedidosPorTelefonos(
  telefonos: string[],
): Promise<{ ok: true; pedidos: UltimoPedidoTaller[] } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado en servidor" };
  if (telefonos.length === 0) return { ok: true, pedidos: [] };

  const unicos = [...new Set(telefonos.map((t) => t.replace(/\D/g, "")).filter((t) => t.length >= 10))];
  const url = new URL(`${env.url}/rest/v1/pedidos`);
  url.searchParams.set("select", "telefono,created_at,estado");
  url.searchParams.set("telefono", `in.(${unicos.join(",")})`);
  url.searchParams.set("es_prueba", "eq.false");
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", "200");

  let res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
    },
  });

  if (!res.ok && res.status === 400) {
    const url2 = new URL(`${env.url}/rest/v1/pedidos`);
    url2.searchParams.set("select", "telefono,created_at,estado");
    url2.searchParams.set("telefono", `in.(${unicos.join(",")})`);
    url2.searchParams.set("order", "created_at.desc");
    url2.searchParams.set("limit", "200");
    res = await fetch(url2.toString(), {
      method: "GET",
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
      },
    });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Pedidos taller falló (${res.status}) ${text}`.slice(0, 200) };
  }

  const rows = (await res.json()) as UltimoPedidoTaller[];
  const vistos = new Set<string>();
  const pedidos: UltimoPedidoTaller[] = [];
  for (const row of rows) {
    const tel = row.telefono?.replace(/\D/g, "") ?? "";
    if (!tel || vistos.has(tel)) continue;
    vistos.add(tel);
    pedidos.push(row);
  }
  return { ok: true, pedidos };
}

export async function listPedidosRecientes(
  minutes: number,
  opts?: { soloPrueba?: boolean; soloProduccion?: boolean },
): Promise<{ ok: true; pedidos: PedidoRow[] } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado en servidor" };

  const since = new Date(Date.now() - minutes * 60_000).toISOString();
  const url = new URL(`${env.url}/rest/v1/pedidos`);
  url.searchParams.set(
    "select",
    "id,estado,taller_nombre,telefono,direccion,notas,created_at,es_prueba",
  );
  url.searchParams.set("created_at", `gte.${since}`);
  if (opts?.soloPrueba) url.searchParams.set("es_prueba", "eq.true");
  if (opts?.soloProduccion) url.searchParams.set("es_prueba", "eq.false");
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

export type PedidoLineaRow = {
  cantidad: number;
  precio_unitario: number;
  productos: { referencia: string; nombre: string } | null;
};

export async function listPedidosPorTelefono(
  rawTelefono: string,
  opts?: { dias?: number; incluirPrueba?: boolean },
): Promise<{ ok: true; pedidos: PedidoRow[] } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado en servidor" };

  const telefono = rawTelefono.replace(/\D/g, "");
  if (telefono.length < 10) return { ok: false, reason: "Teléfono inválido" };

  const dias = Math.min(90, Math.max(1, opts?.dias ?? 30));
  const since = new Date(Date.now() - dias * 24 * 60 * 60_000).toISOString();

  const url = new URL(`${env.url}/rest/v1/pedidos`);
  url.searchParams.set(
    "select",
    "id,estado,taller_nombre,telefono,direccion,notas,created_at,es_prueba",
  );
  url.searchParams.set("telefono", `eq.${telefono}`);
  url.searchParams.set("created_at", `gte.${since}`);
  if (!opts?.incluirPrueba) url.searchParams.set("es_prueba", "eq.false");
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", "40");

  let res = await fetch(url.toString(), {
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
    },
  });

  if (!res.ok && res.status === 400 && !opts?.incluirPrueba) {
    const url2 = new URL(url.toString());
    url2.searchParams.delete("es_prueba");
    res = await fetch(url2.toString(), {
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
      },
    });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Listar pedidos falló (${res.status}) ${text}`.slice(0, 200) };
  }

  const pedidos = (await res.json()) as PedidoRow[];
  return { ok: true, pedidos };
}

export async function getPedidoLineas(
  pedidoId: string,
): Promise<{ ok: true; lineas: PedidoLineaRow[] } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado en servidor" };

  const url = new URL(`${env.url}/rest/v1/pedido_lineas`);
  url.searchParams.set("select", "cantidad,precio_unitario,productos(referencia,nombre)");
  url.searchParams.set("pedido_id", `eq.${pedidoId}`);

  const res = await fetch(url.toString(), {
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Líneas pedido falló (${res.status}) ${text}`.slice(0, 200) };
  }

  const lineas = (await res.json()) as PedidoLineaRow[];
  return { ok: true, lineas };
}

export async function getPedidoById(
  id: string,
): Promise<{ ok: true; pedido: PedidoRow } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado en servidor" };

  const url = new URL(`${env.url}/rest/v1/pedidos`);
  url.searchParams.set(
    "select",
    "id,estado,taller_nombre,telefono,direccion,notas,created_at,es_prueba",
  );
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
