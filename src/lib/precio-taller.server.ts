import { aplicarDescuento } from "./pricing";
import type { TallerFidelizado } from "./talleres.server";

export type PrecioTallerResult = {
  precioUnitarioCop: number;
  precioPublicoCop: number;
  esPrecioTaller: boolean;
  nombreTaller?: string;
};

/** Misma lógica que catálogo PWA / inventario-taller.server.ts */
export function calcularPrecioTaller(
  pieza: { precioLista: number; precioTallerRef?: number },
  taller: Pick<TallerFidelizado, "nombreTaller" | "descuentoPorcentaje"> | null,
): PrecioTallerResult {
  const precioPublicoCop = Math.round(pieza.precioLista);
  if (!taller) {
    return { precioUnitarioCop: precioPublicoCop, precioPublicoCop, esPrecioTaller: false };
  }
  const precioUnitarioCop =
    pieza.precioTallerRef != null && pieza.precioTallerRef > 0
      ? Math.round(pieza.precioTallerRef)
      : aplicarDescuento(precioPublicoCop, taller.descuentoPorcentaje);
  return {
    precioUnitarioCop,
    precioPublicoCop,
    esPrecioTaller: true,
    nombreTaller: taller.nombreTaller,
  };
}
