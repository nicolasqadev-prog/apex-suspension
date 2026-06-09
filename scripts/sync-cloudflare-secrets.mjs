/**
 * Sincroniza secretos de .env.local al Worker en Cloudflare (producción).
 * Necesario si desplegás con `npm run deploy` local (no pasa por GitHub Actions).
 *
 * Uso: node scripts/sync-cloudflare-secrets.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
const wranglerConfig = join(root, "dist/server/wrangler.json");

if (!existsSync(wranglerConfig)) {
  console.error("Primero: npm run build");
  process.exit(1);
}

const env = {};
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
}

if (!env.SUPABASE_URL?.trim() || !env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

if (!env.VITE_SITE_URL?.trim()) {
  env.VITE_SITE_URL = "https://apex-suspension.com.co";
}

const SECRETS = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "VITE_SITE_URL"];
if (env.ADMIN_PIN?.trim()) SECRETS.push("ADMIN_PIN");

for (const name of SECRETS) {
  const r = spawnSync("npx", ["wrangler", "secret", "put", name, "--config", wranglerConfig], {
    input: env[name],
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
