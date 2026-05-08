import { enlaceWhatsApp, mensajeConfirmacionCotizacion } from "./whatsapp";

export type MostradorDraft = {
  piezaOSintoma: string;
  carro?: string;
  ano?: string;
  version?: string;
  municipio?: string;
  whatsapp?: string;
};

export function buildWhatsappHandoffLink(d: MostradorDraft): string {
  const pieza = d.piezaOSintoma?.trim();
  const msg = mensajeConfirmacionCotizacion({
    pieza: pieza ? `Orientación para cotizar: ${pieza}` : "Orientación para cotizar",
    whatsapp: d.whatsapp,
    vehiculo: d.carro,
    ano: d.ano,
    version: d.version,
  });

  const municipio = d.municipio?.trim();
  const finalMsg = municipio ? `${msg}\nMunicipio: ${municipio}` : msg;
  return enlaceWhatsApp(finalMsg);
}

export function normalizeShortText(raw: string, max = 80): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

