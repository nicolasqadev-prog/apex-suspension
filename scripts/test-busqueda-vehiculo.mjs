/**
 * Prueba offline de extracción de vehículo y filtro de coincidencia.
 */
import assert from "node:assert/strict";

// --- lógica espejo de mostrador-inventario (sin Supabase) ---
const MARCAS = ["citroen", "chevrolet", "nissan"];
const MODELOS = ["c3", "aveo", "sentra"];
const MARCAS_RX = new RegExp(`\\b(${MARCAS.join("|")})\\b`, "i");
const MODELOS_RX = new RegExp(`\\b(${MODELOS.join("|")})\\b`, "i");

function extraerCtx(texto) {
  const pieza = texto.match(/\b(bieleta|tijera)\b/i)?.[0]?.toLowerCase();
  let marca = texto.match(MARCAS_RX)?.[0]?.toLowerCase();
  let vehiculo = texto.match(MODELOS_RX)?.[0]?.toLowerCase();
  if (!vehiculo && marca) {
    const m = texto.match(new RegExp(`\\b${marca}\\s+([a-z0-9]{1,6})\\b`, "i"));
    if (m && !MARCAS.includes(m[1].toLowerCase())) vehiculo = m[1].toLowerCase();
  }
  return { pieza, marca, vehiculo };
}

function aplica(p, ctx) {
  const blob = `${p.nombre} ${p.aplicacion} ${p.marca}`.toLowerCase();
  if (ctx.marca && !blob.includes(ctx.marca) && !p.marca.toLowerCase().includes(ctx.marca)) return false;
  if (ctx.vehiculo && !new RegExp(`\\b${ctx.vehiculo}\\b`).test(blob)) return false;
  if (ctx.pieza === "bieleta" && !/bieleta|estab|link/.test(blob)) return false;
  if (ctx.pieza === "tijera" && !/tijera/.test(blob)) return false;
  return true;
}

const ksl1013 = {
  referencia: "KSL-1013",
  nombre: "Bieleta Estab. Swift",
  aplicacion: "Swift Vitara Sentra",
  marca: "Chevrolet/Nissan",
};
const tijeraAveo = {
  referencia: "96535082",
  nombre: "TIJERA RH AVEO/SAIL",
  aplicacion: "Chevrolet Aveo",
  marca: "Chevrolet",
};
const tijeraC3 = {
  referencia: "7144133001",
  nombre: "TIJERA INFERIOR RH C/ROTULA",
  aplicacion: "CITROEN C3 2003-2012",
  marca: "Citroen",
};

const ctxBieletaC3 = extraerCtx("bieleta delantera rh citroen c3");
assert.equal(ctxBieletaC3.pieza, "bieleta");
assert.equal(ctxBieletaC3.marca, "citroen");
assert.equal(ctxBieletaC3.vehiculo, "c3");
assert.equal(aplica(ksl1013, ctxBieletaC3), false, "KSL-1013 no es para Citroen C3");
assert.equal(aplica(tijeraAveo, ctxBieletaC3), false, "Tijera Aveo no es bieleta C3");

const ctxTijeraC3 = extraerCtx("tijera citroen c3");
assert.equal(aplica(tijeraAveo, ctxTijeraC3), false, "96535082 es Aveo no Citroen");
assert.equal(aplica(tijeraC3, ctxTijeraC3), true, "7144133001 es tijera Citroen C3");

console.log("OK: filtro vehículo/pieza");
