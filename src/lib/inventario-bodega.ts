import inventarioVivo from "../../data/inventario-vivo.json";

/** Proveedores con stock real en bodega Apex (no catálogo estático). */
export const PROVEEDORES_BODEGA = ["KTC", "DMB"] as const;

let refsVivoCache: Set<string> | null = null;
let piezasVivoCache: { referencia: string; stock: number }[] | null = null;

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

/** Piezas bodega con stock objetivo (inventario-vivo.json). */
export function piezasInventarioVivo(): { referencia: string; stock: number }[] {
  if (!piezasVivoCache) {
    const piezas =
      (inventarioVivo as { piezas?: { referencia?: string; stock?: number }[] }).piezas ?? [];
    piezasVivoCache = piezas
      .map((p) => ({
        referencia: (p.referencia ?? "").trim().toUpperCase(),
        stock: Math.max(0, Math.floor(Number(p.stock ?? 0))),
      }))
      .filter((p) => p.referencia.length > 0);
  }
  return piezasVivoCache;
}

export function esReferenciaBodega(referencia: string): boolean {
  const ref = referencia.trim().toUpperCase();
  return ref.length > 0 && referenciasInventarioVivo().has(ref);
}

export function esProveedorBodega(marcaProducto: string | null | undefined): boolean {
  const prov = (marcaProducto ?? "").trim().toUpperCase();
  return (PROVEEDORES_BODEGA as readonly string[]).includes(prov);
}
