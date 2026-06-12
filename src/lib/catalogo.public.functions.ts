import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { loadCatalogo, loadPiezaBySlug } from "./inventario.server";

/** Catálogo público: siempre en servidor (Supabase + imágenes). */
export const obtenerCatalogoPublico = createServerFn({ method: "GET" }).handler(async () => {
  return loadCatalogo();
});

const SlugSchema = z.object({
  slug: z.string().min(1).max(120),
});

/** Detalle por slug: siempre en servidor; evita fallback a JSON demo en el móvil. */
export const obtenerPiezaCatalogoPublico = createServerFn({ method: "POST" })
  .inputValidator(SlugSchema)
  .handler(async ({ data }) => {
    return loadPiezaBySlug(data.slug);
  });
