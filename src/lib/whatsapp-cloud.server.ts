/**
 * Cliente WhatsApp Cloud API (Meta).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import { sanitizeAsciiSecret, sanitizePhoneNumberId } from "./env-sanitize";

const GRAPH = "https://graph.facebook.com/v25.0";

export function whatsappSendConfig(): { token: string; phoneNumberId: string } | null {
  const token = sanitizeAsciiSecret(process.env.WHATSAPP_ACCESS_TOKEN);
  const phoneNumberId = sanitizePhoneNumberId(process.env.WHATSAPP_PHONE_NUMBER_ID);
  if (!token || !phoneNumberId) {
    if (!token) console.error("WhatsApp send: falta WHATSAPP_ACCESS_TOKEN");
    if (!phoneNumberId) console.error("WhatsApp send: falta WHATSAPP_PHONE_NUMBER_ID");
    return null;
  }
  return { token, phoneNumberId };
}

export function whatsappCloudConfig(): {
  token: string;
  phoneNumberId: string;
  verifyToken: string;
} | null {
  const send = whatsappSendConfig();
  const verifyToken = sanitizeAsciiSecret(process.env.WHATSAPP_VERIFY_TOKEN);
  if (!send || !verifyToken) return null;
  return { ...send, verifyToken };
}

export function verificarWebhookChallenge(
  mode: string | null,
  token: string | null,
  challenge: string | null,
): string | null {
  // Solo hace falta el verify token para el GET de Meta (no el access token).
  const verifyToken = sanitizeAsciiSecret(process.env.WHATSAPP_VERIFY_TOKEN);
  if (!verifyToken) return null;
  if (mode === "subscribe" && token === verifyToken && challenge) {
    return challenge;
  }
  return null;
}

export async function enviarTextoWhatsApp(to: string, body: string): Promise<boolean> {
  const cfg = whatsappSendConfig();
  if (!cfg) return false;

  const toDigits = to.replace(/\D/g, "");
  const text = body.slice(0, 4090);

  const res = await fetch(`${GRAPH}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toDigits,
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("WhatsApp send failed:", res.status, err.slice(0, 300));
    return false;
  }
  return true;
}

type WaIncomingText = {
  from: string;
  messageId: string;
  body: string;
  contactName?: string;
};

/** Extrae mensajes de texto del payload del webhook de Meta. */
export function parsearMensajesEntrantes(payload: unknown): WaIncomingText[] {
  const out: WaIncomingText[] = [];
  if (!payload || typeof payload !== "object") return out;

  const obj = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{
            from?: string;
            id?: string;
            type?: string;
            text?: { body?: string };
          }>;
          contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        };
      }>;
    }>;
  };

  for (const entry of obj.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const contactName = value?.contacts?.[0]?.profile?.name;
      for (const msg of value?.messages ?? []) {
        if (msg.type !== "text" || !msg.from || !msg.text?.body) continue;
        out.push({
          from: msg.from,
          messageId: msg.id ?? "",
          body: msg.text.body.trim(),
          contactName,
        });
      }
    }
  }
  return out;
}
