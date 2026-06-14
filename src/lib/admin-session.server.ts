import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { getClientIp, checkRateLimit } from "./rate-limit.server";
import { verifyAdminPinValue } from "./admin-auth.server";

export const ADMIN_SESSION_COOKIE = "apex_admin_sess";
const SESSION_TTL_SEC = 8 * 60 * 60;

function sessionSecret(): string | null {
  const pin = process.env.ADMIN_PIN?.trim();
  if (pin) return pin;
  if (process.env.NODE_ENV !== "production") return "Panel1234";
  return null;
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function createAdminSessionToken(): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;
  const exp = Date.now() + SESSION_TTL_SEC * 1000;
  const payload = btoa(JSON.stringify({ exp, v: 1 }));
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyAdminSessionToken(token: string): Promise<boolean> {
  const secret = sessionSecret();
  if (!secret) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = await hmacSign(payload, secret);
  if (expected !== sig) return false;
  try {
    const data = JSON.parse(atob(payload)) as { exp?: number };
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export async function requireAdminAuth(
  request: Request | undefined,
  adminPin?: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const ip = getClientIp(request);
  const token = getCookie(ADMIN_SESSION_COOKIE);
  if (token && (await verifyAdminSessionToken(token))) {
    return { ok: true };
  }
  if (adminPin?.trim()) {
    return verifyAdminPinValue(adminPin, { ip });
  }
  return { ok: false, reason: "Sesión admin expirada o no autenticado" };
}

export async function establecerSesionAdmin(
  pin: string,
  request?: Request,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const ip = getClientIp(request);
  if (!checkRateLimit("admin-login", ip, 5, 10 * 60_000)) {
    return { ok: false, reason: "Demasiados intentos. Espera unos minutos." };
  }

  const auth = verifyAdminPinValue(pin, { ip });
  if (!auth.ok) return auth;

  const token = await createAdminSessionToken();
  if (!token) {
    return { ok: false, reason: "ADMIN_PIN no configurado en el servidor" };
  }

  setCookie(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });

  return { ok: true };
}

export function cerrarSesionAdmin(): void {
  deleteCookie(ADMIN_SESSION_COOKIE, { path: "/" });
}

export async function sesionAdminValida(): Promise<boolean> {
  const token = getCookie(ADMIN_SESSION_COOKIE);
  if (!token) return false;
  return verifyAdminSessionToken(token);
}
