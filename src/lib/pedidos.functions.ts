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
    const minutes =
      typeof data === "object" &&
      data !== null &&
      "minutes" in data &&
      typeof (data as { minutes?: unknown }).minutes === "number"
        ? (data as { minutes: number }).minutes
        : 30;
    return { minutes: Math.max(5, Math.min(240, minutes)) };
  })
  .handler(async ({ data }) => {
    return listPedidosRecientes(data.minutes);
  });
