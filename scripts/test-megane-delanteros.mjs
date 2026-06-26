import { loadEnvLocal } from "./parse-env-local.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ejecutarTurnoAgenteWhatsApp } from "../src/lib/whatsapp-agent/orchestrator.server.ts";
import { freshWaSession } from "../src/lib/whatsapp-agent/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const [k, v] of Object.entries(loadEnvLocal(join(root, ".env.local")))) {
  if (!process.env[k]) process.env[k] = v;
}

const session = freshWaSession();
const phone = "573171687777";

async function turno(msg) {
  session.history.push({ role: "user", content: msg });
  const r = await ejecutarTurnoAgenteWhatsApp({ session, mensajeUsuario: msg, phone });
  session.history.push({ role: "assistant", content: r.texto });
  console.log("\n=== CLIENTE:", msg);
  console.log("phase:", r.session.agent.phase);
  console.log("HAKU:\n", r.texto);
  return r;
}

await turno("Hola buen dia necesito los amortiguadores de un Renault megane 2");
await turno("Delanteros");

// Sin sesión (como si Supabase fallara)
const session2 = freshWaSession();
session2.history.push({ role: "user", content: "Delanteros" });
const r2 = await ejecutarTurnoAgenteWhatsApp({
  session: session2,
  mensajeUsuario: "Delanteros",
  phone,
});
console.log("\n=== SIN CONTEXTO (solo Delanteros)");
console.log(r2.texto);
