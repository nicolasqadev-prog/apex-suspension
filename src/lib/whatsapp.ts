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
