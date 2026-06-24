/**
 * Cliente WhatsApp Cloud API (Meta).
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export function whatsappCloudConfig():
  | { token: string; phoneNumberId: string; verifyToken: string }
  | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (!token || !phoneNumberId || !verifyToken) return null;
  return { token, phoneNumberId, verifyToken };
}

export function verificarWebhookChallenge(
  mode: string | null,
  token: string | null,
  challenge: string | null,
): string | null {
  const cfg = whatsappCloudConfig();
  if (!cfg) return null;
  if (mode === "subscribe" && token === cfg.verifyToken && challenge) {
    return challenge;
  }
  return null;
}

export async function enviarTextoWhatsApp(to: string, body: string): Promise<boolean> {
  const cfg = whatsappCloudConfig();
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
