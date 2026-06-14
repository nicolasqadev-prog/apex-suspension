const stores = new Map<string, Map<string, { count: number; firstAt: number }>>();

function storeFor(name: string): Map<string, { count: number; firstAt: number }> {
  let s = stores.get(name);
  if (!s) {
    s = new Map();
    stores.set(name, s);
  }
  return s;
}

export function getClientIp(request?: Request): string {
  if (!request) return "unknown";
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf) return cf.trim();
  const xff = request.headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

/** Límite por IP en memoria (se reinicia al reciclar el worker). */
export function checkRateLimit(
  bucket: string,
  key: string,
  max: number,
  windowMs: number,
): boolean {
  const store = storeFor(bucket);
  const now = Date.now();
  const slot = store.get(key);
  if (!slot || now - slot.firstAt > windowMs) {
    store.set(key, { count: 1, firstAt: now });
    return true;
  }
  if (slot.count >= max) return false;
  store.set(key, { count: slot.count + 1, firstAt: slot.firstAt });
  return true;
}
