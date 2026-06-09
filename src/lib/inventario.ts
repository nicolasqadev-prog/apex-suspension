/** Fallback local (10 SKUs demo). En producción el catálogo viene de Supabase. */
import inventarioEjemplo from "../../data/inventario.ejemplo.json";
import { completarPieza } from "./inventario-normalizar";

export type LineaVehiculo = "liviano" | "camion" | "utilitario";

export type PiezaInventario = {
  slug: string;
  referencia: string;
  nombre: string;
  aplicacion: string;
  categoria: string;
  /** Categoría agrupada para filtros (Amortiguadores, etc.). */
  categoriaGrupo: string;
  precioLista: number;
  /** Precio taller de referencia en BD (si existe). */
  precioTallerRef?: number;
  stock: number;
  /** Marca del vehículo. */
  marca: string;
  /** Marca proveedor del repuesto (KTC, Districamiones…). */
  marcaProducto: string;
  lineaVehiculo: LineaVehiculo;
};

type InventarioJson = {
  meta: { moneda?: string };
  piezas: PiezaInventario[];
};

const data = inventarioEjemplo as InventarioJson;

export function monedaInventario(): string {
  return data.meta.moneda ?? "COP";
}

export function listarPiezas(): PiezaInventario[] {
  return [...data.piezas]
    .map((p) => completarPieza(p as Parameters<typeof completarPieza>[0]))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export function piezaPorSlug(slug: string): PiezaInventario | undefined {
  return data.piezas.find((p) => p.slug === slug);
}

export function buscarPiezas(consulta: string): PiezaInventario[] {
  const q = consulta.trim().toLowerCase();
  if (!q) return listarPiezas();
  return listarPiezas().filter((p) => {
    const blob =
      `${p.marca} ${p.referencia} ${p.nombre} ${p.aplicacion} ${p.categoria}`.toLowerCase();
    return blob.includes(q);
  });
}

export function marcasEnInventario(): string[] {
  const set = new Set(listarPiezas().map((p) => p.marca));
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export function categoriasEnInventario(): string[] {
  const set = new Set(listarPiezas().map((p) => p.categoria));
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}
