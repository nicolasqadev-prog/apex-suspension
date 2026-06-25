/**
 * Prueba el webhook de producción (simula POST de Meta) y valida Meta API.
 * Uso: node scripts/test-webhook-produccion.mjs [mensaje]
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "./parse-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnvLocal(join(root, ".env.local"));
const WEBHOOK = "https://apex-suspension.com.co/api/whatsapp/webhook";
const tester = "573171687777";
const body = process.argv[2]?.trim() || "cancelar";

const phoneId = env.WHATSAPP_PHONE_NUMBER_ID?.replace(/\D/g, "");
const verifyToken = env.WHATSAPP_VERIFY_TOKEN?.replace(/[^\x20-\x7E]/g, "").trim();

console.log("=== Test webhook producción ===\n");
console.log("URL:", WEBHOOK);
console.log("Mensaje simulado:", body);
console.log("Destino WhatsApp:", tester, "\n");

// 1) GET verify (debe 403 sin token correcto, 200 con token)
const getBad = await fetch(`${WEBHOOK}?hub.mode=subscribe&hub.verify_token=mal&hub.challenge=999`);
console.log("1) GET verify (token malo):", getBad.status, getBad.status === 403 ? "OK" : "REVISAR");

if (verifyToken) {
  const getOk = await fetch(
    `${WEBHOOK}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=999`,
  );
  const challenge = await getOk.text();
  console.log(
    "2) GET verify (token bueno):",
    getOk.status,
    challenge === "999" ? "OK — ruta viva" : `respuesta: ${challenge.slice(0, 80)}`,
  );
}

// 2) POST mensaje
const payload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "1728318625058311",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15556445668",
              phone_number_id: phoneId,
            },
            contacts: [{ profile: { name: "Test" }, wa_id: tester }],
            messages: [
              {
                from: tester,
                id: `wamid.test_${Date.now()}`,
                timestamp: String(Math.floor(Date.now() / 1000)),
                type: "text",
                text: { body },
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
console.log("\n3) POST webhook:", post.status, `(${Date.now() - t0} ms)`);
console.log("   ", postBody);

console.log("\nSi POST=200 y en ~5-30s recibes respuesta en WhatsApp, el bot está OK.");
console.log("Si POST=200 pero no llega mensaje → revisa logs Cloudflare o token Meta.");
console.log("Si POST≠200 → dominio no llega al Worker.\n");
