import { grupoCategoria, marcaVehiculoDePieza } from "./catalogo-filtros";
import type { LineaVehiculo, PiezaInventario } from "./inventario";

function inferirProveedor(marcaRaw: string | undefined, referencia: string): string {
  const m = (marcaRaw ?? "").trim().toUpperCase();
  const proveedores = ["KTC", "CORVEN", "MOOG", "NAKATA", "SABO", "WURTEX", "DISTRICAMIONES"];
  if (proveedores.includes(m)) return m === "KTC" ? "KTC" : marcaRaw!.trim();
  const ref = referencia.toUpperCase();
  for (const p of proveedores) {
    if (ref.startsWith(p)) return p === "KTC" ? "KTC" : p.charAt(0) + p.slice(1).toLowerCase();
  }
  return "KTC";
}

type PiezaParcial = Partial<PiezaInventario> &
  Pick<PiezaInventario, "slug" | "referencia" | "nombre" | "precioLista" | "stock"> & {
    aplicacion?: string;
    categoria?: string;
    marca?: string;
    precioTaller?: number;
  };

export function completarPieza(p: PiezaParcial): PiezaInventario {
  const categoria = p.categoria ?? "";
  const linea = (p.lineaVehiculo ?? "liviano") as LineaVehiculo;
  return {
    slug: p.slug,
    referencia: p.referencia,
    nombre: p.nombre,
    aplicacion: p.aplicacion ?? "",
    categoria,
    categoriaGrupo: p.categoriaGrupo ?? grupoCategoria(categoria),
    precioLista: p.precioLista,
    precioTallerRef:
      p.precioTallerRef ?? (p.precioTaller != null ? Math.round(p.precioTaller) : undefined),
    stock: p.stock,
    marca: marcaVehiculoDePieza({
      slug: p.slug,
      referencia: p.referencia,
      nombre: p.nombre,
      aplicacion: p.aplicacion ?? "",
      categoria: categoria,
      categoriaGrupo: p.categoriaGrupo ?? grupoCategoria(categoria),
      precioLista: p.precioLista,
      stock: p.stock,
      marca: p.marca ?? "Varios",
      marcaProducto: p.marcaProducto ?? "KTC",
      lineaVehiculo: linea,
    }),
    marcaProducto: p.marcaProducto ?? inferirProveedor(p.marca, p.referencia),
    lineaVehiculo: linea === "camion" || linea === "utilitario" ? linea : "liviano",
  };
}
