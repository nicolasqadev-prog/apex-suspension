import { grupoCategoria, marcaVehiculoDePieza } from "./catalogo-filtros";
import type { LineaVehiculo, PiezaInventario } from "./inventario";

/** Nombres basura del Excel Districamiones (columna mal parseada). */
const NOMBRE_EXCEL_INVALIDO = new Set(["MODELO", "MARCA"]);

function tipoLegible(raw: string): string {
  const n = raw.trim();
  if (NOMBRE_EXCEL_INVALIDO.has(n.toUpperCase())) return "cable o guaya";
  return n.charAt(0) + n.slice(1).toLowerCase();
}

/**
 * Excel lista_persona: en guayas el "NOMBRE PRODUCTO" es solo el tipo (ACELERADOR, EMBRAGUE…),
 * no la descripción. Enriquecemos para catálogo sin tocar Supabase.
 */
function enriquecerTextoCatalogo(
  p: Pick<PiezaInventario, "referencia" | "nombre" | "aplicacion" | "categoria" | "categoriaGrupo" | "marca" | "marcaProducto">,
  marcaVeh: string,
): { nombre: string; aplicacion: string } {
  const nombreRaw = p.nombre.trim();
  const aplicRaw = (p.aplicacion ?? "").trim();
  const catGrupo = p.categoriaGrupo?.trim() || grupoCategoria(p.categoria);
  const ref = p.referencia.trim();
  const proveedor = p.marcaProducto?.trim() || "";

  const mismoTexto =
    !aplicRaw ||
    nombreRaw.toUpperCase() === aplicRaw.toUpperCase() ||
    NOMBRE_EXCEL_INVALIDO.has(nombreRaw.toUpperCase());

  if (!mismoTexto && nombreRaw.length > 40) {
    return { nombre: nombreRaw, aplicacion: aplicRaw };
  }

  const marcaLabel = marcaVeh && marcaVeh !== "Varios" ? marcaVeh : "";
  const refLine = `Ref. ${ref}${proveedor ? ` · ${proveedor}` : ""}`;

  if (catGrupo === "Cables y guayas" && (mismoTexto || NOMBRE_EXCEL_INVALIDO.has(nombreRaw.toUpperCase()))) {
    const tipo = tipoLegible(nombreRaw);
    const titulo = marcaLabel ? `Guaya ${tipo} · ${marcaLabel}` : `Guaya ${tipo}`;
    return {
      nombre: titulo,
      aplicacion: `${refLine} · Confirmar vehículo por WhatsApp`,
    };
  }

  if (mismoTexto && nombreRaw.length <= 40) {
    const titulo = marcaLabel
      ? `${nombreRaw} · ${marcaLabel} · Ref ${ref}`
      : `${nombreRaw} · Ref ${ref}`;
    return {
      nombre: titulo,
      aplicacion: proveedor ? `${refLine} · Bajo pedido` : `${refLine}`,
    };
  }

  return { nombre: nombreRaw, aplicacion: aplicRaw || nombreRaw };
}

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
  const categoriaGrupo = p.categoriaGrupo ?? grupoCategoria(categoria);
  const marcaProducto = p.marcaProducto ?? inferirProveedor(p.marca, p.referencia);

  const baseMarca = p.marca ?? "Varios";
  const marcaVeh = marcaVehiculoDePieza({
    slug: p.slug,
    referencia: p.referencia,
    nombre: p.nombre,
    aplicacion: p.aplicacion ?? "",
    categoria,
    categoriaGrupo,
    precioLista: p.precioLista,
    stock: p.stock,
    marca: baseMarca,
    marcaProducto,
    lineaVehiculo: linea,
  });

  const texto = enriquecerTextoCatalogo(
    {
      referencia: p.referencia,
      nombre: p.nombre,
      aplicacion: p.aplicacion ?? "",
      categoria,
      categoriaGrupo,
      marca: marcaVeh,
      marcaProducto,
    },
    marcaVeh,
  );

  return {
    slug: p.slug,
    referencia: p.referencia,
    nombre: texto.nombre,
    aplicacion: texto.aplicacion,
    categoria,
    categoriaGrupo,
    precioLista: p.precioLista,
    precioTallerRef:
      p.precioTallerRef ?? (p.precioTaller != null ? Math.round(p.precioTaller) : undefined),
    stock: p.stock,
    marca: marcaVeh,
    marcaProducto,
    lineaVehiculo: linea === "camion" || linea === "utilitario" ? linea : "liviano",
  };
}
