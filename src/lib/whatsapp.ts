/** Número sin + ni espacios (Colombia). Configura `VITE_WHATSAPP_APEX` en `.env.local`. */
const DEFAULT_PLACEHOLDER = "573001234567";

export function numeroWhatsAppApex(): string {
  const raw = import.meta.env.VITE_WHATSAPP_APEX as string | undefined;
  if (!raw) return DEFAULT_PLACEHOLDER;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return DEFAULT_PLACEHOLDER;
}

export function enlaceWhatsApp(texto: string): string {
  const phone = numeroWhatsAppApex();
  return `https://wa.me/${phone}?text=${encodeURIComponent(texto)}`;
}

export type DatosConfirmacion = {
  whatsapp?: string;
  pieza?: string;
  vehiculo?: string;
  ano?: string;
  version?: string;
};

export function mensajeConfirmacionCotizacion(d: DatosConfirmacion): string {
  const pieza = d.pieza?.trim();
  const whatsapp = d.whatsapp?.trim();
  const vehiculo = d.vehiculo?.trim();
  const ano = d.ano?.trim();
  const version = d.version?.trim();

  return [
    "Hola, quiero cotizar un repuesto.",
    pieza ? `Pieza/referencia: ${pieza}` : null,
    vehiculo ? `Vehículo: ${vehiculo}` : null,
    ano ? `Año: ${ano}` : null,
    version ? `Versión: ${version}` : null,
    whatsapp ? `Mi WhatsApp: ${whatsapp}` : null,
    "",
    "Para confirmar compatibilidad puedo enviar foto de la pieza vieja y la placa (opcional).",
  ]
    .filter(Boolean)
    .join("\n");
}
