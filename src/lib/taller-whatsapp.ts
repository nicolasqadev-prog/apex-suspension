/** Solo dígitos; si es celular CO de 10 dígitos (3xx…), antepone 57. */
export function normalizeWhatsappTaller(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("3")) {
    digits = `57${digits}`;
  }
  return digits;
}

export const TALLER_WHATSAPP_STORAGE_KEY = "apex.taller.whatsapp";

/** Guarda WhatsApp de sesión taller (mismo formato que usePersistentState). */
export function guardarWhatsappTallerEnCliente(raw: string): string {
  const w = normalizeWhatsappTaller(raw);
  if (typeof window !== "undefined" && w.length >= 10) {
    try {
      localStorage.setItem(TALLER_WHATSAPP_STORAGE_KEY, JSON.stringify(w));
    } catch {
      // ignore
    }
  }
  return w;
}
