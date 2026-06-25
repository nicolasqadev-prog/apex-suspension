/**
 * Diagnóstico completo WhatsApp: Meta API + envío directo al tester.
 * Uso: node scripts/diagnose-whatsapp-meta.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "./parse-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnvLocal(join(root, ".env.local"));
const GRAPH = "https://graph.facebook.com/v25.0";

const token = env.WHATSAPP_ACCESS_TOKEN?.replace(/[^\x20-\x7E]/g, "").trim();
const phoneId = env.WHATSAPP_PHONE_NUMBER_ID?.replace(/\D/g, "");
const wabaId = "1728318625058311";
const tester = "573171687777";

if (!token || !phoneId) {
  console.error("Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID en .env.local");
  process.exit(1);
}

async function api(path, opts = {}) {
  const res = await fetch(`${GRAPH}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, json };
}

console.log("=== Diagnóstico WhatsApp Meta ===\n");

const phone = await api(`/${phoneId}?fields=display_phone_number,verified_name`);
console.log("1) Phone Number ID:", phone.ok ? "OK" : `ERROR ${phone.status}`);
if (phone.ok) console.log(`   Línea: ${phone.json.display_phone_number}`);

const subs = await api(`/${wabaId}/subscribed_apps`);
console.log("\n2) App suscrita al WABA:", subs.ok ? "OK" : `ERROR ${subs.status}`);
if (subs.ok) {
  const apps = subs.json.data ?? [];
  console.log(`   Apps suscritas: ${apps.length}`);
  for (const a of apps) console.log(`   - ${a.whatsapp_business_api_data?.id ?? a.id ?? JSON.stringify(a)}`);
  if (apps.length === 0) {
    console.log("\n   PROBLEMA: ninguna app suscrita. Meta NO manda webhooks de mensajes.");
    console.log("   Solución: Meta → WhatsApp → Configuración → suscribir app al WABA.");
  }
}

const send = await api(`/${phoneId}/messages`, {
  method: "POST",
  body: JSON.stringify({
    messaging_product: "whatsapp",
    to: tester,
    type: "text",
    text: {
      body: "Prueba Apex bot — si ves esto, el envío desde Cloudflare funciona. Responde con: bieleta Aveo 2015",
    },
  }),
});

console.log("\n3) Envío directo al 317:", send.ok ? "OK" : `ERROR ${send.status}`);
if (!send.ok) console.log(JSON.stringify(send.json, null, 2));
else console.log(`   message_id: ${send.json.messages?.[0]?.id ?? "—"}`);

console.log("\n4) Webhook producción:");
console.log("   https://apex-suspension.com.co/api/whatsapp/webhook");
console.log("   Si el paso 3 OK pero el bot no contesta a tus mensajes, Meta no está");
console.log("   llamando al webhook cuando escribes. Revisa suscripción campo 'messages'.");
