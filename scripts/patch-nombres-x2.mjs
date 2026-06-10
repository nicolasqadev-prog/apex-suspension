/**
 * Actualiza solo nombre/aplicacion de las 5 refs que tenían (x2) confuso.
 * Uso: node scripts/patch-nombres-x2.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvLocal() {
  const p = join(root, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const REFS = ["KSA-RE018", "KSA-HY016", "KSA-RE028", "KSA-RE029", "KBJ-4008"];

let url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
url = url.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(join(root, "data/inventario-catalogo-completo.json"), "utf8"));
const byRef = Object.fromEntries(
  catalog.piezas.filter((p) => REFS.includes(p.referencia)).map((p) => [p.referencia, p]),
);

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

for (const ref of REFS) {
  const p = byRef[ref];
  if (!p) {
    console.error(`No encontrado en JSON: ${ref}`);
    process.exit(1);
  }
  const res = await fetch(`${url}/rest/v1/productos?referencia=eq.${encodeURIComponent(ref)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ nombre: p.nombre, aplicacion: p.aplicacion }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`FAIL ${ref}: ${res.status} ${text}`);
    process.exit(1);
  }
  const rows = JSON.parse(text || "[]");
  console.log(`OK ${ref} → ${rows[0]?.nombre ?? p.nombre}`);
}
