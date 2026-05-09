import { enlaceWhatsApp, mensajeConfirmacionCotizacion } from "./whatsapp";

export type MostradorDraft = {
  piezaOSintoma: string;
  carro?: string;
  ano?: string;
  version?: string;
  municipio?: string;
  whatsapp?: string;
  handoffTag?: "normal" | "bajo_encargo";
  /** Pieza prioritaria para cotizar (orientación). */
  primarySuggestion?: string;
  /** Solo para texto de WhatsApp; debe venir del servidor (Mostrador / consulta taller). */
  tallerCuenta?: { validado: boolean; contraEntregaHabilitada?: boolean };
};

export function buildWhatsappHandoffLink(d: MostradorDraft): string {
  const pieza = d.piezaOSintoma?.trim();
  const prioridad = d.primarySuggestion?.trim();
  const piezaConPrioridad =
    pieza && prioridad
      ? `${pieza}\nPrioridad para cotizar (orientación, no diagnóstico): ${prioridad}`
      : pieza;
  const prefix = d.handoffTag === "bajo_encargo" ? "BAJO ENCARGO — " : "";
  const msg = mensajeConfirmacionCotizacion({
    pieza: piezaConPrioridad
      ? `${prefix}Orientación para cotizar: ${piezaConPrioridad}`
      : `${prefix}Orientación para cotizar`,
    whatsapp: d.whatsapp,
    vehiculo: d.carro,
    ano: d.ano,
    version: d.version,
  });

  const municipio = d.municipio?.trim();
  const tallerNote =
    d.tallerCuenta?.validado === true
      ? d.tallerCuenta.contraEntregaHabilitada === true
        ? "\nNota: somos taller validado en Apex; en nuestra cuenta aplica contra entrega (confirmar con el equipo)."
        : "\nNota: somos taller validado en Apex (confirmar condiciones de pago/entrega con el equipo)."
      : "";
  const finalMsg = [municipio ? `${msg}\nMunicipio: ${municipio}` : msg, tallerNote].filter(Boolean).join("");
  return enlaceWhatsApp(finalMsg);
}

export function normalizeShortText(raw: string, max = 80): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

