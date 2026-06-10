/** Estados visibles para el taller (sin jerga interna). */
export const FLUJO_ESTADOS_TALLER = [
  "borrador",
  "cotizado",
  "confirmado",
  "empacando",
  "en_ruta",
  "entregado",
] as const;

export function etiquetaEstadoTaller(estado: string): string {
  switch (estado) {
    case "borrador":
      return "Pedido enviado";
    case "cotizado":
      return "En revisión";
    case "confirmado":
      return "Confirmado";
    case "empacando":
      return "Alistando en bodega";
    case "en_ruta":
      return "En camino a tu taller";
    case "entregado":
      return "Entregado";
    case "cancelado":
      return "Cancelado";
    default:
      return "En proceso";
  }
}

export function mensajeEstadoTaller(estado: string): string {
  switch (estado) {
    case "borrador":
      return "Tu pedido ya está en Apex. Te avisamos cuando lo confirmemos (stock y despacho).";
    case "cotizado":
      return "Estamos confirmando stock y referencias.";
    case "confirmado":
      return "Tu pedido quedó confirmado.";
    case "empacando":
      return "Estamos preparando tu pedido en bodega.";
    case "en_ruta":
      return "Tu pedido va en camino.";
    case "entregado":
      return "Pedido entregado. Gracias por confiar en Apex.";
    case "cancelado":
      return "Este pedido fue cancelado. Escríbenos por WhatsApp si necesitas ayuda.";
    default:
      return "Te avisamos cuando haya novedades.";
  }
}

export function indiceFlujoEstado(estado: string): number {
  const i = FLUJO_ESTADOS_TALLER.indexOf(estado as (typeof FLUJO_ESTADOS_TALLER)[number]);
  return i >= 0 ? i : 0;
}

export function refPedidoCorta(id: string): string {
  const limpio = id.replace(/-/g, "");
  return limpio.slice(-6).toUpperCase();
}
