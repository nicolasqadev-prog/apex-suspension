import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .max(12),
  context: z
    .object({
      whatsapp: z.string().optional(),
      carro: z.string().optional(),
      ano: z.string().optional(),
      version: z.string().optional(),
      municipio: z.string().optional(),
      tallerTipo: z.enum(["particular", "taller_validado"]).optional(),
      contraEntregaHabilitada: z.boolean().optional(),
      inventarioSnippet: z.string().max(8000).optional(),
    })
    .optional(),
});

type MostradorResponse = {
  ok: true;
  reply: string;
  questions: string[];
  action: "ask_more" | "handoff_whatsapp";
  handoffTag?: "normal" | "bajo_encargo";
  /** Una pieza concreta para priorizar la cotización (orientación, no diagnóstico). */
  primarySuggestion?: string;
  internalSummary: string[];
};

function buildSystemPrompt() {
  return [
    "Eres el agente 'Mostrador Apex' (Colombia) para Apex Suspensión.",
    "Orientas para cotizar repuestos de suspensión y dirección, pero NO diagnosticas.",
    "Apex se especializa en suspensión/dirección, pero si el cliente pide algo fuera de esa especialidad, ofreces 'bajo encargo' como Plan B (sin prometer disponibilidad): lo revisamos con proveedor y cotizamos.",
    "",
    "REGLAS DURAS:",
    "- Nunca afirmes 'eso es X'. Usa 'podría ser', 'suele asociarse', 'para cotizar lo correcto necesitamos...'.",
    "- Incluye siempre: 'Confirma el diagnóstico con tu mecánico de confianza.'",
    "- Da 1–3 hipótesis útiles (posibles piezas/zonas) en tono de 'podría ser' para que el cliente sepa qué confirmar con su mecánico.",
    "- En la respuesta SIEMPRE incluye una línea explícita: 'Posibles piezas a revisar: ...' con 2–4 ítems (sin afirmar diagnóstico).",
    "- Incluye SIEMPRE al final una línea: 'Para cotizar primero (orientación, no diagnóstico): ...' con UNA pieza concreta (la más probable para pedir referencia).",
    "- Devuelve también JSON.primarySuggestion con esa misma pieza (texto corto, 6–18 palabras).",
    "- Debes usar el mensaje del cliente: evita respuestas genéricas repetidas. Cada respuesta debe referirse al síntoma/pieza mencionada.",
    "- Si el cliente menciona frenos (frena, freno, pastillas, discos, caliper), responde con hipótesis de frenos y marca handoffTag = 'bajo_encargo'.",
    "- No inventes stock, precios o tiempos. Si no hay datos, pide evidencia y deriva a WhatsApp humano.",
    "- Máximo 3 preguntas por turno.",
    "- Objetivo: 1–2 turnos y cerrar con resumen + WhatsApp humano.",
    "",
    "SALIDA (JSON estricto):",
    "{",
    '  "reply": string,',
    '  "questions": string[],',
    '  "action": "ask_more" | "handoff_whatsapp",',
    '  "handoffTag"?: "normal" | "bajo_encargo",',
    '  "primarySuggestion"?: string,',
    '  "internalSummary": string[]',
    "}",
    "",
    "EJEMPLO DE SALIDA (solo como referencia de formato, no lo copies literal):",
    '{ "reply": "Podría estar relacionado con pastillas/discos o un caliper agarrado. Confirma el diagnóstico con tu mecánico de confianza.", "questions": ["¿El ruido es al frenar o también rodando?", "¿Delantera o trasera?", "¿Tienes marca de pastillas o discos actuales?"], "action": "handoff_whatsapp", "handoffTag": "bajo_encargo", "internalSummary": ["Tema: frenos", "Ofrecer bajo encargo"] }',
  ].join("\n");
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function callAnthropic(args: {
  system: string;
  user: string;
  apiKey: string;
}): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant",
      temperature: 0.3,
      max_tokens: 450,
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

export const responderMostrador = createServerFn({ method: "POST" })
  .inputValidator(InputSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY?.trim();

    const contextLines = [
      data.context?.tallerTipo
        ? `Tipo de cliente: ${data.context.tallerTipo}${
            data.context.tallerTipo === "taller_validado" ? " (no mencionar descuentos)" : ""
          }`
        : null,
      data.context?.contraEntregaHabilitada === true ? "Contra entrega habilitada: sí" : null,
      data.context?.whatsapp ? `WhatsApp: ${data.context.whatsapp}` : null,
      data.context?.carro ? `Carro: ${data.context.carro}` : null,
      data.context?.ano ? `Año: ${data.context.ano}` : null,
      data.context?.version ? `Versión: ${data.context.version}` : null,
      data.context?.municipio ? `Municipio: ${data.context.municipio}` : null,
      data.context?.inventarioSnippet ? `Inventario (snippet):\n${data.context.inventarioSnippet}` : null,
    ].filter(Boolean);

    const transcript = data.history
      .map((m) => `${m.role === "user" ? "Cliente" : "Mostrador"}: ${m.content}`)
      .join("\n");

    const userPrompt = [
      contextLines.length ? `CONTEXTO\n${contextLines.join("\n")}\n` : null,
      "CONVERSACIÓN",
      transcript,
      "",
      "Instrucción: responde SOLO con el JSON estricto de SALIDA.",
    ]
      .filter(Boolean)
      .join("\n");

    if (!apiKey) {
      const fallback: MostradorResponse = {
        ok: true,
        reply:
          "Te puedo orientar para cotizar, pero ahora mismo no tengo el asistente automático activo. Confirma el diagnóstico con tu mecánico de confianza y escríbenos por WhatsApp para confirmar la referencia.",
        questions: ["¿Qué carro es (marca/línea) y de qué año?", "¿Qué síntoma presenta o qué pieza necesitas?"],
        action: "handoff_whatsapp",
        handoffTag: "normal",
        internalSummary: ["Sin GROQ_API_KEY en servidor; usar WhatsApp humano."],
      };
      return fallback;
    }

    const raw = await callAnthropic({ system: buildSystemPrompt(), user: userPrompt, apiKey });
    const parsed = safeJsonParse<Omit<MostradorResponse, "ok">>(raw);

    if (!parsed || typeof parsed.reply !== "string" || !Array.isArray(parsed.questions)) {
      return {
        ok: true,
        reply:
          "Listo, te oriento para cotizar. No hago diagnóstico: confirma con tu mecánico de confianza. Para avanzar rápido: ¿qué carro es (marca/línea), año y qué síntoma presenta? Si puedes, envía foto o video por WhatsApp.",
        questions: ["¿Qué carro es (marca/línea) y de qué año?", "¿Qué síntoma presenta o qué pieza necesitas?"],
        action: "handoff_whatsapp",
        handoffTag: "normal",
        internalSummary: ["Respuesta IA no parseable; usando fallback seguro."],
      } satisfies MostradorResponse;
    }

    const primarySuggestion =
      typeof parsed.primarySuggestion === "string"
        ? parsed.primarySuggestion.slice(0, 180).trim()
        : "";

    const safe: MostradorResponse = {
      ok: true,
      reply: parsed.reply.slice(0, 700),
      questions: parsed.questions.map((q) => String(q).slice(0, 140)).slice(0, 3),
      action: parsed.action === "ask_more" ? "ask_more" : "handoff_whatsapp",
      handoffTag: parsed.handoffTag === "bajo_encargo" ? "bajo_encargo" : "normal",
      primarySuggestion: primarySuggestion || undefined,
      internalSummary: (parsed.internalSummary ?? []).map((s) => String(s).slice(0, 180)).slice(0, 6),
    };
    return safe;
  });

