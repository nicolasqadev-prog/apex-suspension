import { loadEnvLocal } from "./parse-env-local.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolverCandidatosMostrador } from "../src/lib/mostrador-inventario.server.ts";
import {
  refinarContextoDesdeRespuesta,
  resolverConAclaracion,
  posicionDesdeProducto,
} from "../src/lib/whatsapp-agent/aclaracion.server.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const [k, v] of Object.entries(loadEnvLocal(join(root, ".env.local")))) {
  if (!process.env[k]) process.env[k] = v;
}

const segmento = "Hola buen dia necesito los amortiguadores de un Renault megane 2";
const { ctx, candidatos } = await resolverCandidatosMostrador(segmento);
console.log("ctx inicial", ctx);
console.log(
  "candidatos",
  candidatos.map((p) => ({
    ref: p.referencia,
    stock: p.stock,
    pos: posicionDesdeProducto(p),
    slug: p.slug,
  })),
);

const refinado = refinarContextoDesdeRespuesta("Delanteros", ctx, 1);
console.log("refinado", refinado);

const { candidatos: c2 } = await resolverCandidatosMostrador(segmento, refinado.ctx.pieza);
const pool = c2.filter((p) => candidatos.some((x) => x.slug === p.slug));
console.log("pool", pool.length, pool.map((p) => p.referencia));

const decision = resolverConAclaracion(refinado.ctx, pool.length ? pool : c2, refinado.cantidad);
console.log("decision", decision.tipo, decision);
