import type { LineaVehiculo, PiezaInventario } from "./inventario";

export type OrdenCatalogo = "relevancia" | "precio-asc" | "precio-desc" | "stock-desc";

export type LineaFiltro = "liviano" | "camion" | "todos";

export type FiltrosCatalogo = {
  q: string;
  marcaVehiculo: string;
  marcaProducto: string;
  categoria: string;
  lineaVehiculo: LineaFiltro;
  stockFiltro: "todos" | "con-stock";
};

/** Agrupa variantes del Excel (Amortiguador / Amortiguadores cabina…). */
export function grupoCategoria(categoria: string): string {
  const c = categoria.trim().toLowerCase();
  if (!c) return "Sin categoría";
  if (c.includes("amortigu")) return "Amortiguadores";
  if (c.includes("rotul") || c.includes("terminal")) return "Terminales y rótulas";
  if (c.includes("bieleta") || c.includes("buj")) return "Bujes y bieletas";
  if (c.includes("reten") || c.includes("sello")) return "Sellos y retenes";
  if (c.includes("tornill") || c.includes("tuerca") || c.includes("pasador"))
    return "Tornillería y fijación";
  if (c.includes("rodamiento")) return "Rodamientos";
  if (c.includes("cable") || c.includes("guaya")) return "Cables y guayas";
  if (c.includes("soporte") || c.includes("antivibr")) return "Soportería y antivibración";
  return categoria.trim();
}

export function categoriaDePieza(p: PiezaInventario): string {
  return p.categoriaGrupo?.trim() || grupoCategoria(p.categoria);
}

const PROVEEDORES_EN_MARCA = new Set([
  "KTC",
  "CORVEN",
  "MOOG",
  "NAKATA",
  "SABO",
  "WURTEX",
  "DISTRICAMIONES",
  "DMB",
  "NAVCAR",
  "ZSG",
  "CONZINA",
  "FOTON",
  "HINO",
]);

const MARCAS_AUTO = [
  "MERCEDES BENZ",
  "MERCEDES-BENZ",
  "CHEVROLET",
  "VOLKSWAGEN",
  "MITSUBISHI",
  "CHRYSLER",
  "DAEWOO",
  "RENAULT",
  "HYUNDAI",
  "TOYOTA",
  "NISSAN",
  "MAZDA",
  "DODGE",
  "HONDA",
  "FORD",
  "SUZUKI",
  "BMW",
  "KIA",
  "JEEP",
  "FIAT",
  "ISUZU",
];

/** Marca del auto (no proveedor). Corrige datos viejos donde marca = KTC/Corven. */
export function marcaVehiculoDePieza(p: PiezaInventario): string {
  const raw = p.marca?.trim() ?? "";
  if (raw && !PROVEEDORES_EN_MARCA.has(raw.toUpperCase())) return raw;
  const blob = `${p.aplicacion} ${p.nombre}`.toUpperCase();
  for (const m of MARCAS_AUTO) {
    if (blob.includes(m)) {
      if (m.startsWith("MERCEDES")) return "Mercedes Benz";
      return m.charAt(0) + m.slice(1).toLowerCase();
    }
  }
  return raw || "Varios";
}

export function marcasVehiculoOpciones(piezas: PiezaInventario[]): string[] {
  const set = new Set<string>();
  for (const p of piezas) {
    set.add(marcaVehiculoDePieza(p));
  }
  const list = [...set].sort((a, b) => a.localeCompare(b, "es"));
  const sinVarios = list.filter((m) => m !== "Varios");
  if (set.has("Varios")) sinVarios.push("Varios");
  return sinVarios;
}

export function marcasProductoOpciones(piezas: PiezaInventario[]): string[] {
  const set = new Set<string>();
  for (const p of piezas) {
    const m = p.marcaProducto?.trim();
    if (m) set.add(m);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export function categoriasOpciones(piezas: PiezaInventario[]): string[] {
  const set = new Set<string>();
  for (const p of piezas) {
    set.add(categoriaDePieza(p));
  }
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export function scoreRelevancia(p: PiezaInventario, q: string): number {
  const ref = p.referencia.toLowerCase();
  const nom = p.nombre.toLowerCase();
  if (ref === q) return 0;
  if (ref.startsWith(q)) return 1;
  if (ref.includes(q)) return 2;
  if (nom.startsWith(q)) return 3;
  if (nom.includes(q)) return 4;
  return 5;
}

export function filtrarPiezas(
  piezas: PiezaInventario[],
  filtros: FiltrosCatalogo,
): PiezaInventario[] {
  const qn = filtros.q.trim().toLowerCase();
  let list = qn
    ? piezas.filter((p) => {
        const blob =
          `${p.marca} ${p.marcaProducto} ${p.referencia} ${p.nombre} ${p.aplicacion} ${p.categoria} ${categoriaDePieza(p)}`.toLowerCase();
        return blob.includes(qn);
      })
    : piezas;

  if (filtros.marcaVehiculo) {
    list = list.filter((p) => marcaVehiculoDePieza(p) === filtros.marcaVehiculo);
  }
  if (filtros.marcaProducto) {
    list = list.filter((p) => p.marcaProducto === filtros.marcaProducto);
  }
  if (filtros.categoria) {
    list = list.filter((p) => categoriaDePieza(p) === filtros.categoria);
  }
  if (filtros.stockFiltro === "con-stock") {
    list = list.filter((p) => p.stock > 0);
  }

  if (filtros.lineaVehiculo === "liviano") {
    list = list.filter((p) => p.lineaVehiculo === "liviano" || p.stock > 0);
  } else if (filtros.lineaVehiculo === "camion") {
    list = list.filter((p) => p.lineaVehiculo === "camion");
  }

  return list;
}

export function ordenarPiezas<T extends PiezaInventario>(
  list: T[],
  orden: OrdenCatalogo,
  q: string,
  precioDe: (p: T) => number,
): T[] {
  const qn = q.trim().toLowerCase();
  const sorted = [...list];

  if (orden === "relevancia" && qn) {
    return sorted.sort((a, b) => scoreRelevancia(a, qn) - scoreRelevancia(b, qn));
  }
  if (orden === "precio-asc") {
    return sorted.sort((a, b) => precioDe(a) - precioDe(b));
  }
  if (orden === "precio-desc") {
    return sorted.sort((a, b) => precioDe(b) - precioDe(a));
  }
  if (orden === "stock-desc") {
    return sorted.sort((a, b) => b.stock - a.stock || a.nombre.localeCompare(b.nombre, "es"));
  }

  return sorted.sort((a, b) => b.stock - a.stock || a.nombre.localeCompare(b.nombre, "es"));
}

export function particionarPorBodega<T extends PiezaInventario>(piezas: T[]) {
  const bodega: T[] = [];
  const bajoPedido: T[] = [];
  for (const p of piezas) {
    if (p.stock > 0) bodega.push(p);
    else bajoPedido.push(p);
  }
  return { bodega, bajoPedido };
}

export function hayFiltrosActivos(filtros: FiltrosCatalogo): boolean {
  return Boolean(filtros.q.trim() || filtros.marcaVehiculo || filtros.categoria);
}
