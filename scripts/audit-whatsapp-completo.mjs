/**
 * Auditoría definitiva WhatsApp: token, Meta config, webhook producción, código.
 * Uso: node scripts/audit-whatsapp-completo.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import { loadEnvLocal } from "./parse-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnvLocal(join(root, ".env.local"));
const GRAPH = "https://graph.facebook.com/v25.0";
const WEBHOOK = "https://apex-suspension.com.co/api/whatsapp/webhook";
const WABA_ID = "1728318625058311";
const APP_ID = env.META_APP_ID?.trim() || "1019859547408341";
const tester = "573171687777";

const token = env.WHATSAPP_ACCESS_TOKEN?.replace(/[^\x20-\x7E]/g, "").trim();
const verifyToken = env.WHATSAPP_VERIFY_TOKEN?.replace(/[^\x20-\x7E]/g, "").trim();
const phoneId = env.WHATSAPP_PHONE_NUMBER_ID?.replace(/\D/g, "");
const appSecret = env.META_APP_SECRET?.replace(/[^\x20-\x7E]/g, "").trim();

const results = [];
function pass(msg) {
  results.push({ ok: true, msg });
  console.log("✓", msg);
}
function fail(msg) {
  results.push({ ok: false, msg });
  console.log("✗", msg);
}
function section(t) {
  console.log("\n──", t, "──");
}

if (!token || !phoneId || !verifyToken) {
  console.error("Faltan WHATSAPP_* en .env.local");
  process.exit(1);
}

const h = { Authorization: `Bearer ${token}` };

section("1. Token Meta");
const dbg = await fetch(`${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}`, { headers: h });
const dbgJson = await dbg.json();
const info = dbgJson.data?.data ?? dbgJson.data;
if (!info?.is_valid) fail("Token inválido");
else pass(`Token válido (${info.type}, app: ${info.application})`);
if (info?.expires_at === 0) pass("Token PERMANENTE (system user, no expira cada 24h)");
else fail(`Token TEMPORAL — expira ${new Date(info.expires_at * 1000).toISOString()}`);

section("2. Número y webhook en Meta");
const phoneRes = await fetch(
  `${GRAPH}/${phoneId}?fields=display_phone_number,status,webhook_configuration`,
  { headers: h },
);
const phone = await phoneRes.json();
if (phoneRes.ok) {
  pass(`Número ${phone.display_phone_number} (${phone.status})`);
  const wh = phone.webhook_configuration;
  if (wh?.application?.includes("apex-suspension.com.co")) pass("Webhook URL en número → app: OK");
  else fail(`Webhook URL número: ${wh?.application ?? "—"}`);
} else fail(`No se pudo leer número: ${phoneRes.status}`);

section("3. WABA suscrito a apps");
const subsRes = await fetch(`${GRAPH}/${WABA_ID}/subscribed_apps`, { headers: h });
const subs = await subsRes.json();
const apps = subs.data ?? [];
pass(`${apps.length} app(s) en WABA`);
const apexApp = apps.find((a) => a.whatsapp_business_api_data?.id === APP_ID);
if (apexApp?.override_callback_uri?.includes("apex-suspension.com.co")) {
  pass(`App apex suspension → override_callback_uri OK`);
} else if (apexApp) {
  fail(`App apex sin override_callback_uri (usa callback del dashboard)`);
} else {
  fail("App apex suspension NO está en subscribed_apps del WABA");
}
const devx = apps.find((a) => a.whatsapp_business_api_data?.name?.includes("DevX"));
if (devx) fail("App WA DevX también suscrita — puede robar eventos webhook");

section("4. Campo messages (suscripción app)");
if (appSecret) {
  const appToken = `${APP_ID}|${appSecret}`;
  const subList = await fetch(`${GRAPH}/${APP_ID}/subscriptions?access_token=${appToken}`);
  const subJson = await subList.json();
  const waSub = (subJson.data ?? []).find((s) => s.object === "whatsapp_business_account");
  if (waSub?.fields?.includes("messages")) pass("Campo messages SUSCRITO vía API");
  else {
    fail("Campo messages NO suscrito — Meta no envía mensajes entrantes");
    const subPost = await fetch(`${GRAPH}/${APP_ID}/subscriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        access_token: appToken,
        object: "whatsapp_business_account",
        callback_url: WEBHOOK,
        verify_token: verifyToken,
        fields: "messages",
        include_values: "true",
      }),
    });
    const subText = await subPost.text();
    if (subPost.ok) pass("Suscripción messages aplicada automáticamente");
    else fail(`No se pudo suscribir messages: ${subPost.status} ${subText.slice(0, 200)}`);
  }
} else {
  fail("META_APP_SECRET no en .env.local — no puedo verificar/suscribir campo messages por API");
  console.log("  → Actívalo manual en Meta → WhatsApp → Configuration → Webhook fields → messages");
}

section("5. Webhook producción (GET verify)");
const getOk = await fetch(
  `${WEBHOOK}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=audit123`,
);
if (getOk.status === 200 && (await getOk.text()) === "audit123") pass("GET verify en Cloudflare: OK");
else fail(`GET verify falló: ${getOk.status}`);

section("6. Webhook producción (POST + envío real)");
const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: WABA_ID,
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { display_phone_number: "15556445668", phone_number_id: phoneId },
            contacts: [{ profile: { name: "Audit" }, wa_id: tester }],
            messages: [
              {
                from: tester,
                id: `wamid.audit_${Date.now()}`,
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body: "cancelar" },
              },
            ],
          },
        },
      ],
    },
  ],
};
const t0 = Date.now();
const post = await fetch(WEBHOOK, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const postBody = await post.text();
const ms = Date.now() - t0;
if (post.status === 200 && postBody.includes('"processed":1')) {
  pass(`POST webhook procesó mensaje (${ms} ms)`);
  console.log(
    "  Revisa logs Cloudflare: debe decir 'WhatsApp agent:' (OK) y NO 'WhatsApp send failed: 401'",
  );
  console.log("  Si ves 401 → corre: npm run secrets:cloudflare (token en Worker ≠ .env.local)");
} else fail(`POST webhook: ${post.status} ${postBody.slice(0, 120)}`);

section("7. Código — parseo payload Meta");
// Inline copy of parsearMensajesEntrantes logic check
const parsed = payload.entry[0].changes[0].value.messages
  .filter((m) => m.type === "text" && m.from && m.text?.body)
  .map((m) => ({ from: m.from, body: m.text.body.trim() }));
if (parsed.length === 1 && parsed[0].body === "cancelar") pass("parsearMensajesEntrantes: payload estándar OK");
else fail("parsearMensajesEntrantes: fallaría con payload Meta estándar");

section("8. Código — flujo server.ts");
const serverTs = readFileSync(join(root, "src/server.ts"), "utf8");
if (serverTs.includes('path === "/api/whatsapp/webhook"')) pass("server.ts intercepta webhook ANTES de TanStack");
else fail("server.ts NO intercepta webhook — producción podría usar ruta incorrecta");

const httpTs = readFileSync(join(root, "src/lib/whatsapp-webhook-http.server.ts"), "utf8");
if (httpTs.includes("await Promise.race") && httpTs.includes("procesarMensajeWhatsAppEntrante")) {
  pass("whatsapp-webhook-http: await procesamiento + timeout 22s");
} else fail("whatsapp-webhook-http: flujo de procesamiento incompleto");

section("RESUMEN");
const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length} OK, ${fails.length} fallos`);
if (fails.length === 0) {
  console.log("\nSistema listo. Escribe 'hola' al +1 555 644-5668.");
} else {
  console.log("\nFallos que bloquean mensajes reales:");
  for (const f of fails) console.log(" •", f.msg);
  process.exit(1);
}
