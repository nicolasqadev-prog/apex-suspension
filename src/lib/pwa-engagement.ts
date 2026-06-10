import { isPwaStandalone } from "./pwa-standalone";

const SESSION_HIDE_KEY = "apex.pwa.engagement.hideSession";
const SNOOZE_KEY = "apex.pwa.engagement.snoozeUntil";

export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isWebkit = /webkit/i.test(ua);
  const isChromeIos = /crios/i.test(ua);
  return isIos && isWebkit && !isChromeIos;
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

export async function subscribeToPushIfConfigured(): Promise<PushSubscription | null> {
  const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublic?.trim()) return null;
  if (!("PushManager" in window)) return null;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublic.trim()),
  });
}

function telefonoParaPush(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const taller = localStorage.getItem("apex.taller.whatsapp");
    if (taller?.replace(/\D/g, "")) return taller.replace(/\D/g, "");
    const general = localStorage.getItem("apex.whatsapp");
    if (general) {
      let raw = general;
      try {
        const parsed = JSON.parse(general) as unknown;
        if (typeof parsed === "string") raw = parsed;
      } catch {
        // valor plano
      }
      const digits = raw.replace(/\D/g, "");
      if (digits.length >= 10) return digits;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/** Suscribe al push del navegador y guarda la suscripción en Supabase. */
export async function subscribeAndRegisterPush(opts?: {
  telefono?: string;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const permission = await requestNotificationPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "permiso_denegado" };
  }

  const sub = await subscribeToPushIfConfigured();
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
      telefono: opts?.telefono?.replace(/\D/g, "") || telefonoParaPush(),
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
