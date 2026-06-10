import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createPedido, listPedidosRecientes } from "./pedidos.server";

const PedidoInputSchema = z.object({
  tallerNombre: z.string().min(2),
  whatsapp: z.string().min(7),
  municipio: z.string().min(2),
  direccion: z.string().min(5),
  referencia: z.string().optional(),
  requerimiento: z.string().optional(),
  notas: z.string().optional(),
});

export const crearPedidoDesdeWeb = createServerFn({ method: "POST" })
  .inputValidator(PedidoInputSchema)
  .handler(async ({ data }) => {
    return createPedido(data);
  });

export const listarPedidosRecientes = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => {
    const d = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
    const minutes = typeof d.minutes === "number" ? d.minutes : 120;
    const ventana = d.ventana === "minutos" ? ("minutos" as const) : ("dia" as const);
    return {
      ventana,
      minutes: Math.max(5, Math.min(240, minutes)),
      soloPrueba: d.soloPrueba === true,
      soloProduccion: d.soloProduccion === true,
    };
  })
  .handler(async ({ data }) => {
    return listPedidosRecientes({
      ventana: data.ventana,
      minutes: data.minutes,
      soloPrueba: data.soloPrueba,
      soloProduccion: data.soloProduccion,
    });
  });
