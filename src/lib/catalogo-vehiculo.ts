import { modeloVehiculoCompacto, normalizarTextoBusqueda } from "./catalogo-busqueda";
import type { PiezaInventario } from "./inventario";

/** Modelos frecuentes en Colombia — orden: más específico primero al detectar. */
export type ModeloVehiculoCatalogo = {
  id: string;
  label: string;
  marca: string;
  /** Patrones normalizados (sin tildes, minúsculas). */
  patrones: string[];
};

export const MODELOS_VEHICULO_CATALOGO: ModeloVehiculoCatalogo[] = [
  { id: "megane-ii", label: "Megane II", marca: "Renault", patrones: ["megane ii", "megane 2", "megane ii scenic"] },
  { id: "megane-i", label: "Megane I", marca: "Renault", patrones: ["megane i", "megane 1", "megane i scenic"] },
  { id: "megane", label: "Megane", marca: "Renault", patrones: ["megane"] },
  { id: "clio-ii", label: "Clio II", marca: "Renault", patrones: ["clio ii", "clio 2"] },
  { id: "clio", label: "Clio", marca: "Renault", patrones: ["clio"] },
  { id: "kwid", label: "Kwid", marca: "Renault", patrones: ["kwid"] },
  { id: "sandero", label: "Sandero", marca: "Renault", patrones: ["sandero"] },
  { id: "logan", label: "Logan", marca: "Renault", patrones: ["logan"] },
  { id: "duster", label: "Duster", marca: "Renault", patrones: ["duster"] },
  { id: "stepway", label: "Stepway", marca: "Renault", patrones: ["stepway"] },
  { id: "symbol", label: "Symbol", marca: "Renault", patrones: ["symbol"] },
  { id: "fluence", label: "Fluence", marca: "Renault", patrones: ["fluence"] },
  { id: "optra", label: "Optra", marca: "Chevrolet", patrones: ["optra"] },
  { id: "aveo", label: "Aveo", marca: "Chevrolet", patrones: ["aveo", "allegro"] },
  { id: "spark", label: "Spark", marca: "Chevrolet", patrones: ["spark"] },
  { id: "onix", label: "Onix", marca: "Chevrolet", patrones: ["onix"] },
  { id: "sail", label: "Sail", marca: "Chevrolet", patrones: ["sail"] },
  { id: "tracker", label: "Tracker", marca: "Chevrolet", patrones: ["tracker"] },
  { id: "captiva", label: "Captiva", marca: "Chevrolet", patrones: ["captiva"] },
  { id: "cruze", label: "Cruze", marca: "Chevrolet", patrones: ["cruze"] },
  { id: "luv-dmax", label: "LUV / D-Max", marca: "Chevrolet", patrones: ["dmax", "d max", "d-max", "luv dmax", "luv d-max"] },
  { id: "rio", label: "Rio", marca: "Kia", patrones: ["rio", "xcite"] },
  { id: "picanto", label: "Picanto", marca: "Kia", patrones: ["picanto"] },
  { id: "sportage", label: "Sportage", marca: "Kia", patrones: ["sportage"] },
  { id: "cerato", label: "Cerato", marca: "Kia", patrones: ["cerato"] },
  { id: "accent", label: "Accent", marca: "Hyundai", patrones: ["accent"] },
  { id: "i10", label: "i10", marca: "Hyundai", patrones: ["i10"] },
  { id: "i20", label: "i20", marca: "Hyundai", patrones: ["i20"] },
  { id: "tucson", label: "Tucson", marca: "Hyundai", patrones: ["tucson"] },
  { id: "santa-fe", label: "Santa Fe", marca: "Hyundai", patrones: ["santa fe", "santafe"] },
  { id: "march", label: "March", marca: "Nissan", patrones: ["march"] },
  { id: "versa", label: "Versa", marca: "Nissan", patrones: ["versa"] },
  { id: "sentra", label: "Sentra", marca: "Nissan", patrones: ["sentra"] },
  { id: "frontier", label: "Frontier", marca: "Nissan", patrones: ["frontier", "np300", "navara"] },
  { id: "bt50", label: "BT-50", marca: "Mazda", patrones: ["bt50", "bt 50", "bt-50"] },
  { id: "mazda2", label: "Mazda 2", marca: "Mazda", patrones: ["mazda2", "mazda 2"] },
  { id: "mazda3", label: "Mazda 3", marca: "Mazda", patrones: ["mazda3", "mazda 3"] },
  { id: "ranger", label: "Ranger", marca: "Ford", patrones: ["ranger"] },
  { id: "fiesta", label: "Fiesta", marca: "Ford", patrones: ["fiesta"] },
  { id: "focus", label: "Focus", marca: "Ford", patrones: ["focus"] },
  { id: "corolla", label: "Corolla", marca: "Toyota", patrones: ["corolla"] },
  { id: "hilux", label: "Hilux", marca: "Toyota", patrones: ["hilux"] },
  { id: "prado", label: "Prado", marca: "Toyota", patrones: ["prado"] },
  { id: "gol", label: "Gol", marca: "Volkswagen", patrones: ["gol"] },
  { id: "polo", label: "Polo", marca: "Volkswagen", patrones: ["polo"] },
  { id: "jetta", label: "Jetta", marca: "Volkswagen", patrones: ["jetta"] },
  { id: "c3", label: "C3", marca: "Citroën", patrones: ["c3"] },
  { id: "c4", label: "C4", marca: "Citroën", patrones: ["c4"] },
  { id: "swift", label: "Swift", marca: "Suzuki", patrones: ["swift"] },
  { id: "vitara", label: "Vitara", marca: "Suzuki", patrones: ["vitara"] },
];

export const MARCA_POR_MODELO: Record<string, string> = Object.fromEntries(
  MODELOS_VEHICULO_CATALOGO.flatMap((m) =>
    m.patrones.map((p) => [modeloVehiculoCompacto(p), m.marca.toLowerCase()]),
  ),
);

function blobVehiculoPieza(p: PiezaInventario): string {
  return normalizarTextoBusqueda(`${p.nombre} ${p.aplicacion} ${p.marca} ${p.marcaProducto ?? ""}`);
}

function blobVehiculoCompacto(p: PiezaInventario): string {
  return modeloVehiculoCompacto(blobVehiculoPieza(p));
}

function patronEnPieza(p: PiezaInventario, patrones: string[]): boolean {
  const blob = blobVehiculoPieza(p);
  const compact = blobVehiculoCompacto(p);
  return patrones.some((pat) => {
    const pNorm = normalizarTextoBusqueda(pat);
    if (blob.includes(pNorm)) return true;
    const pCompact = modeloVehiculoCompacto(pNorm);
    return pCompact.length >= 2 && compact.includes(pCompact);
  });
}

/** Modelos detectados en una pieza (ids únicos, más específicos primero). */
export function modelosDetectadosEnPieza(p: PiezaInventario): ModeloVehiculoCatalogo[] {
  const out: ModeloVehiculoCatalogo[] = [];
  for (const m of MODELOS_VEHICULO_CATALOGO) {
    if (patronEnPieza(p, m.patrones)) out.push(m);
  }
  return out;
}

export function modeloCatalogoPorId(id: string): ModeloVehiculoCatalogo | undefined {
  return MODELOS_VEHICULO_CATALOGO.find((m) => m.id === id);
}

export function piezaCoincideModeloFiltro(p: PiezaInventario, modeloId: string): boolean {
  if (!modeloId) return true;
  const modelo = modeloCatalogoPorId(modeloId);
  if (!modelo) return true;
  return patronEnPieza(p, modelo.patrones);
}

function piezaCoincideMarcaVehiculo(p: PiezaInventario, marcaVehiculo: string): boolean {
  const marcaNorm = normalizarTextoBusqueda(marcaVehiculo);
  const blob = normalizarTextoBusqueda(`${p.aplicacion} ${p.nombre} ${p.marca}`);
  if (blob.includes(marcaNorm)) return true;
  return modelosDetectadosEnPieza(p).some(
    (m) => normalizarTextoBusqueda(m.marca) === marcaNorm,
  );
}

export function modelosVehiculoOpciones(
  piezas: PiezaInventario[],
  marcaVehiculo?: string,
): ModeloVehiculoCatalogo[] {
  const map = new Map<string, ModeloVehiculoCatalogo>();
  for (const p of piezas) {
    if (marcaVehiculo && !piezaCoincideMarcaVehiculo(p, marcaVehiculo)) continue;
    for (const m of modelosDetectadosEnPieza(p)) {
      if (marcaVehiculo && normalizarTextoBusqueda(m.marca) !== normalizarTextoBusqueda(marcaVehiculo))
        continue;
      map.set(m.id, m);
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "es"));
}
