import { WA_AGENT_BRAND } from "./types";

export const WA_AGENT_NAME = "Haku";

/** Saludo según hora en Colombia (America/Bogota). */
export function saludoPorHoraColombia(now = new Date()): "Buenos días" | "Buenas tardes" | "Buenas noches" {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Bogota",
    }).format(now),
  );
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function lineaPresentacionAgente(brand = WA_AGENT_BRAND, now = new Date()): string {
  const saludo = saludoPorHoraColombia(now).toLowerCase();
  return `Hola, ${saludo}. Hablas con *${WA_AGENT_NAME}*, asistente virtual de *${brand}*.`;
}

const PRESENTACION_RX = /hablas con\s+\*?haku\*?/i;

/** Saludo una sola vez por conversación (solo si ya enviamos la presentación). */
export function debePresentarSaludo(session: {
  history: Array<{ role: "user" | "assistant"; content: string }>;
  agent: { greeted: boolean };
}): boolean {
  const yaPresentamos = session.history.some(
    (m) => m.role === "assistant" && PRESENTACION_RX.test(m.content),
  );
  if (yaPresentamos) {
    session.agent.greeted = true;
    return false;
  }
  session.agent.greeted = true;
  return true;
}

export function bloqueSaludo(brand = WA_AGENT_BRAND): string {
  return `${lineaPresentacionAgente(brand)}\n\n`;
}
