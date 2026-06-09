/** Fallback local (10 SKUs demo). En producción el catálogo viene de Supabase. */
import inventarioEjemplo from "../../data/inventario.ejemplo.json";

export type PiezaInventario = {
  slug: string;
  referencia: string;
  nombre: string;
  aplicacion: string;
  categoria: string;
  precioLista: number;
  stock: number;
  marca: string;
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
  return [...data.piezas].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
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
