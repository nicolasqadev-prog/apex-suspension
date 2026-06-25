/**
 * QA E2E — casos reales reportados por el usuario (sin Meta).
 * Valida cotización, aclaraciones, saludo único y seguimiento conversacional.
 *
 * Uso: npm run qa:whatsapp-casos
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvLocal } from "./parse-env-local.mjs";
import { ejecutarTurnoAgenteWhatsApp } from "../src/lib/whatsapp-agent/orchestrator.server";
import { freshWaSession, type WaSession } from "../src/lib/whatsapp-agent/types";
import { lineaPresentacionAgente } from "../src/lib/whatsapp-agent/greeting";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const [k, v] of Object.entries(loadEnvLocal(join(root, ".env.local")))) {
  if (!process.env[k]) process.env[k] = v;
}
process.env.WHATSAPP_GROQ_INTERPRET = "0";

const PHONE = process.env.WA_AUDIT_PHONE?.trim() || "573171687777";
const SALUDO_RX = /hablas con\s+\*?haku\*?/i;

type Paso = { cliente: string; haku: string; fase: string };

type Aserciones = {
  nombre: string;
  incluye?: RegExp[];
  noIncluye?: RegExp[];
  saludoUnaVez?: boolean;
  minRepuestosCotizados?: number;
  minAclaraciones?: number;
  minReferencias?: number;
};

type Escenario = {
  id: string;
  titulo: string;
  mensajes: string[];
  asercionesPorPaso: Aserciones[];
};

const LISTA_CINCO =
  "Los dos amortiguadores delanteros de un Kia rio XCITE Los cuatro amortiguadores de un Renault KWID Las bieletas estabilizadoras de el kia Rio XCITE La rotula para un Chevrolet Aveo la terminal axial de una Chevrolet Captiva 3.2";

const LISTA_CINCO_TRASEROS_AVEO_TERMINAL =
  "Los dos amortiguadores traseros de un Kia rio XCITE Los cuatro amortiguadores de un Renault KWID Las bieletas estabilizadoras de el kia Rio XCITE La rotula para un Chevrolet Aveo y la terminal axial de una Chevrolet Captiva 3.2";

const MENSAJE_SI_PERO_LISTA =
  `Si pero necesito esto también que me cotices porfavor los siguientes repuestos.\n\n${LISTA_CINCO_TRASEROS_AVEO_TERMINAL}`;

const ESCENARIOS: Escenario[] = [
  {
    id: "kwid-juego-4",
    titulo: "Renault KWID — 2 delanteros + 2 traseros (no Kia Kwid)",
    mensajes: [
      "Tienes los amortiguadores de un Renault KWID?",
      "Necesito 2 y 2, osea dos delanteros dos traseros",
    ],
    asercionesPorPaso: [
      {
        nombre: "Turno 1 — aclaración o cotiza KWID",
        incluye: [/kwid|delantero|trasero/i],
        noIncluye: [/kia\s+kwid/i],
        saludoUnaVez: true,
      },
      {
        nombre: "Turno 2 — juego 4 (2 refs o aclaración), marca Renault",
        incluye: [/renault|kwid/i, /delantero|trasero|KSA-RE/i],
        noIncluye: [/kia\s+kwid/i, /Te sirve la referencia que te cotiz/i],
        minRepuestosCotizados: 2,
        saludoUnaVez: false,
      },
    ],
  },
  {
    id: "kwid-pregunta-delanteros",
    titulo: "KWID juego 4 → pregunta si son solo delanteros (no genérico)",
    mensajes: [
      "Tienes los amortiguadores de un Renault KWID?",
      "Necesito 2 y 2, osea dos delanteros dos traseros",
      "Pero esos son solo los delanteros o?",
    ],
    asercionesPorPaso: [
      {
        nombre: "Turno 1 — aclaración KWID",
        incluye: [/kwid|delantero|trasero/i],
        noIncluye: [/kia\s+kwid/i],
        saludoUnaVez: true,
      },
      {
        nombre: "Turno 2 — cotiza juego",
        incluye: [/KSA-RE|delantero|trasero/i],
        noIncluye: [/kia\s+kwid/i],
        saludoUnaVez: false,
      },
      {
        nombre: "Turno 3 — aclara posición (no ¿Te sirve?)",
        incluye: [/delantera|trasera|referencia|KSA-RE/i],
        noIncluye: [/Te sirve la referencia que te cotiz/i, /kia\s+kwid/i, /hablas con\s+\*?haku/i],
        saludoUnaVez: false,
      },
    ],
  },
  {
    id: "kwid-correccion-marca",
    titulo: "Corrección Renault KWID (no Kia Kwid)",
    mensajes: [
      "Los cuatro amortiguadores de un Renault KWID",
      "Pero te dije renault KWID, no Kia KWID",
    ],
    asercionesPorPaso: [
      {
        nombre: "Turno 1 — aclaración juego 4",
        incluye: [/kwid|delantero|trasero/i],
        noIncluye: [/kia\s+kwid/i],
        saludoUnaVez: true,
      },
      {
        nombre: "Turno 2 — mantiene Renault, no Kia",
        incluye: [/renault|kwid/i],
        noIncluye: [/kia\s+kwid/i, /No encontré.*kia\s+kwid/i],
        saludoUnaVez: false,
      },
    ],
  },
  {
    titulo: 'Megane cotizado → "Si pero necesito…" + lista de 5',
    mensajes: [
      "Hola buen dia necesito los amortiguadores de un Renault megane 2",
      "Delanteros",
      MENSAJE_SI_PERO_LISTA,
    ],
    asercionesPorPaso: [
      {
        nombre: "Turno 1 — aclaración Megane",
        incluye: [/delantero|trasero/i],
        saludoUnaVez: true,
      },
      {
        nombre: "Turno 2 — cotiza Megane",
        incluye: [/KSA-RE008|bajo pedido/i],
        saludoUnaVez: false,
      },
      {
        nombre: 'Turno 3 — "Si pero…" cotiza 5 (no pregunta si sirve)',
        incluye: [/te cotizo\s+\*5\*\s+repuestos/i],
        noIncluye: [/Te sirve la referencia que te cotiz/i, /ya está en tu cotización/i],
        minRepuestosCotizados: 5,
        saludoUnaVez: false,
      },
    ],
  },
  {
    id: "megane-luego-lista-5",
    titulo: "Megane cotizado → lista de 5 (no repetir KSA-RE008)",
    mensajes: [
      "Hola buen dia necesito los amortiguadores de un Renault megane 2",
      "Delanteros",
      LISTA_CINCO_TRASEROS_AVEO_TERMINAL,
      "Pero y los otros repuestos que te pedí que me cotizaras?",
    ],
    asercionesPorPaso: [
      {
        nombre: "Turno 1 — aclaración Megane",
        incluye: [/delantero|trasero/i],
        saludoUnaVez: true,
      },
      {
        nombre: "Turno 2 — cotiza Megane",
        incluye: [/KSA-RE008|bajo pedido/i],
        saludoUnaVez: false,
      },
      {
        nombre: "Turno 3 — cotiza 5 repuestos (no solo Megane)",
        incluye: [/te cotizo\s+\*5\*\s+repuestos/i],
        noIncluye: [/ya está en tu cotización.*KSA-RE008/i],
        minRepuestosCotizados: 5,
        saludoUnaVez: false,
      },
      {
        nombre: "Turno 4 — recupera lista del historial",
        incluye: [/te cotizo\s+\*5\*\s+repuestos|kwid|rio|aveo|captiva/i],
        noIncluye: [/Para registrarlo en sistema escribe/i],
        minRepuestosCotizados: 3,
        saludoUnaVez: false,
      },
    ],
  },
  {
    id: "megane-delanteros",
    titulo: "Megane 2 → respuesta Delanteros → cotiza bajo pedido",
    mensajes: [
      "Hola buen dia necesito los amortiguadores de un Renault megane 2",
      "Delanteros",
    ],
    asercionesPorPaso: [
      {
        nombre: "Turno 1 — pregunta posición",
        incluye: [/delantero|trasero/i],
        saludoUnaVez: true,
      },
      {
        nombre: "Turno 2 — cotiza KTC bajo pedido (no sin_match)",
        incluye: [/KSA-RE008|bajo pedido|342/i],
        noIncluye: [/no tenemos.*catálogo/i, /hablas con\s+\*?haku/i],
        saludoUnaVez: false,
      },
    ],
  },
  {
    id: "megane-2",
    titulo: "Megane 2 amortiguadores (bajo pedido KTC)",
    mensajes: [
      "Hola, tienes amortiguadores delanteros y traseros para un Renault Megane 2?",
    ],
    asercionesPorPaso: [
      {
        nombre: "Encuentra catálogo o pide aclaración (no sin_match)",
        noIncluye: [/no (?:la )?tenemos.*catálogo/i, /no tenemos esa pieza/i],
        incluye: [/delantero|trasero|megane|cotizo|aclaración|2 delanteros/i],
        saludoUnaVez: true,
      },
    ],
  },
  {
    id: "lista-5",
    titulo: "Lista de 5 repuestos en un mensaje",
    mensajes: [LISTA_CINCO],
    asercionesPorPaso: [
      {
        nombre: "Cotiza los 5 ítems (precio o aclaración)",
        incluye: [/te cotizo\s+\*5\*\s+repuestos/i],
        minRepuestosCotizados: 5,
        minAclaraciones: 2,
        noIncluye: [/te cotizo\s+\*2\*\s+repuestos/i],
        saludoUnaVez: true,
      },
    ],
  },
  {
    id: "seguimiento-rio-kwid",
    titulo: "Seguimiento: Rio XCITE y Kwid juntos",
    mensajes: [
      "Y los amortiguadores del Kia rio XCITE y los del KWID si los tienes o?",
    ],
    asercionesPorPaso: [
      {
        nombre: "Responde por Rio y Kwid (no ignora Kwid)",
        incluye: [/rio|xcite/i, /kwid/i],
        noIncluye: [
          /no tenemos esa pieza para\s+kia rio/i,
          /no (?:la )?tenemos.*catálogo.*(?!.*kwid)/i,
        ],
        minRepuestosCotizados: 2,
        saludoUnaVez: true,
      },
    ],
  },
  {
    id: "conversacion-completa",
    titulo: "Conversación multi-turno (saludo + lista + seguimiento)",
    mensajes: [
      "Hola, tienes amortiguadores delanteros y traseros para un Renault Megane 2?",
      LISTA_CINCO,
      "Y los amortiguadores del Kia rio XCITE y los del KWID si los tienes o?",
    ],
    asercionesPorPaso: [
      {
        nombre: "Turno 1 — Megane",
        noIncluye: [/no tenemos esa pieza/i],
        saludoUnaVez: true,
      },
      {
        nombre: "Turno 2 — 5 repuestos, sin repetir saludo",
        incluye: [/te cotizo\s+\*5\*\s+repuestos/i],
        saludoUnaVez: false,
        minRepuestosCotizados: 5,
      },
      {
        nombre: "Turno 3 — seguimiento Rio + Kwid, sin saludo",
        incluye: [/kwid/i, /rio|xcite/i],
        saludoUnaVez: false,
        minRepuestosCotizados: 2,
      },
    ],
  },
  {
    id: "kwid-aclaracion",
    titulo: "4 amortiguadores Kwid — pregunta delanteros/traseros",
    mensajes: ["Los cuatro amortiguadores de un Renault KWID"],
    asercionesPorPaso: [
      {
        nombre: "Pregunta juego o posición (hay stock bodega)",
        incluye: [/delantero|trasero|2 delanteros/i],
        noIncluye: [/no (?:la )?tenemos.*catálogo/i],
        saludoUnaVez: true,
      },
    ],
  },
  {
    id: "megane-rio-total",
    titulo: "Megane + Rio — total, megane en carrito y objeción logística",
    mensajes: [
      "Hola buen dia necesito los amortiguadores de un Renault megane 2",
      "Delanteros",
      "Okay también necesito los amortiguadores traseros de un Kia rio XCITE los tienes?",
      "Si me sirven ambas, cuánto sería todo?",
      "Y más el amortiguador del megane?",
      "Osea si te pido uno que tienes en stock y otro que es bajo pedido me podrías vender el que tienes ya y agendarte el que es bajo pedido?",
    ],
    asercionesPorPaso: [
      {
        nombre: "Turno 1 — saludo + aclaración Megane",
        incluye: [/delantero|trasero/i],
        saludoUnaVez: true,
      },
      {
        nombre: "Turno 2 — cotiza Megane bajo pedido",
        incluye: [/KSA-RE008|bajo pedido/i],
        saludoUnaVez: false,
      },
      {
        nombre: "Turno 3 — cotiza Rio en bodega",
        incluye: [/KSA-HY016|bodega/i],
        saludoUnaVez: false,
      },
      {
        nombre: "Turno 4 — total de ambas referencias",
        incluye: [/KSA-RE008/i, /KSA-HY016/i, /total general/i, /504|505|342.*162/i],
        noIncluye: [/cantidad:\s*1\s*·\s*total:\s*\*\$\s*162/i],
        saludoUnaVez: false,
      },
      {
        nombre: "Turno 5 — Megane ya en carrito (no repite aclaración)",
        incluye: [/KSA-RE008/i, /ya está en tu cotización|resumen/i],
        noIncluye: [/¿cuáles necesitas/i],
        saludoUnaVez: false,
      },
      {
        nombre: "Turno 6 — responde objeción logística mixta",
        incluye: [/bodega/i, /bajo pedido/i, /despach/i],
        noIncluye: [/¿cuáles necesitas/i],
        saludoUnaVez: false,
      },
    ],
  },
  {
    id: "rio-aclaracion",
    titulo: "2 amortiguadores Rio XCITE — pregunta delanteros o traseros",
    mensajes: ["Los dos amortiguadores de un Kia rio XCITE"],
    asercionesPorPaso: [
      {
        nombre: "Pregunta delanteros vs traseros",
        incluye: [/delantero|trasero/i],
        noIncluye: [/no (?:la )?tenemos.*catálogo/i],
        saludoUnaVez: true,
      },
    ],
  },
];

let fallos = 0;
let pasados = 0;

function fail(escenarioId: string, paso: number, msg: string): void {
  fallos++;
  console.error(`  ❌ [${escenarioId} paso ${paso}] ${msg}`);
}

function pass(msg: string): void {
  pasados++;
  console.log(`  ✓ ${msg}`);
}

function cuentaRepuestosEnRespuesta(texto: string): number {
  const m = texto.match(/te cotizo\s+\*(\d+)\*\s+repuestos/i);
  if (m) return Number(m[1]);
  const refs = texto.match(/\*[A-Z]{2,5}[- ]?\d{3,6}[A-Z0-9]*\*/g);
  if (refs?.length) return refs.length;
  return texto.includes("manejamos esta referencia") ? 1 : 0;
}

function cuentaAclaraciones(texto: string): number {
  return (texto.match(/delantero|trasero|izquierd|derech|2 delanteros/gi) ?? []).length;
}

function tieneSaludo(texto: string): boolean {
  return SALUDO_RX.test(texto) || texto.includes(lineaPresentacionAgente().slice(0, 20));
}

async function turno(session: WaSession, msg: string): Promise<Paso> {
  session.history.push({ role: "user", content: msg });
  const res = await ejecutarTurnoAgenteWhatsApp({
    session,
    mensajeUsuario: msg,
    phone: PHONE,
    contactName: "QA Casos Usuario",
  });
  session.history.push({ role: "assistant", content: res.texto });
  return { cliente: msg, haku: res.texto, fase: res.session.agent.phase };
}

function validarAserciones(
  escenarioId: string,
  pasoIdx: number,
  texto: string,
  a: Aserciones,
  esPrimerTurnoGlobal: boolean,
): void {
  const n = pasoIdx + 1;

  if (a.saludoUnaVez === true && !tieneSaludo(texto)) {
    fail(escenarioId, n, `${a.nombre}: se esperaba saludo en el primer mensaje`);
  } else if (a.saludoUnaVez === false && tieneSaludo(texto)) {
    fail(escenarioId, n, `${a.nombre}: NO debe repetir saludo Haku`);
  } else if (a.saludoUnaVez !== undefined) {
    pass(`${a.nombre}: saludo ${a.saludoUnaVez ? "presente" : "omitido"} OK`);
  }

  for (const rx of a.incluye ?? []) {
    if (!rx.test(texto)) {
      fail(escenarioId, n, `${a.nombre}: falta patrón ${rx}`);
    } else {
      pass(`${a.nombre}: coincide ${rx}`);
    }
  }

  for (const rx of a.noIncluye ?? []) {
    if (rx.test(texto)) {
      fail(escenarioId, n, `${a.nombre}: no debería coincidir ${rx}`);
    } else {
      pass(`${a.nombre}: ausente ${rx} OK`);
    }
  }

  if (a.minRepuestosCotizados != null) {
    const c = cuentaRepuestosEnRespuesta(texto);
    if (c < a.minRepuestosCotizados) {
      fail(
        escenarioId,
        n,
        `${a.nombre}: se cotizaron ${c} ítems, mínimo ${a.minRepuestosCotizados}`,
      );
    } else {
      pass(`${a.nombre}: ${c} ítem(s) en respuesta`);
    }
  }

  if (a.minAclaraciones != null) {
    const c = cuentaAclaraciones(texto);
    if (c < a.minAclaraciones) {
      fail(escenarioId, n, `${a.nombre}: ${c} menciones de aclaración, mínimo ${a.minAclaraciones}`);
    } else {
      pass(`${a.nombre}: ${c} aclaración(es) detectadas`);
    }
  }
}

async function correrEscenario(esc: Escenario): Promise<void> {
  console.log(`\n━━ ${esc.titulo} [${esc.id}] ━━`);
  const session = freshWaSession();

  for (let i = 0; i < esc.mensajes.length; i++) {
    const msg = esc.mensajes[i]!;
    const paso = await turno(session, msg);
    const a = esc.asercionesPorPaso[i];
    console.log(`\n  CLIENTE: ${msg.slice(0, 90)}${msg.length > 90 ? "…" : ""}`);
    console.log(`  HAKU (${paso.fase}):\n${paso.haku.slice(0, 600)}${paso.haku.length > 600 ? "…" : ""}`);
    if (a) validarAserciones(esc.id, i, paso.haku, a, i === 0);
  }
}

async function main() {
  console.log("=== QA WhatsApp — casos usuario (E2E orquestador) ===");
  console.log("Teléfono simulado:", PHONE);

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }

  for (const esc of ESCENARIOS) {
    await correrEscenario(esc);
  }

  console.log("\n══════════════════════════════════════");
  console.log(`Resultado: ${pasados} checks OK, ${fallos} fallos`);
  if (fallos > 0) {
    console.error("\n❌ QA FALLIDA — corregir antes de deploy");
    process.exit(1);
  }
  console.log("\n✅ QA EXITOSA — listo para deploy");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
