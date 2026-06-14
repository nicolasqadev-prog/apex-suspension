import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  cerrarSesionAdmin,
  establecerSesionAdmin,
  sesionAdminValida,
} from "./admin-session.server";

const PinSchema = z.object({
  pin: z.string().min(4).max(64),
});

export const iniciarSesionAdmin = createServerFn({ method: "POST" })
  .inputValidator(PinSchema)
  .handler(async ({ data, request }) => {
    return establecerSesionAdmin(data.pin, request);
  });

export const cerrarSesionAdminFn = createServerFn({ method: "POST" }).handler(async () => {
  cerrarSesionAdmin();
  return { ok: true as const };
});

export const sesionAdminActiva = createServerFn({ method: "GET" }).handler(async () => {
  const ok = await sesionAdminValida();
  return { ok };
});
