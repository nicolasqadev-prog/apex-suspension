/** Actualiza descuento_porcentaje a 16.67 en todos los talleres fidelizados activos. */
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
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const DESCUENTO = 16.67;

const get = await fetch(
  `${url}/rest/v1/talleres_fidelizados?select=whatsapp,nombre_taller,descuento_porcentaje`,
  {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  },
);

if (!get.ok) {
  console.log(
    JSON.stringify({
      actualizados: 0,
      nota: "Sin talleres o tabla no accesible",
      status: get.status,
    }),
  );
  process.exit(0);
}

const talleres = await get.json();
let actualizados = 0;
for (const t of talleres) {
  const res = await fetch(
    `${url}/rest/v1/talleres_fidelizados?whatsapp=eq.${encodeURIComponent(t.whatsapp)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ descuento_porcentaje: DESCUENTO }),
    },
  );
  if (res.ok) actualizados += 1;
}

console.log(
  JSON.stringify({ talleres: talleres.length, actualizados, descuento: DESCUENTO }, null, 2),
);
