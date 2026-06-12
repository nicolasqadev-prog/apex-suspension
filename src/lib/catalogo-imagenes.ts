import manifest from "../../data/catalogo-imagenes.json";

type CatalogoImagenesManifest = {
  imagenes: Record<string, string>;
};

const data = manifest as CatalogoImagenesManifest;

/** Solo KTC/DMB con stock en bodega (manifest generado desde PDFs proveedor). */
export function imagenUrlParaPieza(pieza: {
  slug: string;
  marcaProducto?: string;
}): string | undefined {
  const proveedor = (pieza.marcaProducto ?? "").trim().toUpperCase();
  if (proveedor !== "KTC" && proveedor !== "DMB") return undefined;
  return data.imagenes[pieza.slug];
}
