export const DOMICILIO_COP = 10_000;

export function aplicarDescuento(precioBaseCop: number, descuentoPorcentaje: number): number {
  const base = Number(precioBaseCop);
  const pct = Math.max(0, Math.min(100, Number(descuentoPorcentaje || 0)));
  const factor = 1 - pct / 100;
  return Math.max(0, Math.round(base * factor));
}

export type LineaPrecio = { cantidad: number; precioUnitarioCop: number };

export function totalConDomicilio(lineas: LineaPrecio[]): number {
  const subtotal = lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitarioCop, 0);
  return Math.max(0, Math.round(subtotal + DOMICILIO_COP));
}
