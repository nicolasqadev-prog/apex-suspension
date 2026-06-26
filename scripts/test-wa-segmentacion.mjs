import {
  segmentarConsultasPieza,
  esConsultaMultiplePiezas,
  extraerContextoCotizacion,
} from "../src/lib/mostrador-inventario.server.ts";

const t5 =
  "Los dos amortiguadores delanteros de un Kia rio XCITE Los cuatro amortiguadores de un Renault KWID Las bieletas estabilizadoras de el kia Rio XCITE La rotula para un Chevrolet Aveo la terminal axial de una Chevrolet Captiva 3.2";

const t5n = t5.trim().replace(/\d+[\.\)]\s*/g, " ");
console.log("y-los match:", /\s+y\s+(?:los|las)\s+/i.test(t5n));
const raw = t5n.split(
  /\s+(?=(?:(?:los|las)\s+(?:dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|un|una|\d{1,2}\b|amortiguador|bieleta|rotula|r[oó]tula|terminal|tijera|buje|brazo|link|barra))|(?:(?<!\bde\s)(?:la|el)\s+(?:dos|tres|cuatro|cinco|seis|un|una|\d{1,2}\b|amortiguador|bieleta|rotula|r[oó]tula|terminal|tijera|buje|brazo|link|barra)))/i,
);
console.log("raw parts:", raw.length);
raw.forEach((s, i) => console.log(" raw", i + 1, s));

console.log("=== 5 items ===");
console.log("multi:", esConsultaMultiplePiezas(t5));
segmentarConsultasPieza(t5).forEach((s, i) => console.log(i + 1, s));

const follow = "Y los amortiguadores del Kia rio XCITE y los del KWID si los tienes o?";
console.log("\n=== follow-up ===");
console.log("multi:", esConsultaMultiplePiezas(follow));
segmentarConsultasPieza(follow).forEach((s, i) => console.log(i + 1, s));

console.log("\n=== megane ===");
console.log(extraerContextoCotizacion("amortiguadores delanteros y traseros renault megane 2"));
