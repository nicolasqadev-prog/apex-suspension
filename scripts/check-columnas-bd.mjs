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

const url = process.env.SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.log(JSON.stringify({ ok: false, error: "Faltan credenciales Supabase" }));
  process.exit(1);
}

const cols = "marca_producto,linea_vehiculo,precio_taller,categoria_grupo";
const res = await fetch(`${url}/rest/v1/productos?select=${cols}&limit=1`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
});
const text = await res.text();
console.log(JSON.stringify({ status: res.status, body: text.slice(0, 400) }, null, 2));
