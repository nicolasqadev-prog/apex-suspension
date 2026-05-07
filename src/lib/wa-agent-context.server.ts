import { aplicarDescuento, DOMICILIO_COP, totalConDomicilio, type LineaPrecio } from "./pricing";
import { getTallerFidelizadoByWhatsapp } from "./talleres.server";

export type AgentTallerContext =
  | { tipoCliente: "particular" }
  | {
      tipoCliente: "taller_validado";
      descuentoPorcentaje: number;
      contraEntregaHabilitada: boolean;
    };

export async function agentContextFromWhatsapp(whatsapp: string): Promise<AgentTallerContext> {
  const taller = await getTallerFidelizadoByWhatsapp(whatsapp);
  if (!taller) return { tipoCliente: "particular" };
  return {
    tipoCliente: "taller_validado",
    descuentoPorcentaje: taller.descuentoPorcentaje,
    contraEntregaHabilitada: taller.contraEntregaHabilitada,
  };
}

export function precioUnitarioAgente(precioBaseCop: number, ctx: AgentTallerContext): number {
  if (ctx.tipoCliente !== "taller_validado") return Math.round(Number(precioBaseCop));
  return aplicarDescuento(precioBaseCop, ctx.descuentoPorcentaje);
}

/**
 * Total para cotizar/confirmar por WhatsApp.
 * Incluye DOMICILIO_COP "absorbido" (no se debe desglosar en el mensaje).
 */
export function totalAgente(lineas: LineaPrecio[]): number {
  return totalConDomicilio(lineas);
}

export { DOMICILIO_COP };
