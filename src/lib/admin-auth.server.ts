const PIN_RATE_WINDOW_MS = 10 * 60_000;
const PIN_RATE_MAX_FAILS = 8;
const pinFailsByKey = new Map<string, { count: number; firstAt: number }>();

function pinRateKey(ip?: string): string {
  return ip?.trim() || "unknown";
}

export function verifyAdminPinValue(
  pin: string,
  opts?: { ip?: string },
): { ok: true } | { ok: false; reason: string } {
  const key = pinRateKey(opts?.ip);
  const now = Date.now();
  const slot = pinFailsByKey.get(key);
  if (slot && now - slot.firstAt <= PIN_RATE_WINDOW_MS && slot.count >= PIN_RATE_MAX_FAILS) {
    return { ok: false, reason: "Demasiados intentos. Espera unos minutos." };
  }

  const expected = process.env.ADMIN_PIN?.trim();
  if (!expected) {
    const isDev = process.env.NODE_ENV !== "production";
    if (isDev) {
      const ok = pin === "Panel1234";
      if (!ok) recordPinFail(key, now, slot);
      else pinFailsByKey.delete(key);
      return ok ? { ok: true } : { ok: false, reason: "PIN incorrecto" };
    }
    return { ok: false, reason: "ADMIN_PIN no configurado en el servidor" };
  }

  const ok = pin === expected;
  if (!ok) {
    recordPinFail(key, now, slot);
    return { ok: false, reason: "PIN incorrecto" };
  }
  pinFailsByKey.delete(key);
  return { ok: true };
}

function recordPinFail(
  key: string,
  now: number,
  slot: { count: number; firstAt: number } | undefined,
) {
  if (!slot || now - slot.firstAt > PIN_RATE_WINDOW_MS) {
    pinFailsByKey.set(key, { count: 1, firstAt: now });
  } else {
    pinFailsByKey.set(key, { count: slot.count + 1, firstAt: slot.firstAt });
  }
}
