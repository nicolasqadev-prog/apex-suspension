import type { PiezaInventario } from "./inventario";

export type TallerSesion = {
  whatsapp: string;
  nombreTaller: string;
  descuentoPorcentaje: number;
  contraEntregaHabilitada: boolean;
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
  stock: number;
};
