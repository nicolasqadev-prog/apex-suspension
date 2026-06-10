/** Minutos para marcar un pedido como "nuevo" en el panel de despachos. */
export const PEDIDO_NUEVO_MINUTOS = 15;

/** Intervalo de auto-refresh del admin en operación (ms). */
export const ADMIN_REFRESH_MS = PEDIDO_NUEVO_MINUTOS * 60 * 1000;

export function esPedidoNuevoReciente(createdAt: string, ahora = Date.now()): boolean {
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return ahora - t <= PEDIDO_NUEVO_MINUTOS * 60 * 1000;
}

export const ESTADOS_POR_DESPACHAR = [
  "borrador",
  "cotizado",
  "confirmado",
  "empacando",
] as const;

export const ESTADO_EN_RUTA = "en_ruta";
export const ESTADO_ENTREGADO = "entregado";
