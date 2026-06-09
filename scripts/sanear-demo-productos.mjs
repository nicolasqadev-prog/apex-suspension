/**
 * Desactiva en Supabase los productos demo de inventario.ejemplo.json.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
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
    if (!process.env[k]) process.env[k] = v;
  }
}

let url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
url = url.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Faltan credenciales Supabase");
  process.exit(1);
}

const ejemplo = JSON.parse(readFileSync(join(root, "data/inventario.ejemplo.json"), "utf8"));
const slugs = ejemplo.piezas.map((p) => p.slug);
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

let desactivados = 0;
for (const slug of slugs) {
  const res = await fetch(`${url}/rest/v1/productos?slug=eq.${encodeURIComponent(slug)}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ activo: false }),
  });
  if (res.ok) {
    const rows = await res.json();
    if (rows.length) desactivados += 1;
  }
}

console.log(JSON.stringify({ slugsDemo: slugs.length, desactivados }, null, 2));
