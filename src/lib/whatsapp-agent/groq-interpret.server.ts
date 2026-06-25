import { esConsultaMultiplePiezas } from "../mostrador-inventario.server";
import { esConsultaDetalleCotizacion } from "./intents";

export type WaGroqItem = {
  pieza: string;
  marcaVehiculo?: string;
  vehiculo?: string;
  ano?: string;
  cantidad?: number;
  posicion?: "delantera" | "trasera" | "juego_completo";
  lado?: "izquierda" | "derecha";
  referencia?: string;
};

export type WaGroqIntencion = "cotizar" | "aceptar" | "cancelar" | "pregunta" | "otro";

export type WaGroqInterpretacion = {
  intencion: WaGroqIntencion;
  items: WaGroqItem[];
};

const MARCA_POR_MODELO_GROQ: Record<string, string> = {
  kwid: "renault",
  sandero: "renault",
  logan: "renault",
  duster: "renault",
  megane: "renault",
  rio: "kia",
  xcite: "kia",
  picanto: "kia",
  sportage: "kia",
  aveo: "chevrolet",
  spark: "chevrolet",
  onix: "chevrolet",
  captiva: "chevrolet",
  np300: "nissan",
  frontier: "nissan",
  march: "nissan",
};

const RESPUESTA_ACLARACION_CORTA_RX =
  /^\s*(delantero?s?|trasero?s?|izquierd[ao]?|derech[ao]?|s[ií]|si|sip|sep|dale|ok)\s*[!.?]*$/i;

function ultimoMensajeUsuario(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  const users = history.filter((m) => m.role === "user");
  return users[users.length - 1]?.content?.trim() ?? "";
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function callGroqJson(args: {
  system: string;
  user: string;
  apiKey: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
      temperature: 0.15,
      max_tokens: args.maxTokens ?? 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq error (${res.status}): ${text}`.slice(0, 300));
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq: respuesta vacía");
  return text.trim();
}

function buildSystemPrompt(): string {
  return [
    "Eres un extractor de datos para Apex Suspensión (repuestos de suspensión y dirección en Colombia).",
    "NO cotizas precios ni inventas referencias. Solo estructuras lo que el cliente pide.",
    "",
    "SALIDA JSON estricta:",
    '{ "intencion": "cotizar"|"aceptar"|"cancelar"|"pregunta"|"otro", "items": Item[] }',
    "",
    "Item: { pieza, marcaVehiculo?, vehiculo?, ano?, cantidad?, posicion?, lado?, referencia? }",
    "- pieza: amortiguador, bieleta, rotula, terminal, buje, brazo, tijera, link, guardapolvo, resorte",
    "- posicion: delantera | trasera | juego_completo (4 amortiguadores = 2 del + 2 tras)",
    "- lado: izquierda | derecha (rótulas, terminales, bieletas)",
    "- referencia: solo si el cliente escribe una ref tipo KSA-1234",
    "",
    "REGLAS:",
    "- Renault Kwid → marcaVehiculo siempre renault, vehiculo kwid (NUNCA kia kwid).",
    "- Kia Rio / XCITE → marcaVehiculo kia, vehiculo rio.",
    "- Nissan NP300 → marcaVehiculo nissan, vehiculo np300.",
    "- Si el cliente lista varios repuestos, un Item por cada línea.",
    '- "Si pero también cotiza..." / "siguientes repuestos" → intencion cotizar con todos los ítems del mensaje.',
    '- "2 y 2 delanteros traseros" / juego de 4 → cantidad 4, posicion juego_completo, pieza amortiguador.',
    "- intencion aceptar si confirma la cotización (sí me sirve) SIN pedir piezas nuevas.",
    "- intencion cancelar si dice cancelar / no quiero.",
    "- intencion pregunta si solo pregunta plazo, posición de algo ya cotizado, o detalle sin pedir nuevo ítem.",
    "- items vacío si no hay piezas concretas que cotizar.",
    "- NO inventes referencias ni precios.",
  ].join("\n");
}

function normalizarItemGroq(raw: WaGroqItem): WaGroqItem | null {
  const pieza = raw.pieza?.trim().toLowerCase().replace("rótula", "rotula");
  if (!pieza && !raw.referencia?.trim()) return null;

  const item: WaGroqItem = {
    pieza: pieza || "repuesto",
    marcaVehiculo: raw.marcaVehiculo?.trim().toLowerCase(),
    vehiculo: raw.vehiculo?.trim().toLowerCase(),
    ano: raw.ano?.trim(),
    referencia: raw.referencia?.trim().toUpperCase(),
  };

  if (raw.cantidad != null && raw.cantidad >= 1 && raw.cantidad <= 99) {
    item.cantidad = raw.cantidad;
  }
  if (raw.posicion === "delantera" || raw.posicion === "trasera" || raw.posicion === "juego_completo") {
    item.posicion = raw.posicion;
  }
  if (raw.lado === "izquierda" || raw.lado === "derecha") {
    item.lado = raw.lado;
  }

  if (item.marcaVehiculo === "chevy") item.marcaVehiculo = "chevrolet";

  const modelo = item.vehiculo?.split(/\s+/)[0];
  if (modelo && MARCA_POR_MODELO_GROQ[modelo] && !item.marcaVehiculo) {
    item.marcaVehiculo = MARCA_POR_MODELO_GROQ[modelo];
  }
  if (item.vehiculo && MARCA_POR_MODELO_GROQ[item.vehiculo]) {
    item.marcaVehiculo = MARCA_POR_MODELO_GROQ[item.vehiculo];
  }

  // Siempre al final: Kwid nunca es Kia
  if (item.vehiculo === "kwid" || /\bkwid\b/i.test(item.vehiculo ?? "")) {
    item.vehiculo = "kwid";
    item.marcaVehiculo = "renault";
  }

  return item;
}

/** Convierte ítem estructurado → texto que entiende el motor de catálogo. */
export function itemGroqASegmento(item: WaGroqItem): string {
  if (item.referencia?.trim()) return item.referencia.trim();

  const pieza = item.pieza.includes("amortiguador") ? "amortiguadores" : item.pieza;
  const qty = item.cantidad ?? (item.posicion === "juego_completo" ? 4 : 1);

  if (item.posicion === "juego_completo" || (qty >= 4 && pieza.includes("amortiguador"))) {
    const veh = [item.marcaVehiculo, item.vehiculo, item.ano].filter(Boolean).join(" ");
    return `los 4 amortiguadores${veh ? ` de un ${veh}` : ""} 2 delanteros y 2 traseros`;
  }

  const partes: string[] = [`los ${qty} ${pieza}`];
  if (item.posicion === "delantera") partes.push("delanteros");
  if (item.posicion === "trasera") partes.push("traseros");
  if (item.lado === "izquierda") partes.push("izquierdo");
  if (item.lado === "derecha") partes.push("derecho");

  const veh = [item.marcaVehiculo, item.vehiculo, item.ano].filter(Boolean).join(" ");
  if (veh) partes.push(`de un ${veh}`);

  return partes.join(" ");
}

export function groqInterpretacionHabilitada(): boolean {
  if (process.env.WHATSAPP_GROQ_INTERPRET === "0") return false;
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export async function interpretarMensajeWhatsAppConGroq(args: {
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<WaGroqInterpretacion | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey || !groqInterpretacionHabilitada()) return null;

  const ultimo = ultimoMensajeUsuario(args.history);
  if (!ultimo || ultimo.length < 8) return null;
  if (RESPUESTA_ACLARACION_CORTA_RX.test(ultimo)) return null;
  if (/^\s*confirmo\s*$/i.test(ultimo)) return null;
  if (esConsultaDetalleCotizacion(ultimo)) return null;
  if (esConsultaMultiplePiezas(ultimo)) return null;
  if (/\brenault\b.*\bkwid\b/i.test(ultimo) || /\bno\s+kia\b/i.test(ultimo)) return null;
  if (/\?\s*$/.test(ultimo) && !/\b(amortiguador|rotula|bieleta|terminal)\b/i.test(ultimo)) {
    return null;
  }

  const transcript = args.history
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Cliente" : "Haku"}: ${m.content}`)
    .join("\n");

  const userPrompt = [
    "Conversación reciente:",
    transcript,
    "",
    "Extrae intencion e items del ÚLTIMO mensaje del cliente, usando contexto previo para vehículo/pieza si hace falta.",
  ].join("\n");

  try {
    const raw = await callGroqJson({
      system: buildSystemPrompt(),
      user: userPrompt,
      apiKey,
    });
    const parsed = safeJsonParse<{ intencion?: string; items?: WaGroqItem[] }>(raw);
    if (!parsed) return null;

    const intencion = (
      ["cotizar", "aceptar", "cancelar", "pregunta", "otro"].includes(parsed.intencion ?? "")
        ? parsed.intencion
        : "otro"
    ) as WaGroqIntencion;

    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      .map((i) => normalizarItemGroq(i))
      .filter((i): i is WaGroqItem => i != null);

    return { intencion, items };
  } catch (err) {
    console.warn("WhatsApp Groq interpret:", err instanceof Error ? err.message : err);
    return null;
  }
}
