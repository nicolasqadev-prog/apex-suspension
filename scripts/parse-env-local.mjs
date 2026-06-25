import { existsSync, readFileSync } from "node:fs";

/** Quita comentarios inline (` # ...`) en valores sin comillas. */
export function parseEnvLineValue(rawValue) {
  let v = rawValue.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  const hash = v.indexOf(" #");
  if (hash >= 0) v = v.slice(0, hash);
  return v.trim();
}

export function loadEnvLocal(envPath) {
  const env = {};
  if (!existsSync(envPath)) return env;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    env[t.slice(0, eq).trim()] = parseEnvLineValue(t.slice(eq + 1));
  }
  return env;
}
