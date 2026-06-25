/**
 * Agente WhatsApp — plantilla Apex Suspensión.
 * Punto de entrada: ejecutarTurnoAgenteWhatsApp (orchestrator.server.ts).
 */
export { ejecutarTurnoAgenteWhatsApp } from "./orchestrator.server";
export { loadWhatsAppSession, saveWhatsAppSession } from "./session.server";
export type { WaSession, WaAgentPhase, BorradorPedidoWa } from "./types";
export { saludoPorHoraColombia, lineaPresentacionAgente } from "./greeting";
