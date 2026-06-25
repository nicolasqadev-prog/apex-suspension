/**
 * Suscribe la app al WABA con URL de webhook explícita (fix entrega de mensajes).
 * Uso: node scripts/subscribe-whatsapp-webhook.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "./parse-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnvLocal(join(root, ".env.local"));

const token = env.WHATSAPP_ACCESS_TOKEN?.replace(/[^\x20-\x7E]/g, "").trim();
const verifyToken = env.WHATSAPP_VERIFY_TOKEN?.replace(/[^\x20-\x7E]/g, "").trim();
const wabaId = "1728318625058311";
const callbackUrl = "https://apex-suspension.com.co/api/whatsapp/webhook";

if (!token || !verifyToken) {
  console.error("Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_VERIFY_TOKEN en .env.local");
  process.exit(1);
}

const res = await fetch(`https://graph.facebook.com/v25.0/${wabaId}/subscribed_apps`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    override_callback_uri: callbackUrl,
    verify_token: verifyToken,
  }),
});

const body = await res.text();
console.log(`HTTP ${res.status}`);
console.log(body);

if (res.ok) {
  console.log("\nOK: WABA suscrito al webhook de producción.");
  console.log("Escribe ahora al +1 555 644-5668 desde tu 317.");
} else {
  console.error("\nFalló. Verifica token y permisos whatsapp_business_management.");
}
