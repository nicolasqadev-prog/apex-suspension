import { normalizeSupabaseUrl } from "./supabase-env";
import { DESCUENTO_TALLER_POLITICA } from "./taller-politica";
import { normalizeWhatsapp } from "./talleres.server";

type SupabaseEnv = {
  url: string;
  serviceRoleKey: string;
};

export type TallerFidelizadoAdmin = {
  id: string;
  whatsapp: string;
  nombreTaller: string;
  nit: string;
  descuentoPorcentaje: number;
  contraEntregaHabilitada: boolean;
  activo: boolean;
  publicado: boolean;
  municipio: string;
  direccionEntrega: string;
  createdAt: string;
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

type DbRow = {
  id: string;
  whatsapp: string;
  nombre_taller: string;
  descuento_porcentaje: number;
  contra_entrega_habilitada: boolean;
  activo: boolean;
  publicado?: boolean;
  municipio?: string | null;
  direccion_entrega?: string | null;
  nit?: string | null;
  created_at: string;
};

const SELECT_ADMIN_CON_ENTREGA =
  "id,whatsapp,nombre_taller,nit,descuento_porcentaje,contra_entrega_habilitada,activo,publicado,municipio,direccion_entrega,created_at";
const SELECT_ADMIN_SIN_ENTREGA =
  "id,whatsapp,nombre_taller,nit,descuento_porcentaje,contra_entrega_habilitada,activo,publicado,created_at";
const SELECT_ADMIN_SIN_NIT =
  "id,whatsapp,nombre_taller,descuento_porcentaje,contra_entrega_habilitada,activo,publicado,municipio,direccion_entrega,created_at";

function mapRow(row: DbRow): TallerFidelizadoAdmin {
  return {
    id: row.id,
    whatsapp: row.whatsapp,
    nombreTaller: row.nombre_taller,
    descuentoPorcentaje: Number(row.descuento_porcentaje ?? DESCUENTO_TALLER_POLITICA),
    contraEntregaHabilitada: Boolean(row.contra_entrega_habilitada),
    activo: Boolean(row.activo),
    publicado: row.publicado !== false,
    municipio: row.municipio?.trim() ?? "",
    direccionEntrega: row.direccion_entrega?.trim() ?? "",
    nit: row.nit?.trim() ?? "",
    createdAt: row.created_at,
  };
}

export async function listTalleresFidelizadosAdmin(): Promise<
  { ok: true; talleres: TallerFidelizadoAdmin[] } | { ok: false; reason: string }
> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const url = new URL(`${env.url}/rest/v1/talleres_fidelizados`);
  url.searchParams.set("select", SELECT_ADMIN_CON_ENTREGA);
  url.searchParams.set("order", "publicado.asc,activo.desc,nombre_taller.asc");

  let res = await fetch(url.toString(), { headers: headers(env) });
  if (!res.ok && res.status === 400) {
    url.searchParams.set("select", SELECT_ADMIN_SIN_ENTREGA);
    res = await fetch(url.toString(), { headers: headers(env) });
  }
  if (!res.ok && res.status === 400) {
    url.searchParams.set("select", SELECT_ADMIN_SIN_NIT);
    res = await fetch(url.toString(), { headers: headers(env) });
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Listar talleres falló (${res.status}) ${text}`.slice(0, 200) };
  }

  const rows = (await res.json()) as DbRow[];
  return { ok: true, talleres: rows.map(mapRow) };
}

export type UpsertTallerInput = {
  whatsapp: string;
  nombreTaller: string;
  nit?: string;
  contraEntregaHabilitada: boolean;
  municipio: string;
  direccionEntrega: string;
  activo?: boolean;
  publicado?: boolean;
};

export async function upsertTallerFidelizado(
  input: UpsertTallerInput,
): Promise<{ ok: true; taller: TallerFidelizadoAdmin } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };
  const supabase = env;

  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (whatsapp.length < 10) return { ok: false, reason: "WhatsApp inválido" };

  const municipio = input.municipio.trim();
  const direccionEntrega = input.direccionEntrega.trim();
  const nit = input.nit?.trim() ?? "";
  const payload: Record<string, unknown> = {
    whatsapp,
    nombre_taller: input.nombreTaller.trim(),
    nit: nit || null,
    descuento_porcentaje: DESCUENTO_TALLER_POLITICA,
    contra_entrega_habilitada: input.contraEntregaHabilitada,
    activo: input.activo ?? true,
    publicado: input.publicado ?? true,
    municipio: municipio || null,
    direccion_entrega: direccionEntrega || null,
  };

  async function postUpsert(body: Record<string, unknown>) {
    return fetch(`${supabase.url}/rest/v1/talleres_fidelizados?on_conflict=whatsapp`, {
      method: "POST",
      headers: headers(supabase, {
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify(body),
    });
  }

  let res = await postUpsert(payload);

  if (!res.ok && res.status === 400) {
    const { municipio: _m, direccion_entrega: _d, nit: _n, ...sinEntrega } = payload;
    res = await postUpsert(sinEntrega);
  }

  if (!res.ok && res.status === 400) {
    const { nit: _n, ...sinNit } = payload;
    res = await postUpsert(sinNit);
  }

  if (!res.ok && res.status === 400 && payload.publicado !== undefined) {
    const { publicado: _p, municipio: _m, direccion_entrega: _d, nit: _n, ...minimo } = payload;
    res = await postUpsert(minimo);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Guardar taller falló (${res.status}) ${text}`.slice(0, 220) };
  }

  const rows = (await res.json()) as DbRow[];
  const row = rows[0];
  if (!row) return { ok: false, reason: "No se recibió el taller guardado" };
  return { ok: true, taller: mapRow(row) };
}

export async function certificarTallerFidelizado(
  whatsapp: string,
): Promise<{ ok: true; taller: TallerFidelizadoAdmin } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const w = normalizeWhatsapp(whatsapp);
  const patch = { activo: true, publicado: true };

  let res = await fetch(
    `${env.url}/rest/v1/talleres_fidelizados?whatsapp=eq.${encodeURIComponent(w)}`,
    {
      method: "PATCH",
      headers: headers(env, { Prefer: "return=representation" }),
      body: JSON.stringify(patch),
    },
  );

  if (!res.ok && res.status === 400) {
    res = await fetch(
      `${env.url}/rest/v1/talleres_fidelizados?whatsapp=eq.${encodeURIComponent(w)}`,
      {
        method: "PATCH",
        headers: headers(env, { Prefer: "return=representation" }),
        body: JSON.stringify({ activo: true }),
      },
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Certificar falló (${res.status}) ${text}`.slice(0, 200) };
  }

  const rows = (await res.json()) as DbRow[];
  const row = rows[0];
  if (!row) return { ok: false, reason: "Taller no encontrado" };
  return { ok: true, taller: mapRow(row) };
}

export async function setTallerActivo(
  whatsapp: string,
  activo: boolean,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const w = normalizeWhatsapp(whatsapp);
  const res = await fetch(
    `${env.url}/rest/v1/talleres_fidelizados?whatsapp=eq.${encodeURIComponent(w)}`,
    {
      method: "PATCH",
      headers: headers(env, { Prefer: "return=minimal" }),
      body: JSON.stringify({ activo }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Actualizar taller falló (${res.status}) ${text}`.slice(0, 200) };
  }
  return { ok: true };
}

export async function deleteTallerFidelizado(
  whatsapp: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const w = normalizeWhatsapp(whatsapp);
  const res = await fetch(
    `${env.url}/rest/v1/talleres_fidelizados?whatsapp=eq.${encodeURIComponent(w)}`,
    {
      method: "DELETE",
      headers: headers(env),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Eliminar taller falló (${res.status}) ${text}`.slice(0, 200) };
  }
  return { ok: true };
}

/** Pasa talleres en borrador a operación en vivo. */
export async function publicarTalleresBorrador(): Promise<
  { ok: true; publicados: number } | { ok: false; reason: string }
> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const url = new URL(`${env.url}/rest/v1/talleres_fidelizados`);
  url.searchParams.set("publicado", "eq.false");
  url.searchParams.set("activo", "eq.true");

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: headers(env, { Prefer: "return=representation" }),
    body: JSON.stringify({ publicado: true }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Publicar talleres falló (${res.status}) ${text}`.slice(0, 200) };
  }

  const rows = (await res.json()) as DbRow[];
  return { ok: true, publicados: rows.length };
}

export async function eliminarPedidosPrueba(): Promise<
  { ok: true; eliminados: number } | { ok: false; reason: string }
> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const url = new URL(`${env.url}/rest/v1/pedidos`);
  url.searchParams.set("es_prueba", "eq.true");
  url.searchParams.set("select", "id");

  const list = await fetch(url.toString(), { headers: headers(env) });
  if (!list.ok) {
    return { ok: false, reason: "No se pudieron listar pedidos de prueba" };
  }
  const rows = (await list.json()) as { id: string }[];

  if (rows.length === 0) return { ok: true, eliminados: 0 };

  const del = await fetch(`${env.url}/rest/v1/pedidos?es_prueba=eq.true`, {
    method: "DELETE",
    headers: headers(env),
  });
  if (!del.ok) {
    return { ok: false, reason: "No se pudieron borrar pedidos de prueba" };
  }
  return { ok: true, eliminados: rows.length };
}
