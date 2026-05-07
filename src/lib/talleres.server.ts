import { normalizeSupabaseUrl } from "./supabase-env";

export type TallerFidelizado = {
  whatsapp: string;
  nombreTaller: string;
  descuentoPorcentaje: number;
  contraEntregaHabilitada: boolean;
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

export function normalizeWhatsapp(raw: string): string {
  return raw.replace(/\D/g, "");
}

type TallerRow = {
  whatsapp: string;
  nombre_taller: string;
  descuento_porcentaje: number;
  contra_entrega_habilitada: boolean;
  activo: boolean;
};

export async function getTallerFidelizadoByWhatsapp(
  rawWhatsapp: string,
): Promise<TallerFidelizado | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const whatsapp = normalizeWhatsapp(rawWhatsapp);
  if (!whatsapp) return null;

  const url = new URL(`${env.url}/rest/v1/talleres_fidelizados`);
  url.searchParams.set(
    "select",
    "whatsapp,nombre_taller,descuento_porcentaje,contra_entrega_habilitada,activo",
  );
  url.searchParams.set("whatsapp", `eq.${whatsapp}`);
  url.searchParams.set("activo", "eq.true");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
    },
  });

  if (!res.ok) return null;
  const rows = (await res.json()) as TallerRow[];
  const row = rows[0];
  if (!row || !row.activo) return null;

  return {
    whatsapp: row.whatsapp,
    nombreTaller: row.nombre_taller,
    descuentoPorcentaje: Number(row.descuento_porcentaje ?? 0),
    contraEntregaHabilitada: Boolean(row.contra_entrega_habilitada),
  };
}
