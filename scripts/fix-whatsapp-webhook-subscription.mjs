/**
 * Diagnóstico y reparación de suscripción webhook WhatsApp (Meta).
 *
 * Problema típico: envío directo funciona pero el bot no contesta mensajes reales
 * porque falta suscribir el campo `messages` en la app de Meta.
 *
 * Uso:
 *   node scripts/fix-whatsapp-webhook-subscription.mjs
 *
 * Requiere en .env.local:
 *   WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN
 *   META_APP_SECRET (para suscribir campo messages vía API)
 * Opcional: META_APP_ID (default 1019859547408341)
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "./parse-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnvLocal(join(root, ".env.local"));
const GRAPH = "https://graph.facebook.com/v25.0";

const token = env.WHATSAPP_ACCESS_TOKEN?.replace(/[^\x20-\x7E]/g, "").trim();
const verifyToken = env.WHATSAPP_VERIFY_TOKEN?.replace(/[^\x20-\x7E]/g, "").trim();
const phoneId = env.WHATSAPP_PHONE_NUMBER_ID?.replace(/\D/g, "");
const appId = env.META_APP_ID?.trim() || "1019859547408341";
const appSecret = env.META_APP_SECRET?.replace(/[^\x20-\x7E]/g, "").trim();
const wabaId = "1728318625058311";
const callbackUrl = "https://apex-suspension.com.co/api/whatsapp/webhook";

if (!token || !verifyToken) {
  console.error("Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_VERIFY_TOKEN en .env.local");
  process.exit(1);
}

const userHeaders = { Authorization: `Bearer ${token}` };

async function api(path, opts = {}) {
  const res = await fetch(`${GRAPH}${path}`, {
    ...opts,
    headers: { ...userHeaders, ...(opts.headers ?? {}) },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 600) };
  }
  return { ok: res.ok, status: res.status, json, text };
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

printSection("Diagnóstico webhook WhatsApp");
console.log("Callback URL:", callbackUrl);
console.log("App ID:", appId);
console.log("META_APP_SECRET:", appSecret ? "configurado" : "FALTA — ver paso manual abajo");

const phone = await api(
  `/${phoneId}?fields=display_phone_number,verified_name,status,webhook_configuration`,
);
if (phone.ok) {
  console.log("\nNúmero:", phone.json.display_phone_number, `(${phone.json.status})`);
  const wh = phone.json.webhook_configuration;
  if (wh) {
    console.log("Webhook en número → app:", wh.application ?? "—");
    console.log("Webhook en número → WABA:", wh.whatsapp_business_account ?? "—");
  }
} else {
  console.log("Error leyendo número:", phone.status, phone.text.slice(0, 200));
}

const subs = await api(`/${wabaId}/subscribed_apps`);
if (subs.ok) {
  const apps = subs.json.data ?? [];
  console.log(`\nApps suscritas al WABA: ${apps.length}`);
  for (const row of apps) {
    const meta = row.whatsapp_business_api_data ?? row;
    const override = row.override_callback_uri;
    console.log(`  • ${meta.name ?? meta.id} (${meta.id})`);
    if (override) console.log(`    override_callback_uri: ${override}`);
    else console.log("    sin override (usa callback de esa app)");
  }
  if (apps.length > 1) {
    console.log(
      "\n  AVISO: hay más de una app suscrita. Si una es 'WA DevX', puede interferir.",
    );
  }
}

printSection("Paso 1 — WABA → app (override_callback_uri)");
const wabaPost = await api(`/${wabaId}/subscribed_apps`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    override_callback_uri: callbackUrl,
    verify_token: verifyToken,
  }),
});
console.log("POST subscribed_apps:", wabaPost.status, wabaPost.ok ? "OK" : wabaPost.text.slice(0, 300));

printSection("Paso 2 — Campo `messages` en la app");

if (!appSecret) {
  console.log(`
No hay META_APP_SECRET en .env.local — no se puede suscribir vía API.

Hazlo manualmente (2 minutos):
  1. https://developers.facebook.com/apps/${appId}/whatsapp-business/wa-settings/
  2. WhatsApp → Configuration (Configuración)
  3. Webhook → Edit
  4. Callback URL: ${callbackUrl}
  5. Verify token: (el mismo que WHATSAPP_VERIFY_TOKEN)
  6. En "Webhook fields", activa **messages** → Subscribe

Luego agrega a .env.local:
  META_APP_ID=${appId}
  META_APP_SECRET=tu_app_secret_desde_Meta_Basic_Settings

Y vuelve a correr este script.
`);
} else {
  const appToken = `${appId}|${appSecret}`;

  const listSubs = await fetch(`${GRAPH}/${appId}/subscriptions?access_token=${appToken}`);
  const listText = await listSubs.text();
  console.log("GET subscriptions:", listSubs.status);
  try {
    const parsed = JSON.parse(listText);
    const rows = parsed.data ?? [];
    if (rows.length === 0) console.log("  (ninguna suscripción de campos — PROBLEMA probable)");
    for (const row of rows) {
      console.log(`  object=${row.object} callback=${row.callback_url} fields=${(row.fields ?? []).join(",")}`);
    }
  } catch {
    console.log(" ", listText.slice(0, 400));
  }

  const subRes = await fetch(`${GRAPH}/${appId}/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      access_token: appToken,
      object: "whatsapp_business_account",
      callback_url: callbackUrl,
      verify_token: verifyToken,
      fields: "messages",
      include_values: "true",
    }),
  });
  const subText = await subRes.text();
  console.log("\nPOST subscriptions (messages):", subRes.status, subText.slice(0, 400));
}

printSection("Paso 3 — Probar");
console.log(`
1. Escribe "hola" al +1 555 644-5668 desde tu 317.
2. O simula: npm run test:webhook-prod -- "hola"

Si el paso 2 te responde en WhatsApp pero escribir al bot no → falta campo messages (paso manual).
`);
