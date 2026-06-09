import { normalizeSupabaseUrl } from "./supabase-env";

export type TallerFidelizado = {
  whatsapp: string;
  nombreTaller: string;
  descuentoPorcentaje: number;
  contraEntregaHabilitada: boolean;
  /** false = borrador (solo pruebas admin). */
  publicado: boolean;
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

/** Solo dígitos; si es celular CO de 10 dígitos (3xx…), antepone 57. */
export function normalizeWhatsapp(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("3")) {
    digits = `57${digits}`;
  }
  return digits;
}

type TallerRow = {
  whatsapp: string;
  nombre_taller: string;
  descuento_porcentaje: number;
  contra_entrega_habilitada: boolean;
  activo: boolean;
  publicado?: boolean;
};

export async function getTallerFidelizadoByWhatsapp(
  rawWhatsapp: string,
  opts?: { allowNoPublicado?: boolean },
): Promise<TallerFidelizado | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) return null;

  async function fetchTaller(conPublicado: boolean) {
    const url = new URL(`${env.url}/rest/v1/talleres_fidelizados`);
    url.searchParams.set(
      "select",
      conPublicado
        ? "whatsapp,nombre_taller,descuento_porcentaje,contra_entrega_habilitada,activo,publicado"
        : "whatsapp,nombre_taller,descuento_porcentaje,contra_entrega_habilitada,activo",
    );
    url.searchParams.set("whatsapp", `eq.${whatsapp}`);
    url.searchParams.set("activo", "eq.true");
    if (conPublicado && !opts?.allowNoPublicado) {
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

  let res = await fetchTaller(true);
  if (!res.ok && res.status === 400) {
    res = await fetchTaller(false);
  }
  if (!res.ok) return null;
  const rows = (await res.json()) as TallerRow[];
  const row = rows[0];
  if (!row || !row.activo) return null;

  return {
    whatsapp: row.whatsapp,
    nombreTaller: row.nombre_taller,
    descuentoPorcentaje: Number(row.descuento_porcentaje ?? 0),
    contraEntregaHabilitada: Boolean(row.contra_entrega_habilitada),
    publicado: row.publicado !== false,
  };
}
