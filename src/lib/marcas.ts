export type MarcaInfo = {
  nombre: string;
  descripcionCorta: string;
  foco: string[];
};

export const MARCAS: Record<string, MarcaInfo> = {
  KTC: {
    nombre: "KTC",
    descripcionCorta: "Suspensión y dirección para alta rotación.",
    foco: ["Suspensión", "Dirección"],
  },
  Corven: {
    nombre: "Corven",
    descripcionCorta:
      "Autopartes enfocadas en suspensión y dirección (amortiguación y tren delantero).",
    foco: ["Suspensión", "Dirección", "Amortiguación"],
  },
  Nakata: {
    nombre: "Nakata",
    descripcionCorta:
      "Componentes de suspensión y dirección (amortiguadores, rótulas, bieletas, terminales).",
    foco: ["Suspensión", "Dirección"],
  },
  SABO: {
    nombre: "SABO",
    descripcionCorta: "Sistemas de sellado: retenes, juntas y componentes de vedación.",
    foco: ["Retenes", "Juntas", "Sellos"],
  },
  MOOG: {
    nombre: "MOOG",
    descripcionCorta: "Suspensión y dirección premium (rótulas, brazos, links, bujes).",
    foco: ["Suspensión", "Dirección"],
  },
};

export function marcaInfo(marca: string | undefined): MarcaInfo | undefined {
  if (!marca) return undefined;
  return MARCAS[marca] ?? undefined;
}
