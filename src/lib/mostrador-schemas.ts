import { z } from "zod";

export const InputSchema = z.object({
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .max(20),
  context: z
    .object({
      whatsapp: z.string().optional(),
      carro: z.string().optional(),
      ano: z.string().optional(),
      version: z.string().optional(),
      municipio: z.string().optional(),
      piezaPrioritaria: z.string().optional(),
      canal: z.enum(["whatsapp", "web"]).optional(),
    })
    .optional(),
});

export const ConfirmarPedidoSchema = z.object({
  whatsapp: z.string().min(7).max(20),
  nombreCliente: z.string().max(80).optional(),
  municipio: z.string().max(80).optional(),
  direccion: z.string().max(200).optional(),
  notas: z.string().max(500).optional(),
  lineas: z
    .array(
      z.object({
        slug: z.string().min(1).max(120),
        cantidad: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(20),
});

export type MostradorTurnoInput = z.infer<typeof InputSchema>;
export type ConfirmarPedidoInput = z.infer<typeof ConfirmarPedidoSchema>;
