import type { ContextoCotizacion, ProductoMostrador } from "../mostrador-inventario.server";
import { normalizarCtxVehiculo } from "../mostrador-inventario.server";

export type ResultadoAclaracion =
  | { tipo: "ok"; producto: ProductoMostrador; cantidad: number }
  | {
      tipo: "preguntar";
      pregunta: string;
      candidatosSlugs: string[];
      ctx: ContextoCotizacion;
      cantidad: number;
    }
  | { tipo: "cotizar_kit"; productos: ProductoMostrador[]; cantidades: number[]; ctx: ContextoCotizacion }
  | { tipo: "sin_match" };

function blob(p: ProductoMostrador): string {
  return `${p.nombre} ${p.aplicacion}`.toLowerCase();
}

export function posicionDesdeProducto(p: ProductoMostrador): "delantera" | "trasera" | undefined {
  const b = blob(p);
  if (/\b(trasera?s?|trasero?s?|tras)\b/i.test(b)) return "trasera";
  if (/\b(delantera?s?|delantero?s?|delant)\b/i.test(b)) return "delantera";
  if (/\bdel\b/i.test(b) && /\bamort/i.test(b)) return "delantera";
  if (/\bfront\b/i.test(b)) return "delantera";
  if (/\brear\b/i.test(b)) return "trasera";
  return undefined;
}

export function ladoDesdeProducto(p: ProductoMostrador): "izquierda" | "derecha" | undefined {
  const b = blob(p);
  if (/\b(izquierd|izq|left|lh)\b/i.test(b)) return "izquierda";
  if (/\b(derech|der|right|rh)\b/i.test(b)) return "derecha";
  return undefined;
}

function etiquetaVehiculo(ctx: ContextoCotizacion): string {
  const c = normalizarCtxVehiculo({ ...ctx, textoCompleto: ctx.textoCompleto ?? "" });
  return [c.marcaVehiculo, c.vehiculo, c.ano].filter(Boolean).join(" ") || "ese vehículo";
}

function filtrarPorPosicion(
  candidatos: ProductoMostrador[],
  posicion: "delantera" | "trasera",
): ProductoMostrador[] {
  return candidatos.filter((p) => posicionDesdeProducto(p) === posicion);
}

function filtrarPorLado(
  candidatos: ProductoMostrador[],
  lado: "izquierda" | "derecha",
): ProductoMostrador[] {
  return candidatos.filter((p) => ladoDesdeProducto(p) === lado);
}

function elegirUnico(candidatos: ProductoMostrador[]): ProductoMostrador | null {
  if (candidatos.length === 1) return candidatos[0];
  const conStock = candidatos.filter((p) => p.stock > 0);
  if (conStock.length === 1) return conStock[0];
  return null;
}

function resolverAmortiguador(
  ctx: ContextoCotizacion,
  candidatos: ProductoMostrador[],
  cantidad: number,
): ResultadoAclaracion {
  const veh = etiquetaVehiculo(ctx);
  const del = filtrarPorPosicion(candidatos, "delantera");
  const tras = filtrarPorPosicion(candidatos, "trasera");

  if (!ctx.posicion && del.length > 0 && tras.length > 0) {
    if (cantidad >= 4) {
      return {
        tipo: "preguntar",
        pregunta:
          `Para el *${veh}*, ¿los *${cantidad}* amortiguadores son *2 delanteros y 2 traseros*?\n` +
          `(Responde *sí* si es el juego completo, o dime *delanteros* / *traseros*.)`,
        candidatosSlugs: candidatos.map((p) => p.slug),
        ctx,
        cantidad,
      };
    }
    if (cantidad === 2) {
      return {
        tipo: "preguntar",
        pregunta:
          `Para el *${veh}*, ¿los *2* amortiguadores son *delanteros* o *traseros*?`,
        candidatosSlugs: candidatos.map((p) => p.slug),
        ctx,
        cantidad,
      };
    }
    return {
      tipo: "preguntar",
      pregunta:
        `Para el *${veh}* manejamos amortiguadores *delanteros* y *traseros*. ¿Cuáles necesitas?`,
      candidatosSlugs: candidatos.map((p) => p.slug),
      ctx,
      cantidad,
    };
  }

  let grupo = ctx.posicion
    ? filtrarPorPosicion(candidatos, ctx.posicion)
    : candidatos.filter((p) => !posicionDesdeProducto(p) || posicionDesdeProducto(p) === ctx.posicion);

  if (!grupo.length) grupo = candidatos;

  if (ctx.lado) grupo = filtrarPorLado(grupo, ctx.lado);

  const unico = elegirUnico(grupo);
  if (unico) return { tipo: "ok", producto: unico, cantidad };

  const lados = new Set(grupo.map(ladoDesdeProducto).filter(Boolean));
  if (lados.size > 1 && !ctx.lado) {
    return {
      tipo: "preguntar",
      pregunta: `Para el *${veh}*, ¿el amortiguador es *izquierdo* o *derecho*?`,
      candidatosSlugs: grupo.map((p) => p.slug),
      ctx,
      cantidad,
    };
  }

  if (grupo.length > 0) {
    return { tipo: "ok", producto: grupo[0], cantidad };
  }

  return { tipo: "sin_match" };
}

function resolverConLado(
  ctx: ContextoCotizacion,
  candidatos: ProductoMostrador[],
  cantidad: number,
  etiquetaPieza: string,
): ResultadoAclaracion {
  const veh = etiquetaVehiculo(ctx);
  let grupo = candidatos;
  if (ctx.lado) grupo = filtrarPorLado(grupo, ctx.lado);

  const unico = elegirUnico(grupo);
  if (unico) return { tipo: "ok", producto: unico, cantidad };

  const lados = new Set(candidatos.map(ladoDesdeProducto).filter(Boolean));
  if (lados.size > 1 && !ctx.lado) {
    return {
      tipo: "preguntar",
      pregunta: `Para el *${veh}*, ¿la ${etiquetaPieza} es *izquierda* o *derecha*?`,
      candidatosSlugs: candidatos.map((p) => p.slug),
      ctx,
      cantidad,
    };
  }

  if (grupo.length > 0) return { tipo: "ok", producto: grupo[0], cantidad };
  return { tipo: "sin_match" };
}

/** Decide si cotizar directo o preguntar (delantero/trasero, lado, juego completo). */
export function resolverConAclaracion(
  ctx: ContextoCotizacion,
  candidatos: ProductoMostrador[],
  cantidad: number,
): ResultadoAclaracion {
  if (!candidatos.length) return { tipo: "sin_match" };

  const pieza = ctx.pieza?.toLowerCase().replace("rótula", "rotula") ?? "";

  if (pieza.includes("amortiguador")) {
    return resolverAmortiguador(ctx, candidatos, cantidad);
  }
  if (pieza === "rotula" || pieza === "rótula") {
    return resolverConLado(ctx, candidatos, cantidad, "rótula");
  }
  if (pieza.includes("terminal")) {
    return resolverConLado(ctx, candidatos, cantidad, "terminal");
  }
  if (pieza === "tijera") {
    return resolverConLado(ctx, candidatos, cantidad, "tijera");
  }
  if (pieza === "bieleta" || pieza === "link") {
    const unico = elegirUnico(candidatos);
    if (unico) return { tipo: "ok", producto: unico, cantidad };
    if (candidatos.length > 1) {
      return {
        tipo: "preguntar",
        pregunta:
          `Para el *${etiquetaVehiculo(ctx)}* hay varias bieletas. ¿Delantera o trasera? ¿Izquierda o derecha?`,
        candidatosSlugs: candidatos.map((p) => p.slug),
        ctx,
        cantidad,
      };
    }
  }

  const unico = elegirUnico(candidatos);
  if (unico) return { tipo: "ok", producto: unico, cantidad };
  if (candidatos.length === 1) return { tipo: "ok", producto: candidatos[0], cantidad };
  return { tipo: "ok", producto: candidatos[0], cantidad };
}

/** Interpreta la respuesta del cliente a una pregunta de aclaración. */
export function refinarContextoDesdeRespuesta(
  texto: string,
  ctx: ContextoCotizacion,
  cantidad: number,
): { ctx: ContextoCotizacion; cantidad: number; juegoCompleto4: boolean } {
  const t = texto.toLowerCase();
  const next: ContextoCotizacion = { ...ctx };
  let qty = cantidad;
  let juegoCompleto4 = false;

  if (/\bdelantera?s?\b|\bdelanteros?\b|\bdelan\b/.test(t)) next.posicion = "delantera";
  if (/\btrasera?s?\b|\btraseros?\b|\btras\b/.test(t)) next.posicion = "trasera";
  if (/\b(izquierd|izq)\b/.test(t)) next.lado = "izquierda";
  if (/\b(derech|der)\b/.test(t)) next.lado = "derecha";

  const mencionaDel = /\bdelantera?s?\b|\bdelanteros?\b/.test(t);
  const mencionaTras = /\btrasera?s?\b|\btraseros?\b/.test(t);

  if (
    (cantidad >= 4 ||
      /\b2\s*y\s*2\b/i.test(t) ||
      (mencionaDel && mencionaTras && /\b(dos|2)\b/i.test(t))) &&
    (mencionaDel && mencionaTras ||
      /\b(juego\s+completo|los\s+4|las\s+4|ambos\s+lados)\b/i.test(t) ||
      /^\s*s[ií]\s*$/i.test(t.trim()))
  ) {
    juegoCompleto4 = true;
    delete next.posicion;
  } else if (
    cantidad >= 4 &&
    (/\b2\s+delantera.*2\s+trasera/i.test(t) ||
      /\bdelantera.*y.*trasera/i.test(t) ||
      /\b(juego\s+completo|los\s+4|las\s+4|ambos\s+lados)\b/i.test(t) ||
      /^\s*s[ií]\s*$/i.test(t.trim()))
  ) {
    juegoCompleto4 = true;
  }

  const qtyMatch = t.match(/\b(\d{1,2})\b/);
  if (qtyMatch) {
    const n = Number(qtyMatch[1]);
    if (n >= 1 && n <= 99) qty = n;
  }

  return { ctx: next, cantidad: qty, juegoCompleto4 };
}

export function armarCotizacionJuegoAmortiguadores(
  ctx: ContextoCotizacion,
  candidatos: ProductoMostrador[],
): { productos: ProductoMostrador[]; cantidades: number[] } | null {
  const del = filtrarPorPosicion(candidatos, "delantera");
  const tras = filtrarPorPosicion(candidatos, "trasera");
  const delU = elegirUnico(del) ?? del[0];
  const trasU = elegirUnico(tras) ?? tras[0];
  if (!delU || !trasU) return null;
  return { productos: [delU, trasU], cantidades: [2, 2] };
}
