import type { LineaCarritoTaller } from "./taller.types";

const STORAGE_KEY = "apex.taller.carrito";

export function leerCarritoTaller(): LineaCarritoTaller[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LineaCarritoTaller[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l) =>
        l &&
        typeof l.slug === "string" &&
        typeof l.referencia === "string" &&
        typeof l.cantidad === "number" &&
        l.cantidad > 0,
    );
  } catch {
    return [];
  }
}

function notificarCarrito() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("apex-taller-carrito"));
}

export function guardarCarritoTaller(lineas: LineaCarritoTaller[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lineas));
  notificarCarrito();
}

export function vaciarCarritoTaller() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function agregarAlCarritoTaller(
  linea: Omit<LineaCarritoTaller, "cantidad"> & { cantidad?: number },
) {
  const qty = Math.max(1, Math.floor(linea.cantidad ?? 1));
  const actual = leerCarritoTaller();
  const idx = actual.findIndex((l) => l.slug === linea.slug);
  if (idx >= 0) {
    actual[idx] = {
      ...actual[idx],
      cantidad: actual[idx].cantidad + qty,
      precioUnitarioCop: linea.precioUnitarioCop,
    };
  } else {
    actual.push({ ...linea, cantidad: qty });
  }
  guardarCarritoTaller(actual);
  return actual;
}

export function quitarDelCarritoTaller(slug: string) {
  const actual = leerCarritoTaller().filter((l) => l.slug !== slug);
  guardarCarritoTaller(actual);
  return actual;
}

export function actualizarCantidadCarritoTaller(slug: string, cantidad: number) {
  const qty = Math.max(1, Math.floor(cantidad));
  const actual = leerCarritoTaller().map((l) => (l.slug === slug ? { ...l, cantidad: qty } : l));
  guardarCarritoTaller(actual);
  return actual;
}
