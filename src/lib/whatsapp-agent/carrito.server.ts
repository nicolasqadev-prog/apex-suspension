import { esConsultaMultiplePiezas } from "../mostrador-inventario.server";
import type { BorradorPedidoWa, CarritoItemWa, WaSession } from "./types";

const MARCA_VEH_TOKENS = new Set([
  "renault",
  "kia",
  "chevrolet",
  "chevy",
  "nissan",
  "toyota",
  "mazda",
  "hyundai",
  "ford",
  "honda",
  "suzuki",
  "volkswagen",
  "bmw",
  "mercedes",
  "audi",
  "peugeot",
  "citroen",
  "fiat",
  "jeep",
  "dodge",
  "chrysler",
]);

export function borradorACarritoItem(b: BorradorPedidoWa): CarritoItemWa {
  return {
    slug: b.slug,
    referencia: b.referencia,
    nombre: b.nombre,
    marcaProducto: b.marcaProducto,
    cantidad: b.cantidad,
    precioUnitarioCop: b.precioUnitarioCop,
    stock: b.stock,
    disponibilidad: b.disponibilidad,
    vehiculoResumen: b.vehiculoResumen,
    piezaResumen: b.piezaResumen,
    alcance: b.alcance,
  };
}

export function agregarAlCarrito(session: WaSession, item: CarritoItemWa): void {
  const idx = session.agent.carrito.findIndex((c) => c.referencia === item.referencia);
  if (idx >= 0) session.agent.carrito[idx] = item;
  else session.agent.carrito.push(item);
}

export function registrarCotizacionEnCarrito(session: WaSession, borrador: BorradorPedidoWa): void {
  agregarAlCarrito(session, borradorACarritoItem(borrador));
}

export function carritoTieneMixtoStock(items: CarritoItemWa[]): boolean {
  const enBodega = items.some((i) => i.disponibilidad === "bodega" && i.stock > 0);
  const bajoPedido = items.some(
    (i) => i.disponibilidad !== "bodega" || i.stock <= 0 || i.alcance === "bajo_encargo",
  );
  return enBodega && bajoPedido && items.length >= 2;
}

export function totalCarritoCop(items: CarritoItemWa[]): number {
  return items.reduce((s, i) => s + i.precioUnitarioCop * i.cantidad, 0);
}

export function buildCarritoConfirmToken(items: CarritoItemWa[]): string {
  return items
    .map((i) => `${i.referencia}:${i.cantidad}:${i.precioUnitarioCop}`)
    .sort()
    .join("|");
}

/** Busca ítem ya cotizado si el cliente menciona referencia o vehículo de nuevo. */
export function buscarEnCarritoPorMensaje(
  items: CarritoItemWa[],
  texto: string,
): CarritoItemWa | null {
  if (esConsultaMultiplePiezas(texto)) return null;

  const refs = texto.match(/\b[A-Z]{2,5}[- ]?\d{3,6}[A-Z0-9]*\b/gi) ?? [];
  for (const ref of refs) {
    const norm = ref.replace(/\s+/g, "-").toUpperCase();
    const hit = items.find((i) => i.referencia.toUpperCase() === norm);
    if (hit) return hit;
  }

  const t = texto.toLowerCase();
  for (const item of items) {
    const vehTokens = item.vehiculoResumen
      .toLowerCase()
      .split(/\s+/)
      .filter((tok) => tok.length >= 4 && !MARCA_VEH_TOKENS.has(tok));
    if (vehTokens.some((tok) => t.includes(tok))) return item;
  }

  const marcas: Array<{ rx: RegExp; veh: RegExp }> = [
    { rx: /\bmegane\b/i, veh: /megane/i },
    { rx: /\brio\b/i, veh: /\brio\b/i },
    { rx: /\bkwid\b/i, veh: /kwid/i },
    { rx: /\baveo\b/i, veh: /aveo/i },
    { rx: /\bcaptiva\b/i, veh: /captiva/i },
    { rx: /\bduster\b/i, veh: /duster/i },
    { rx: /\bonix\b/i, veh: /onix/i },
    { rx: /\bsandero\b/i, veh: /sandero/i },
  ];
  for (const { rx, veh } of marcas) {
    if (rx.test(t)) {
      const hit = items.find((i) => veh.test(i.vehiculoResumen));
      if (hit) return hit;
    }
  }
  return null;
}
