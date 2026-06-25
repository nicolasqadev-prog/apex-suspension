/**
 * Valida WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID contra Meta Graph API.
 * Lee .env.local (no sube secretos a ningún sitio).
 *
 * Uso: node scripts/validate-whatsapp-meta.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "./parse-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");

function sanitizeAsciiSecret(raw) {
  if (!raw) return "";
  return raw.replace(/[^\x20-\x7E]/g, "").trim();
}

function sanitizePhoneNumberId(raw) {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}

const env = loadEnvLocal(envPath);
const rawToken = env.WHATSAPP_ACCESS_TOKEN ?? "";
const rawPhoneId = env.WHATSAPP_PHONE_NUMBER_ID ?? "";
const token = sanitizeAsciiSecret(rawToken);
const phoneId = sanitizePhoneNumberId(rawPhoneId);
const groq = sanitizeAsciiSecret(env.GROQ_API_KEY);

console.log("--- Validación WhatsApp Cloud API ---\n");

if (!token) {
  console.error("FALTA: WHATSAPP_ACCESS_TOKEN en .env.local");
  process.exit(1);
}
if (!phoneId) {
  console.error("FALTA: WHATSAPP_PHONE_NUMBER_ID en .env.local");
  process.exit(1);
}
if (!groq) {
  console.error("FALTA: GROQ_API_KEY en .env.local");
  process.exit(1);
}

if (rawToken.includes("#") || /\s+#\s/.test(rawToken)) {
  console.error("ERROR: el token tiene un comentario inline en .env.local");
  console.error("Quita todo lo que va después de espacio + # en esa línea.");
  process.exit(1);
}

console.log(`Phone Number ID: …${phoneId.slice(-4)} (${phoneId.length} dígitos)`);
console.log("Groq: OK\n");

const url = `https://graph.facebook.com/v25.0/${phoneId}?fields=display_phone_number,verified_name,quality_rating`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const body = await res.text();

if (!res.ok) {
  console.error(`META ERROR HTTP ${res.status}`);
  console.error(body.slice(0, 400));
  if (res.status === 404 || body.includes("does not exist")) {
    console.error("\nEl Phone Number ID está mal. Copialo EXACTO del curl en Meta API Setup.");
  }
  if (body.includes("error_subcode\":33") || body.includes("missing permissions")) {
    console.error(
      "\nEl token es válido pero NO pertenece a la misma app/número.",
    );
    console.error("En Meta → API Setup: Generar token NUEVO y copiar Phone ID del curl de ESA misma pantalla.");
  }
  if (res.status === 401 || body.includes("OAuthException")) {
    console.error("\nEl access token expiró o es inválido. Genera uno nuevo en Meta API Setup.");
  }
  process.exit(1);
}

const data = JSON.parse(body);
console.log("META OK");
console.log(`  Número en Meta: ${data.display_phone_number ?? "—"}`);
console.log(`  Nombre: ${data.verified_name ?? "—"}`);
console.log("\nSiguiente: npm run secrets:cloudflare");
console.log("Luego escribe al +1 555 644-5668 desde tu 317.");
