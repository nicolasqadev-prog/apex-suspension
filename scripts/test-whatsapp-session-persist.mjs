/**
 * Verifica que save → load persiste fase esperando_aclaracion (bug PATCH 200 sin fila).
 */
import { loadEnvLocal } from "./parse-env-local.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadWhatsAppSession,
  saveWhatsAppSession,
} from "../src/lib/whatsapp-agent/session.server.ts";
import { freshWaSession } from "../src/lib/whatsapp-agent/types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const [k, v] of Object.entries(loadEnvLocal(join(root, ".env.local")))) {
  if (!process.env[k]) process.env[k] = v;
}

const phone = `5739${String(Date.now()).slice(-8)}`;

const s1 = freshWaSession();
s1.history.push(
  { role: "user", content: "amortiguadores renault megane 2" },
  {
    role: "assistant",
    content: "Para el renault megane manejamos amortiguadores delanteros y traseros.",
  },
);
s1.agent.phase = "esperando_aclaracion";
s1.agent.greeted = true;
s1.agent.aclaracionPendiente = {
  segmento: "amortiguadores renault megane 2",
  ctx: {
    textoCompleto: "amortiguadores renault megane 2",
    pieza: "amortiguador",
    vehiculo: "megane",
    marcaVehiculo: "renault",
    listoParaCotizar: true,
  },
  candidatosSlugs: ["ksa-re008"],
  cantidadSugerida: 1,
  pregunta: "¿Cuáles necesitas?",
};

await saveWhatsAppSession(phone, s1);
const s2 = await loadWhatsAppSession(phone);

const ok =
  s2.history.length === 2 &&
  s2.agent.phase === "esperando_aclaracion" &&
  s2.agent.greeted === true &&
  s2.agent.aclaracionPendiente?.ctx.vehiculo === "megane";

console.log(ok ? "OK: sesión persistida en Supabase" : "FAIL: sesión no persistió");
if (!ok) {
  console.log("loaded:", JSON.stringify(s2, null, 2));
  process.exit(1);
}
