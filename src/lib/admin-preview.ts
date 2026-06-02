/** Solo en el navegador del equipo Apex (sessionStorage). Los clientes no ven esto. */

export const ADMIN_SESSION_KEY = "apex_admin_session";
export const ADMIN_PREVIEW_KEY = "apex.admin.previewMode";
export const ADMIN_PREVIEW_BANNER_KEY = "apex.admin.previewBanner";

export type PreviewBannerDraft = {
  activo: boolean;
  mensaje: string;
};

export function isAdminSessionActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function isAdminPreviewMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(ADMIN_PREVIEW_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAdminPreviewMode(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) sessionStorage.setItem(ADMIN_PREVIEW_KEY, "1");
    else sessionStorage.removeItem(ADMIN_PREVIEW_KEY);
  } catch {
    // ignore
  }
}

export function readPreviewBannerDraft(): PreviewBannerDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_PREVIEW_BANNER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PreviewBannerDraft;
  } catch {
    return null;
  }
}

export function savePreviewBannerDraft(draft: PreviewBannerDraft) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADMIN_PREVIEW_BANNER_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

/** Banner de prueba visible solo para ti en modo previa. */
export function shouldShowPreviewBanner(): boolean {
  if (!isAdminPreviewMode()) return false;
  const draft = readPreviewBannerDraft();
  return Boolean(draft?.activo && draft.mensaje.trim());
}

export function getPreviewBannerMessage(): string {
  return readPreviewBannerDraft()?.mensaje.trim() ?? "";
}
