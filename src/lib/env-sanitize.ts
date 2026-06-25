/** Limpia secretos copiados con espacios, saltos de línea o símbolos raros (→, etc.). */
export function sanitizeAsciiSecret(raw: string | undefined): string {
  if (!raw) return "";
  return raw.replace(/[^\x20-\x7E]/g, "").trim();
}

/** Phone Number ID de Meta: solo dígitos. */
export function sanitizePhoneNumberId(raw: string | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}
