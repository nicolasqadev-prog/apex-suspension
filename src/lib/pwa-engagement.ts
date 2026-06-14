import { isPwaStandalone } from "./pwa-standalone";
import { TALLER_WHATSAPP_STORAGE_KEY, normalizeWhatsappTaller } from "./taller-whatsapp";

const SESSION_HIDE_KEY = "apex.pwa.engagement.hideSession";
const SNOOZE_KEY = "apex.pwa.engagement.snoozeUntil";

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isChromeIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /crios/i.test(navigator.userAgent);
}

export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = isIosDevice();
  const isWebkit = /webkit/i.test(ua);
  return isIos && isWebkit && !isChromeIos();
}

/** WhatsApp, Instagram, etc. — no permiten “Agregar a inicio” de forma fiable. */
export function isInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (
    /WhatsApp|Instagram|FBAN|FBAV|FBIOS|Line\/|Twitter|Snapchat|TikTok|LinkedInApp|GSA\//i.test(ua)
  ) {
    return true;
  }
  if (isIosDevice() && !isIosSafari() && !isChromeIos()) {
    if (/AppleWebKit/i.test(ua) && !/Safari/i.test(ua)) return true;
  }
  return false;
}

export type IosInstallMode = "in-app" | "safari" | "chrome-ios" | "other-ios";

export function iosInstallMode(): IosInstallMode | null {
  if (!isIosDevice()) return null;
  if (isInAppBrowser()) return "in-app";
  if (isIosSafari()) return "safari";
  if (isChromeIos()) return "chrome-ios";
  return "other-ios";
}

export async function copiarEnlaceActual(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const url = window.location.href;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    // fallback abajo
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function canSuggestPwaInstall(): boolean {
  if (typeof window === "undefined") return false;
  if (isPwaStandalone()) return false;
  return true;
}

export function canSuggestNotifications(): boolean {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  return Notification.permission !== "granted";
}

export function shouldShowEngagementPrompt(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_HIDE_KEY) === "1") return false;
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (raw) {
      const until = Number(raw);
      if (Number.isFinite(until) && Date.now() < until) return false;
    }
  } catch {
    // ignore
  }
  return true;
}

/** Oculta hasta cerrar la pestaña o la app. */
export function hideEngagementForSession(): void {
  try {
    sessionStorage.setItem(SESSION_HIDE_KEY, "1");
  } catch {
    // ignore
  }
}

/** No volver a mostrar por unas horas. */
export function snoozeEngagementPrompt(hours = 24): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + hours * 60 * 60 * 1000));
  } catch {
    // ignore
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function ensureServiceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    await navigator.serviceWorker.register("/sw.js");
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function subscribeToPushIfConfigured(
  renovar = false,
): Promise<PushSubscription | null> {
  const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublic?.trim()) return null;
  if (!("PushManager" in window)) return null;

  const reg = await ensureServiceWorkerReady();
  if (!reg) return null;

  const existing = await reg.pushManager.getSubscription();
  if (existing && !renovar) return existing;
  if (existing && renovar) {
    try {
      await existing.unsubscribe();
    } catch {
      // Continúa con nueva suscripción.
    }
  }

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublic.trim()),
  });
}

/** Lee el WhatsApp del taller guardado en localStorage (JSON o texto plano). */
export function leerTelefonoTallerParaPush(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(TALLER_WHATSAPP_STORAGE_KEY);
    if (raw) {
      let parsed = raw;
      try {
        const j = JSON.parse(raw) as unknown;
        if (typeof j === "string") parsed = j;
      } catch {
        // valor plano
      }
      const w = normalizeWhatsappTaller(parsed);
      if (w.length >= 10) return w;
    }
    const general = localStorage.getItem("apex.whatsapp");
    if (general) {
      let parsed = general;
      try {
        const j = JSON.parse(general) as unknown;
        if (typeof j === "string") parsed = j;
      } catch {
        // valor plano
      }
      const w = normalizeWhatsappTaller(parsed);
      if (w.length >= 10) return w;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Si el taller ya dio permiso de notificaciones, vincula la suscripción push
 * a su WhatsApp sin volver a pedir permiso (clave para que admin encuentre el dispositivo).
 */
export async function vincularPushConTelefonoTaller(
  rawTelefono?: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (typeof window === "undefined") return { ok: false, reason: "sin_cliente" };
  if (!("Notification" in window)) return { ok: false, reason: "sin_notificaciones" };
  if (Notification.permission !== "granted") return { ok: false, reason: "permiso_pendiente" };

  const telefono = rawTelefono
    ? normalizeWhatsappTaller(rawTelefono)
    : leerTelefonoTallerParaPush();
  if (!telefono || telefono.length < 10) return { ok: false, reason: "sin_telefono" };

  return subscribeAndRegisterPush({ telefono, renovar: false });
}

/** Suscribe al push del navegador y guarda la suscripción en Supabase. */
export async function subscribeAndRegisterPush(opts?: {
  telefono?: string;
  /** Regenera la suscripción push (útil tras cambio de VAPID o en Brave). */
  renovar?: boolean;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!("serviceWorker" in navigator)) {
    return { ok: false, reason: "sin_service_worker" };
  }

  const permission =
    Notification.permission === "granted" ? "granted" : await requestNotificationPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "permiso_denegado" };
  }

  const sub = await subscribeToPushIfConfigured(opts?.renovar === true);
  if (!sub) {
    return { ok: false, reason: "vapid_no_configurado" };
  }

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, reason: "suscripcion_invalida" };
  }

  const { guardarSuscripcionPush } = await import("./push.functions");
  const saved = await guardarSuscripcionPush({
    data: {
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      telefono: opts?.telefono
        ? normalizeWhatsappTaller(opts.telefono)
        : leerTelefonoTallerParaPush(),
      userAgent: navigator.userAgent,
    },
  });

  if (!saved.ok) return { ok: false, reason: saved.reason };
  return { ok: true };
}

/** Dispara el flujo de instalación nativo si el navegador lo ofrece. */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.requestPermission();
}
