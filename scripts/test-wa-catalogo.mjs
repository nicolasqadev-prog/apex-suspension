import { loadEnvLocal } from "./parse-env-local.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const [k, v] of Object.entries(loadEnvLocal(join(root, ".env.local")))) {
  if (!process.env[k]) process.env[k] = v;
}

const { extraerContextoCotizacion, resolverCandidatosMostrador } = await import(
  "../src/lib/mostrador-inventario.server.ts"
);
const { resolverConAclaracion } = await import("../src/lib/whatsapp-agent/aclaracion.server.ts");

const cases = [
  { q: "amortiguadores delanteros y traseros renault megane 2", qty: 4 },
  { q: "Los cuatro amortiguadores de un Renault KWID", qty: 4 },
  { q: "Los dos amortiguadores de un Kia rio XCITE", qty: 2 },
];

for (const { q, qty } of cases) {
  const ctx = extraerContextoCotizacion(q);
  const { candidatos } = await resolverCandidatosMostrador(q);
  const acl = resolverConAclaracion(ctx, candidatos, qty);
  console.log("\n---", q);
  console.log("ctx:", ctx.pieza, ctx.marcaVehiculo, ctx.vehiculo);
  console.log(
    "candidatos:",
    candidatos.length,
    candidatos.slice(0, 4).map((p) => `${p.referencia} (${p.disponibilidad})`),
  );
  console.log("decision:", acl.tipo, acl.tipo === "preguntar" ? acl.pregunta.slice(0, 100) : "");
}
