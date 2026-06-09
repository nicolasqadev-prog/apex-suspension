import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq <= 0) continue;
  process.env[t.slice(0, eq).trim()] = t
    .slice(eq + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}
const url = process.env.SUPABASE_URL?.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const ref = url?.match(/https:\/\/([^.]+)\.supabase\.co/i)?.[1];
console.log(ref || "unknown");
