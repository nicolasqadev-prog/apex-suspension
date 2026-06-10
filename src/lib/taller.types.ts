import type { PiezaInventario } from "./inventario";

export type TallerSesion = {
  whatsapp: string;
  nombreTaller: string;
  descuentoPorcentaje: number;
  contraEntregaHabilitada: boolean;
  municipio: string;
  direccionEntrega: string;
};

export type PiezaCatalogoTaller = PiezaInventario & {
  precioTaller: number;
};

export type LineaCarritoTaller = {
  slug: string;
  referencia: string;
  nombre: string;
  cantidad: number;
  precioUnitarioCop: number;
  /** Precio lista pública al agregar (para sumar ahorro en pedido). */
  precioListaPublicoCop?: number;
  stock: number;
};
