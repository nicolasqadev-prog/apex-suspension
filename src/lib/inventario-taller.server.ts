import { aplicarDescuento } from "./pricing";
import { loadCatalogo, loadPiezaBySlug } from "./inventario.server";
import { getTallerFidelizadoByWhatsapp } from "./talleres.server";
import type { PiezaCatalogoTaller } from "./taller.types";

function mapPiezaTaller(
  pieza: import("./inventario").PiezaInventario,
  descuentoPorcentaje: number,
): PiezaCatalogoTaller {
  return {
    ...pieza,
    precioTaller: aplicarDescuento(pieza.precioLista, descuentoPorcentaje),
  };
}

export async function loadCatalogoTaller(
  whatsapp: string,
  opts?: { allowNoPublicado?: boolean },
) {
  const taller = await getTallerFidelizadoByWhatsapp(whatsapp, opts);
  if (!taller) {
    return { ok: false as const, reason: "no_autorizado" as const };
  }

  const catalogo = await loadCatalogo();
  return {
    ok: true as const,
    taller: {
      whatsapp: taller.whatsapp,
      nombreTaller: taller.nombreTaller,
      descuentoPorcentaje: taller.descuentoPorcentaje,
      contraEntregaHabilitada: taller.contraEntregaHabilitada,
      publicado: taller.publicado,
    },
    piezas: catalogo.piezas.map((p) => mapPiezaTaller(p, taller.descuentoPorcentaje)),
    moneda: catalogo.moneda,
    fuente: catalogo.fuente,
  };
}

export async function loadPiezaTaller(
  whatsapp: string,
  slug: string,
  opts?: { allowNoPublicado?: boolean },
) {
  const taller = await getTallerFidelizadoByWhatsapp(whatsapp, opts);
  if (!taller) {
    return { ok: false as const, reason: "no_autorizado" as const };
  }

  const data = await loadPiezaBySlug(slug);
  if (!data.pieza) {
    return { ok: false as const, reason: "no_encontrada" as const };
  }

  return {
    ok: true as const,
    taller: {
      whatsapp: taller.whatsapp,
      nombreTaller: taller.nombreTaller,
      descuentoPorcentaje: taller.descuentoPorcentaje,
      contraEntregaHabilitada: taller.contraEntregaHabilitada,
    },
    pieza: mapPiezaTaller(data.pieza, taller.descuentoPorcentaje),
    moneda: data.moneda,
    fuente: data.fuente,
  };
}
