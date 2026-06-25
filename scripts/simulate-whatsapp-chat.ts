/**
 * Simula una conversación WhatsApp en local (mismo orquestador que producción).
 * No envía mensajes a Meta — solo imprime respuestas en consola.
 *
 * Uso: npm run simulate:whatsapp
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { loadEnvLocal } from "./parse-env-local.mjs";
import { ejecutarTurnoAgenteWhatsApp } from "../src/lib/whatsapp-agent/orchestrator.server";
import { freshWaSession, type WaSession } from "../src/lib/whatsapp-agent/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const [k, v] of Object.entries(loadEnvLocal(join(root, ".env.local")))) {
  if (!process.env[k]) process.env[k] = v;
}

const ESCENARIO_CITROEN = [
  "cancelar",
  "Hola buen día necesito la BIELETA derecha de un Citroen c3 y cuánto vale?",
  "Okay y tienes la tijera del Citroen c3?",
  "Si me sirve, cuánto se demora en que llegue?",
];

async function turno(session: WaSession, msg: string, phone: string) {
  session.history.push({ role: "user", content: msg });
  const turno = await ejecutarTurnoAgenteWhatsApp({
    session,
    mensajeUsuario: msg,
    phone,
  });
  session.history.push({ role: "assistant", content: turno.texto });
  return turno;
}

async function escenarioFijo() {
  console.log("=== Simulación fija (Citroën C3) ===\n");
  const session = freshWaSession();
  const phone = "573171687777";

  for (const msg of ESCENARIO_CITROEN) {
    console.log("CLIENTE:", msg);
    const res = await turno(session, msg, phone);
    console.log("HAKU:\n" + res.texto);
    console.log(`[fase: ${res.session.agent.phase}]\n${"─".repeat(50)}`);
  }
}

async function modoInteractivo() {
  console.log("=== Chat interactivo (escribe mensajes, vacío para salir) ===\n");
  const rl = createInterface({ input, output });
  const session = freshWaSession();
  const phone = "573171687777";

  try {
    while (true) {
      const msg = (await rl.question("Tú: ")).trim();
      if (!msg) break;
      const res = await turno(session, msg, phone);
      console.log("\nHaku:\n" + res.texto + "\n");
    }
  } finally {
    rl.close();
  }
}

const interactivo = process.argv.includes("--chat");
await (interactivo ? modoInteractivo() : escenarioFijo());
