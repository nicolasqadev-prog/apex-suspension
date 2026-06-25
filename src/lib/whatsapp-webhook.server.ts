import { enviarTextoWhatsApp } from "./whatsapp-cloud.server";
import { ejecutarTurnoAgenteWhatsApp } from "./whatsapp-agent/orchestrator.server";
import { loadWhatsAppSession, saveWhatsAppSession } from "./whatsapp-agent/session.server";

/** Punto de entrada del webhook — delega al orquestador plantilla. */
export async function procesarMensajeWhatsAppEntrante(msg: {
  from: string;
  body: string;
  contactName?: string;
}): Promise<void> {
  const session = await loadWhatsAppSession(msg.from);
  session.history.push({ role: "user", content: msg.body });

  const turno = await ejecutarTurnoAgenteWhatsApp({
    session,
    mensajeUsuario: msg.body,
    phone: msg.from,
    contactName: msg.contactName,
  });

  turno.session.history.push({ role: "assistant", content: turno.texto });
  await saveWhatsAppSession(msg.from, turno.session);

  const sent = await enviarTextoWhatsApp(msg.from, turno.texto);
  if (!sent) {
    console.error("WhatsApp: no se pudo enviar respuesta a", msg.from);
  } else {
    console.log("WhatsApp agent:", msg.from, turno.session.agent.phase, `(${turno.texto.length} chars)`);
  }
}
