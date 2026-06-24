/** Marcas de producto / proveedor que Apex comercializa (no marca de vehículo). */

export type MarcaProveedorMeta = {
  id: string;
  nombre: string;
  descripcionCorta: string;
  foco: string[];
  logoSrc: string;
  destacada: boolean;
};

const ALIAS: Record<string, string> = {
  UNIVERSAL: "CTR",
  HYUNDAI_MOBIS: "Mobis",
  HYUNDAIMOBIS: "Mobis",
  TOYAMA: "Toyama",
  DISTRICAMIONES: "Districamiones",
};

export const MARCAS_PROVEEDOR: Record<string, MarcaProveedorMeta> = {
  KTC: {
    id: "ktc",
    nombre: "KTC",
    descripcionCorta: "Suspensión y dirección — referencia en bodega y bajo pedido.",
    foco: ["Suspensión", "Dirección"],
    logoSrc: "/marcas/ktc.svg",
    destacada: true,
  },
  STP: {
    id: "stp",
    nombre: "STP",
    descripcionCorta: "Línea de mantenimiento y componentes de desgaste.",
    foco: ["Filtros", "Frenos", "Mantenimiento"],
    logoSrc: "/marcas/stp.svg",
    destacada: true,
  },
  WURTEX: {
    id: "wurtex",
    nombre: "Wurtex",
    descripcionCorta: "Componentes de suspensión y dirección con buena relación costo.",
    foco: ["Suspensión", "Dirección"],
    logoSrc: "/marcas/wurtex.svg",
    destacada: true,
  },
  YOKOMITSU: {
    id: "yokomitsu",
    nombre: "Yokomitsu",
    descripcionCorta: "Suspensión y dirección — catálogo amplio bajo pedido.",
    foco: ["Suspensión", "Dirección", "Tijeras"],
    logoSrc: "/marcas/yokomitsu.svg",
    destacada: true,
  },
  CTR: {
    id: "ctr",
    nombre: "CTR",
    descripcionCorta: "Amortiguadores y tren delantero — cotización bajo pedido.",
    foco: ["Amortiguadores", "Dirección"],
    logoSrc: "/marcas/ctr.svg",
    destacada: true,
  },
  TOYAMA: {
    id: "toyama",
    nombre: "Toyama",
    descripcionCorta: "Alternativa en amortiguación y componentes.",
    foco: ["Amortiguadores"],
    logoSrc: "/marcas/toyama.svg",
    destacada: false,
  },
  MOBIS: {
    id: "mobis",
    nombre: "Mobis",
    descripcionCorta: "Línea original Hyundai-Kia Mobis.",
    foco: ["OEM", "Amortiguadores"],
    logoSrc: "/marcas/mobis.svg",
    destacada: false,
  },
  DMB: {
    id: "dmb",
    nombre: "DMB",
    descripcionCorta: "Terminales y rótulas en bodega.",
    foco: ["Dirección"],
    logoSrc: "/marcas/dmb.svg",
    destacada: false,
  },
};

export const MARCAS_DESTACADAS_HOME = ["KTC", "STP", "WURTEX", "YOKOMITSU", "CTR"] as const;

function clave(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function normalizarMarcaProveedor(raw: string | undefined | null): string {
  const t = (raw ?? "").trim();
  if (!t) return "KTC";
  const k = clave(t);
  if (ALIAS[k]) return ALIAS[k];
  const direct = MARCAS_PROVEEDOR[k];
  if (direct) return direct.nombre;
  if (k.includes("CTR")) return "CTR";
  if (k.includes("YOKOMITSU")) return "Yokomitsu";
  if (k.includes("WURTEX")) return "Wurtex";
  if (k === "STP") return "STP";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function metaMarcaProveedor(raw: string | undefined | null): MarcaProveedorMeta | undefined {
  const nombre = normalizarMarcaProveedor(raw);
  const k = clave(nombre);
  return MARCAS_PROVEEDOR[k] ?? MARCAS_PROVEEDOR[clave(raw ?? "")];
}

export function etiquetaMarcaProveedor(raw: string | undefined | null): string {
  return normalizarMarcaProveedor(raw);
}
