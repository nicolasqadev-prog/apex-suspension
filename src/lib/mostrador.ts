import { enlaceWhatsApp, mensajeConfirmacionCotizacion } from "./whatsapp";

export type DisponibilidadMostrador = "bodega" | "bajo_pedido" | "no_catalogo";

export type MostradorDraft = {
  piezaOSintoma: string;
  carro?: string;
  ano?: string;
  version?: string;
  municipio?: string;
  whatsapp?: string;
  handoffTag?: "normal" | "bajo_encargo";
  primarySuggestion?: string;
  tallerCuenta?: { validado: boolean; contraEntregaHabilitada?: boolean };
  lineasCotizadas?: MostradorCotizacionLinea[];
};

export type MostradorCotizacionLinea = {
  slug: string;
  referencia: string;
  nombre: string;
  marcaProducto: string;
  precioUnitarioCop: number;
  precioPublicoCop: number;
  stock: number;
  disponibilidad: DisponibilidadMostrador;
  cantidadSugerida?: number;
};

export type MostradorCarritoLinea = {
  slug: string;
  referencia: string;
  nombre: string;
  cantidad: number;
  precioUnitarioCop: number;
  disponibilidad: DisponibilidadMostrador;
};

export type MostradorResponsePublic = {
  ok: true;
  reply: string;
  questions: string[];
  action: "ask_more" | "quote" | "out_of_scope" | "handoff_whatsapp";
  handoffTag?: "normal" | "bajo_encargo";
  cotizacion?: MostradorCotizacionLinea[];
  tallerCuenta?: {
    validado: boolean;
    nombreTaller?: string;
    descuentoPorcentaje?: number;
    contraEntregaHabilitada?: boolean;
    municipio?: string;
    direccionEntrega?: string;
  };
  alcance?: "en_alcance" | "bajo_encargo" | "fuera_alcance";
};

export function formatoCop(cop: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cop);
}

export function etiquetaDisponibilidad(d: DisponibilidadMostrador): string {
  if (d === "bodega") return "En bodega — despacho inmediato";
  if (d === "bajo_pedido") return "Bajo pedido — se confirma por WhatsApp";
  return "No en catálogo";
}

export function buildWhatsappHandoffLink(d: MostradorDraft): string {
  const pieza = d.piezaOSintoma?.trim();
  const prioridad = d.primarySuggestion?.trim();
  const piezaConPrioridad =
    pieza && prioridad
      ? `${pieza}\nPrioridad para cotizar (orientación, no diagnóstico): ${prioridad}`
      : pieza;
  const prefix = d.handoffTag === "bajo_encargo" ? "BAJO ENCARGO — " : "";

  const lineasTxt =
    d.lineasCotizadas?.length &&
    d.lineasCotizadas
      .map(
        (l) =>
          `· ${l.referencia} ×${l.cantidadSugerida ?? 1} — ${formatoCop(l.precioUnitarioCop)} (${etiquetaDisponibilidad(l.disponibilidad)})`,
      )
      .join("\n");

  const msg = mensajeConfirmacionCotizacion({
    pieza: piezaConPrioridad
      ? `${prefix}Orientación para cotizar: ${piezaConPrioridad}`
      : `${prefix}Orientación para cotizar`,
    whatsapp: d.whatsapp,
    vehiculo: d.carro,
    ano: d.ano,
    version: d.version,
  });

  const municipio = d.municipio?.trim();
  const tallerNote =
    d.tallerCuenta?.validado === true
      ? d.tallerCuenta.contraEntregaHabilitada === true
        ? "\nNota: somos taller validado en Apex; en nuestra cuenta aplica contra entrega (confirmar con el equipo)."
        : "\nNota: somos taller validado en Apex (confirmar condiciones de pago/entrega con el equipo)."
      : "";

  const bloques = [
    msg,
    lineasTxt ? `Cotización referencia:\n${lineasTxt}` : null,
    municipio ? `Municipio: ${municipio}` : null,
    tallerNote || null,
  ].filter(Boolean);

  return enlaceWhatsApp(bloques.join("\n\n"));
}

export function normalizeShortText(raw: string, max = 280): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

export function totalCarrito(lineas: MostradorCarritoLinea[]): number {
  return lineas.reduce((s, l) => s + l.precioUnitarioCop * l.cantidad, 0);
}
