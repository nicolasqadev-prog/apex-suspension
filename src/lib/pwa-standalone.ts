/** true cuando la app se abre desde el ícono instalado (no pestaña del navegador). */
export function isPwaStandalone(): boolean {
  if (typeof window === "undefined") return false;

  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

/** Vista previa en desarrollo: `/?pwaWelcome=1` */
export function shouldShowPwaWelcomePreview(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) {
    return new URLSearchParams(window.location.search).get("pwaWelcome") === "1";
  }
  return false;
}
