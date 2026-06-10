/** Modo preparación: cambios y pedidos de prueba antes de operación en vivo. */

export const ADMIN_PREPARACION_KEY = "apex.admin.modoPreparacion";

export const ADMIN_PREPARACION_EVENT = "apex-admin-preparacion-change";

export function isModoPreparacion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ADMIN_PREPARACION_KEY) === "1";
  } catch {
    return false;
  }
}

export function setModoPreparacion(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) localStorage.setItem(ADMIN_PREPARACION_KEY, "1");
    else localStorage.removeItem(ADMIN_PREPARACION_KEY);
    window.dispatchEvent(new Event(ADMIN_PREPARACION_EVENT));
  } catch {
    // ignore
  }
}

/** Para catálogo/pedidos de taller en borrador (solo en tu navegador). */
export function allowTallerBorradorEnCliente(): boolean {
  const operacionVivo = import.meta.env.VITE_APEX_OPERACION_VIVO === "true";
  if (operacionVivo) return false;
  return isModoPreparacion();
}
