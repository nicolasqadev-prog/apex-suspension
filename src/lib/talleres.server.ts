import { normalizeSupabaseUrl } from "./supabase-env";
import { normalizeWhatsappTaller } from "./taller-whatsapp";

export type TallerFidelizado = {
  whatsapp: string;
  nombreTaller: string;
  descuentoPorcentaje: number;
  contraEntregaHabilitada: boolean;
  /** false = borrador (solo pruebas admin). */
  publicado: boolean;
  municipio: string;
  direccionEntrega: string;
};

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

/** @deprecated Usar normalizeWhatsappTaller (misma lógica, usable en cliente). */
export const normalizeWhatsapp = normalizeWhatsappTaller;

type TallerRow = {
  whatsapp: string;
  nombre_taller: string;
  descuento_porcentaje: number;
  contra_entrega_habilitada: boolean;
  activo: boolean;
  publicado?: boolean;
  municipio?: string | null;
  direccion_entrega?: string | null;
};

const SELECT_CON_ENTREGA =
  "whatsapp,nombre_taller,descuento_porcentaje,contra_entrega_habilitada,activo,publicado,municipio,direccion_entrega";
const SELECT_SIN_ENTREGA =
  "whatsapp,nombre_taller,descuento_porcentaje,contra_entrega_habilitada,activo,publicado";

function mapTallerRow(row: TallerRow): TallerFidelizado {
  return {
    whatsapp: row.whatsapp,
    nombreTaller: row.nombre_taller,
    descuentoPorcentaje: Number(row.descuento_porcentaje ?? 0),
    contraEntregaHabilitada: Boolean(row.contra_entrega_habilitada),
    publicado: row.publicado !== false,
    municipio: row.municipio?.trim() ?? "",
    direccionEntrega: row.direccion_entrega?.trim() ?? "",
  };
}

export async function getTallerFidelizadoByWhatsapp(
  rawWhatsapp: string,
  opts?: { allowNoPublicado?: boolean },
): Promise<TallerFidelizado | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) return null;

  async function fetchTaller(select: string, conFiltroPublicado: boolean) {
    const url = new URL(`${env.url}/rest/v1/talleres_fidelizados`);
    url.searchParams.set("select", select);
    url.searchParams.set("whatsapp", `eq.${whatsapp}`);
    url.searchParams.set("activo", "eq.true");
    if (conFiltroPublicado && !opts?.allowNoPublicado) {
      url.searchParams.set("publicado", "eq.true");
    }
    url.searchParams.set("limit", "1");
    return fetch(url.toString(), {
      method: "GET",
      headers: {
        apikey: env.serviceRoleKey,
        Authorization: `Bearer ${env.serviceRoleKey}`,
      },
    });
  }

  let res = await fetchTaller(SELECT_CON_ENTREGA, true);
  if (!res.ok && res.status === 400) {
    res = await fetchTaller(SELECT_SIN_ENTREGA, true);
  }
  if (!res.ok && res.status === 400) {
    res = await fetchTaller(SELECT_SIN_ENTREGA, false);
  }
  if (!res.ok) return null;
  const rows = (await res.json()) as TallerRow[];
  const row = rows[0];
  if (!row || !row.activo) return null;

  return mapTallerRow(row);
}
