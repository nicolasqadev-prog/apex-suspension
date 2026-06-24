import { createServerFn } from "@tanstack/react-start";

import { ConfirmarPedidoSchema, InputSchema } from "./mostrador-schemas";

export type { MostradorTurnoInput } from "./mostrador-schemas";
export type { MostradorResponsePublic } from "./mostrador";

function getIpFromHeaders(headers: Headers): string {
  const cf = headers.get("CF-Connecting-IP");
  if (cf) return cf.trim();
  const xff = headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

export const responderMostrador = createServerFn({ method: "POST" })
  .inputValidator(InputSchema)
  .handler(async (ctx) => {
    const data = (ctx as { data: import("./mostrador-schemas").MostradorTurnoInput }).data;
    const request = (ctx as { request?: Request }).request;
    const ip = request ? getIpFromHeaders(request.headers) : "unknown";
    const { ejecutarResponderMostrador } = await import("./mostrador-turno.server");
    return ejecutarResponderMostrador(data, ip);
  });

export const confirmarPedidoMostrador = createServerFn({ method: "POST" })
  .inputValidator(ConfirmarPedidoSchema)
  .handler(async (ctx) => {
    const data = (ctx as { data: import("./mostrador-schemas").ConfirmarPedidoInput }).data;
    const request = (ctx as { request?: Request }).request;
    const ip = request ? getIpFromHeaders(request.headers) : "unknown";
    const { ejecutarConfirmarPedido } = await import("./mostrador-turno.server");
    return ejecutarConfirmarPedido(data, ip);
  });
