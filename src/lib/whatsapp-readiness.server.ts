import { whatsappSendConfig } from "./whatsapp-cloud.server";

const GRAPH = "https://graph.facebook.com/v25.0";

export type WhatsAppReadiness = {
  secretsOk: boolean;
  groqOk: boolean;
  verifyTokenOk: boolean;
  phoneNumberIdMascara: string | null;
  metaConectado: boolean;
  metaDetalle: string;
  numeroMeta: string | null;
};

/** Comprueba secretos y conexión con Meta (GET phone number). */
export async function estadoWhatsAppBot(): Promise<WhatsAppReadiness> {
  const send = whatsappSendConfig();
  const groqOk = Boolean(process.env.GROQ_API_KEY?.trim());
  const verifyTokenOk = Boolean(process.env.WHATSAPP_VERIFY_TOKEN?.trim());
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";
  const phoneNumberIdMascara = phoneId ? `…${phoneId.slice(-4)}` : null;

  const base: WhatsAppReadiness = {
    secretsOk: Boolean(send),
    groqOk,
    verifyTokenOk,
    phoneNumberIdMascara,
    metaConectado: false,
    metaDetalle: "sin_probar",
    numeroMeta: null,
  };

  if (!send) {
    base.metaDetalle = !groqOk
      ? "faltan_token_o_phone_id_y_groq"
      : "faltan_whatsapp_access_token_o_phone_number_id";
    return base;
  }

  if (!groqOk) {
    base.metaDetalle = "falta_groq_api_key";
    return base;
  }

  try {
    const res = await fetch(
      `${GRAPH}/${send.phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${send.token}` } },
    );
    if (!res.ok) {
      const err = await res.text().catch(() => "");
      base.metaDetalle =
        res.status === 401 || res.status === 190
          ? "token_meta_invalido_o_expirado"
          : res.status === 404
            ? "phone_number_id_incorrecto"
            : `meta_http_${res.status}`;
      if (err.includes("does not exist")) base.metaDetalle = "phone_number_id_incorrecto";
      return base;
    }

    const data = (await res.json()) as {
      display_phone_number?: string;
      verified_name?: string;
    };
    base.metaConectado = true;
    base.metaDetalle = "ok";
    base.numeroMeta = data.display_phone_number?.trim() || null;
    return base;
  } catch {
    base.metaDetalle = "error_red_meta";
    return base;
  }
}
