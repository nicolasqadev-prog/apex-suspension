/**
 * Sincroniza secretos de .env.local al Worker en Cloudflare (producción).
 * Necesario si desplegás con `npm run deploy` local (no pasa por GitHub Actions).
 *
 * Uso: node scripts/sync-cloudflare-secrets.mjs
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "./parse-env-local.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
const wranglerConfig = join(root, "dist/server/wrangler.json");

if (!existsSync(wranglerConfig)) {
  console.error("Primero: npm run build");
  process.exit(1);
}

const env = loadEnvLocal(envPath);

if (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

if (!env.VITE_SITE_URL?.trim()) {
  env.VITE_SITE_URL = "https://apex-suspension.com.co";
}

const adminWa = env.APEX_ADMIN_WHATSAPP?.trim() || env.VITE_WHATSAPP_APEX?.trim() || "";
if (adminWa) {
  env.APEX_ADMIN_WHATSAPP = adminWa;
  env.WHATSAPP_APEX = adminWa;
}

const SECRETS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SITE_URL",
  "ADMIN_PIN",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "VITE_WHATSAPP_APEX",
  "WHATSAPP_APEX",
  "APEX_ADMIN_WHATSAPP",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_VERIFY_TOKEN",
  "GROQ_API_KEY",
];

for (const name of SECRETS) {
  let value = env[name]?.trim();
  if (!value) continue;
  if (name === "WHATSAPP_PHONE_NUMBER_ID") {
    value = value.replace(/\D/g, "");
  } else if (
    name === "WHATSAPP_ACCESS_TOKEN" ||
    name === "WHATSAPP_VERIFY_TOKEN" ||
    name === "GROQ_API_KEY"
  ) {
    const cleaned = value.replace(/[^\x20-\x7E]/g, "").trim();
    if (cleaned.length !== value.length) {
      console.warn(`AVISO: ${name} tenía caracteres raros; se limpiaron al subir.`);
    }
    value = cleaned;
  }
  const r = spawnSync("npx", ["wrangler", "secret", "put", name, "--config", wranglerConfig], {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
    shell: true,
    cwd: root,
  });
  if (r.status !== 0) {
    console.error(`Falló secret put: ${name}`);
    process.exit(1);
  }
  console.log(`OK: ${name}`);
}

console.log("\nSecretos sincronizados. Probá https://apex-suspension.com.co/catalogo (Ctrl+F5)");
