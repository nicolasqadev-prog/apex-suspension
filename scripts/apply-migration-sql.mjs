/**
 * Aplica migración SQL en Supabase (DDL).
 * Requiere DATABASE_URL o DIRECT_URL en .env.local (Connection string del proyecto).
 *
 * Uso: node scripts/apply-migration-sql.mjs [ruta-al-archivo.sql]
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

const sqlFile =
  process.argv[2] ||
  join(root, "supabase/migrations/20260609120000_productos_datos_maestros.sql");
const sql = readFileSync(sqlFile, "utf8");
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1];
let dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD?.trim();
if (!dbUrl && dbPassword && projectRef) {
  const host = process.env.SUPABASE_DB_HOST?.trim() || `aws-0-us-east-1.pooler.supabase.com`;
  dbUrl = `postgresql://postgres.${projectRef}:${encodeURIComponent(dbPassword)}@${host}:6543/postgres`;
}

async function viaManagementApi() {
  if (!accessToken || !projectRef) return null;
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${body.slice(0, 400)}`);
  }
  return { via: "management_api", projectRef };
}

if (!dbUrl) {
  try {
    const mgmt = await viaManagementApi();
    if (mgmt) {
      console.log(JSON.stringify({ ok: true, ...mgmt, archivo: sqlFile }, null, 2));
      process.exit(0);
    }
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: String(e) }, null, 2));
    process.exit(1);
  }
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: "Falta DATABASE_URL, DIRECT_URL o SUPABASE_ACCESS_TOKEN en .env.local",
        alternativa: "Ejecutá el SQL manualmente en Supabase → SQL Editor:",
        archivo: sqlFile,
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

let pg;
try {
  pg = (await import("pg")).default;
} catch {
  console.error("Instalá pg: npm install pg --no-save");
  process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query(sql);
  console.log(JSON.stringify({ ok: true, archivo: sqlFile }, null, 2));
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: String(e) }, null, 2));
  process.exit(1);
} finally {
  await client.end();
}
