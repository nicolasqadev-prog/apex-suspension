import inventarioVivo from "../../data/inventario-vivo.json";

/** Proveedores con stock real en bodega Apex (no catálogo estático). */
export const PROVEEDORES_BODEGA = ["KTC", "DMB"] as const;

let refsVivoCache: Set<string> | null = null;

/** Referencias con stock físico en bodega (inventario-vivo.json). */
export function referenciasInventarioVivo(): Set<string> {
  if (!refsVivoCache) {
    const piezas = (inventarioVivo as { piezas?: { referencia?: string }[] }).piezas ?? [];
    refsVivoCache = new Set(
      piezas.map((p) => (p.referencia ?? "").trim().toUpperCase()).filter(Boolean),
    );
  }
  return refsVivoCache;
}

export function esReferenciaBodega(referencia: string): boolean {
  const ref = referencia.trim().toUpperCase();
  return ref.length > 0 && referenciasInventarioVivo().has(ref);
}

export function esProveedorBodega(marcaProducto: string | null | undefined): boolean {
  const prov = (marcaProducto ?? "").trim().toUpperCase();
  return (PROVEEDORES_BODEGA as readonly string[]).includes(prov);
}
