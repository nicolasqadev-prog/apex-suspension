export function verifyAdminPinValue(pin: string): { ok: true } | { ok: false; reason: string } {
  const expected = process.env.ADMIN_PIN?.trim();
  if (!expected) {
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
      return pin === "Panel1234" ? { ok: true } : { ok: false, reason: "PIN incorrecto" };
    }
    return { ok: false, reason: "ADMIN_PIN no configurado en el servidor" };
  }
  return pin === expected ? { ok: true } : { ok: false, reason: "PIN incorrecto" };
}
