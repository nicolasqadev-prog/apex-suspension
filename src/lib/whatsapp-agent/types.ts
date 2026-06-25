import type { DisponibilidadMostrador, MostradorCotizacionLinea } from "../mostrador";
import type { ContextoCotizacion } from "../mostrador-inventario.server";

/** Fases del agente WhatsApp (plantilla reutilizable). */
export type WaAgentPhase =
  | "idle"
  | "esperando_aclaracion"
  | "cotizado"
  | "esperando_confirmacion"
  | "pedido_creado";

export type AclaracionPendienteWa = {
  segmento: string;
  ctx: ContextoCotizacion;
  candidatosSlugs: string[];
  cantidadSugerida: number;
  pregunta: string;
};

export type BorradorPedidoWa = {
  slug: string;
  referencia: string;
  nombre: string;
  marcaProducto: string;
  cantidad: number;
  precioUnitarioCop: number;
  stock: number;
  disponibilidad: DisponibilidadMostrador;
  vehiculoResumen: string;
  piezaResumen: string;
  alcance: "en_alcance" | "bajo_encargo" | "fuera_alcance";
  esPrecioTaller: boolean;
  nombreTaller?: string;
  resumenEnviado: string;
  /** Token que debe coincidir al escribir CONFIRMO. */
  confirmToken: string;
};

export type CarritoItemWa = {
  slug: string;
  referencia: string;
  nombre: string;
  marcaProducto: string;
  cantidad: number;
  precioUnitarioCop: number;
  stock: number;
  disponibilidad: DisponibilidadMostrador;
  vehiculoResumen: string;
  piezaResumen: string;
  alcance: "en_alcance" | "bajo_encargo" | "fuera_alcance";
};

export type WaAgentState = {
  phase: WaAgentPhase;
  borrador: BorradorPedidoWa | null;
  /** Saludo de marca ya enviado en esta sesión. */
  greeted: boolean;
  aclaracionPendiente: AclaracionPendienteWa | null;
  /** Cotizaciones acumuladas en la conversación (varias piezas). */
  carrito: CarritoItemWa[];
  /** Confirmación de pedido con varias líneas del carrito. */
  confirmacionCarrito: boolean;
};

export const WA_AGENT_BRAND = "Apex Suspensión";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export type WaSession = {
  history: ChatMsg[];
  lastCotizacion: MostradorCotizacionLinea[];
  agent: WaAgentState;
  updatedAt: number;
};

export function freshAgentState(): WaAgentState {
  return {
    phase: "idle",
    borrador: null,
    greeted: false,
    aclaracionPendiente: null,
    carrito: [],
    confirmacionCarrito: false,
  };
}

export function freshWaSession(): WaSession {
  return {
    history: [],
    lastCotizacion: [],
    agent: freshAgentState(),
    updatedAt: Date.now(),
  };
}
