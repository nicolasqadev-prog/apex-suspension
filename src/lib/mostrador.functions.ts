import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { aplicarDescuento } from "./pricing";
import {
  detectarAlcanceMensaje,
  extraerMarcasMencionadas,
  formatoInventarioParaPrompt,
  marcasQueVendemosTexto,
  resolverBusquedaMostrador,
  vendemosMarca,
  type ProductoMostrador,
} from "./mostrador-inventario.server";
import type { MostradorCotizacionLinea } from "./mostrador";
import { notificarApexNuevoPedido } from "./pedidos-alerta.server";
import { createPedido } from "./pedidos.server";
import { getTallerFidelizadoByWhatsapp, normalizeWhatsapp } from "./talleres.server";

const InputSchema = z.object({
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .max(20),
  context: z
    .object({
      whatsapp: z.string().optional(),
      carro: z.string().optional(),
      ano: z.string().optional(),
      version: z.string().optional(),
      municipio: z.string().optional(),
      piezaPrioritaria: z.string().optional(),
    })
    .optional(),
});

const ConfirmarPedidoSchema = z.object({
  whatsapp: z.string().min(7).max(20),
  nombreCliente: z.string().max(80).optional(),
  municipio: z.string().max(80).optional(),
  direccion: z.string().max(200).optional(),
  notas: z.string().max(500).optional(),
  lineas: z
    .array(
      z.object({
        slug: z.string().min(1).max(120),
        cantidad: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(20),
});

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX_MOSTRADOR_CALLS = 40;
const RATE_MAX_PEDIDOS = 10;
const mostradorCallsByIp = new Map<string, { count: number; firstAt: number }>();
const pedidoCallsByIp = new Map<string, { count: number; firstAt: number }>();

function getIpFromHeaders(headers: Headers): string {
  const cf = headers.get("CF-Connecting-IP");
  if (cf) return cf.trim();
  const xff = headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

function checkRateLimit(
  ip: string,
  store: Map<string, { count: number; firstAt: number }>,
  max: number,
): boolean {
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now - entry.firstAt > RATE_WINDOW_MS) {
    store.set(ip, { count: 1, firstAt: now });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

type TallerCuenta = {
  validado: boolean;
  nombreTaller?: string;
  descuentoPorcentaje?: number;
  contraEntregaHabilitada?: boolean;
  municipio?: string;
  direccionEntrega?: string;
};

async function tallerCuentaFromWhatsapp(raw?: string): Promise<TallerCuenta> {
  const w = raw?.trim();
  if (!w) return { validado: false };
  const taller = await getTallerFidelizadoByWhatsapp(w);
  if (!taller) return { validado: false };
  return {
    validado: true,
    nombreTaller: taller.nombreTaller,
    descuentoPorcentaje: taller.descuentoPorcentaje,
    contraEntregaHabilitada: taller.contraEntregaHabilitada,
    municipio: taller.municipio,
    direccionEntrega: taller.direccionEntrega,
  };
}

function precioParaCliente(p: ProductoMostrador, taller: TallerCuenta): number {
  if (taller.validado && taller.descuentoPorcentaje != null) {
    return aplicarDescuento(p.precioPublico, taller.descuentoPorcentaje);
  }
  return p.precioPublico;
}

function mapCotizacion(
  productos: ProductoMostrador[],
  taller: TallerCuenta,
): MostradorCotizacionLinea[] {
  return productos.map((p) => ({
    slug: p.slug,
    referencia: p.referencia,
    nombre: p.nombre,
    marcaProducto: p.marcaProducto,
    precioUnitarioCop: precioParaCliente(p, taller),
    precioPublicoCop: p.precioPublico,
    stock: p.stock,
    disponibilidad: p.disponibilidad,
    cantidadSugerida: 1,
  }));
}

export type MostradorResponsePublic = {
  ok: true;
  reply: string;
  questions: string[];
  action: "ask_more" | "quote" | "out_of_scope" | "handoff_whatsapp";
  handoffTag?: "normal" | "bajo_encargo";
  cotizacion?: MostradorCotizacionLinea[];
  tallerCuenta?: TallerCuenta;
  alcance?: "en_alcance" | "bajo_encargo" | "fuera_alcance";
};

type MostradorGroqPayload = {
  reply?: unknown;
  questions?: unknown;
  action?: unknown;
  handoffTag?: unknown;
  objecionAtendida?: unknown;
};

function buildSystemPrompt(inventarioJson: string, marcas: string) {
  return [
    "Eres el agente comercial 'Mostrador Apex' de Apex Suspensión (Colombia).",
    "Vendes repuestos de suspensión y dirección. Hablas natural, como un asesor humano del mostrador — nunca como robot.",
    "",
    "MARCAS QUE COMERCIALIZAMOS:",
    marcas,
    "",
    "INVENTARIO REAL (única fuente de precios y stock — NO inventes nada fuera de esto):",
    inventarioJson,
    "",
    "REGLAS DURAS:",
    "- Los precios y stock SOLO vienen del inventario inyectado. Repítelos tal cual en COP.",
    "- stock > 0 = 'en bodega, despacho inmediato'. stock = 0 = 'bajo pedido' (lo traemos, se confirma por WhatsApp).",
    "- NO diagnosticas. Usa 'podría ser', 'para cotizar necesitamos confirmar'. Incluye: confirma con tu mecánico de confianza.",
    "- Si el cliente pide marca que NO vendemos (MOOG, Corven, Nakata, etc.) y no está en inventario: dilo con respeto y ofrece alternativa del catálogo si hay.",
    "- Si el tema es frenos/embrague y no hay match en inventario: ofrece bajo encargo (revisamos con proveedor).",
    "- Si es motor, transmisión, llantas, radio, A/C: fuera de nuestro alcance — declina con cortesía.",
    "",
    "MANEJO DE OBJECIONES (integra en la respuesta, sin sonar a script):",
    "- 'Está caro': explica relación calidad/marca, ofrece alternativa más económica del inventario si existe.",
    "- 'No tengo la referencia': pide foto de la pieza vieja, vehículo, año, lado izq/der.",
    "- 'Lo consigo más barato': no regatees; destaca stock inmediato o garantía Apex.",
    "- '¿Cuándo llega?': bodega = mismo día en Sabana si hay cupo; bajo pedido = confirmamos plazo por WhatsApp.",
    "",
    "Taller validado: cotiza precio del inventario (ya viene con descuento aplicado si aplica). No menciones % de descuento.",
    "",
    "SALIDA JSON estricta:",
    '{ "reply": string, "questions": string[], "action": "ask_more"|"quote"|"out_of_scope"|"handoff_whatsapp", "handoffTag"?: "normal"|"bajo_encargo", "objecionAtendida"?: string }',
    "",
    "action=quote cuando presentas precios del inventario.",
    "action=out_of_scope cuando no vendemos esa línea.",
    "action=handoff_whatsapp cuando el cliente quiere cerrar o necesita humano.",
    "Máximo 3 preguntas. Mensaje reply: 2-6 oraciones, conversacional.",
  ].join("\n");
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function callGroq(args: { system: string; user: string; apiKey: string }): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile",
      temperature: 0.45,
      max_tokens: 650,
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

function respuestaFueraAlcance(): MostradorResponsePublic {
  return {
    ok: true,
    reply:
      "Esa línea (motor, transmisión, llantas, radio o aire acondicionado) no la manejamos en Apex — nos enfocamos en suspensión y dirección. Si necesitas rótulas, terminales, amortiguadores o bieletas, con gusto te cotizo en segundos.",
    questions: ["¿Buscas algo de suspensión o dirección para tu vehículo?"],
    action: "out_of_scope",
    handoffTag: "normal",
    alcance: "fuera_alcance",
  };
}

function respuestaMarcaNoVendida(marca: string, cotizacion: MostradorCotizacionLinea[]): MostradorResponsePublic {
  const alt =
    cotizacion.length > 0
      ? ` En catálogo tengo alternativas como ${cotizacion[0].referencia} (${cotizacion[0].marcaProducto}).`
      : "";
  return {
    ok: true,
    reply: `No manejamos la marca ${marca} de forma habitual.${alt} Si me das referencia, vehículo y año, busco el equivalente en las marcas que sí comercializamos.`,
    questions: ["¿Tienes foto de la pieza o la referencia del repuesto?"],
    action: cotizacion.length > 0 ? "quote" : "ask_more",
    handoffTag: "normal",
    cotizacion: cotizacion.length > 0 ? cotizacion : undefined,
    alcance: "en_alcance",
  };
}

function respuestaCotizacionDeterministica(
  cotizacion: MostradorCotizacionLinea[],
  taller: TallerCuenta,
  alcance: "en_alcance" | "bajo_encargo",
): string {
  const lineas = cotizacion
    .slice(0, 3)
    .map((l) => {
      const precio = new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(l.precioUnitarioCop);
      const disp =
        l.disponibilidad === "bodega"
          ? `${l.stock} en bodega — despacho inmediato`
          : "bajo pedido — confirmamos llegada por WhatsApp";
      return `${l.referencia} (${l.marcaProducto}): ${l.nombre} — ${precio} c/u. ${disp}.`;
    })
    .join("\n");

  const intro =
    alcance === "bajo_encargo"
      ? "Revisé el catálogo. Para frenos/embrague a veces lo gestionamos bajo encargo; esto es lo más cercano que tengo:"
      : "Te cotizo con datos del sistema:";

  const pago =
    taller.validado && taller.contraEntregaHabilitada
      ? " En tu cuenta de taller aplica contra entrega (confirmamos al cerrar)."
      : "";

  return `${intro}\n\n${lineas}\n\nConfirma el diagnóstico con tu mecánico de confianza.${pago} ¿Cuántas unidades necesitas?`;
}

export type MostradorTurnoInput = z.infer<typeof InputSchema>;

/** Lógica compartida: web PWA y webhook WhatsApp. */
export async function procesarTurnoMostrador(
  data: MostradorTurnoInput,
): Promise<MostradorResponsePublic> {
    const tallerCuenta = await tallerCuentaFromWhatsapp(data.context?.whatsapp);

    const ultimoUsuario = [...data.history].reverse().find((m) => m.role === "user")?.content ?? "";
    const alcance = detectarAlcanceMensaje(ultimoUsuario);

    if (alcance === "fuera_alcance") {
      const productos = await resolverBusquedaMostrador(ultimoUsuario, data.context?.piezaPrioritaria);
      if (productos.length === 0) {
        return { ...respuestaFueraAlcance(), tallerCuenta };
      }
    }

    const marcasMencionadas = extraerMarcasMencionadas(ultimoUsuario);
    const marcaNoVendida = marcasMencionadas.find((m) => !vendemosMarca(m));

    const productos = await resolverBusquedaMostrador(ultimoUsuario, data.context?.piezaPrioritaria);
    const cotizacion = mapCotizacion(productos, tallerCuenta);

    if (marcaNoVendida && cotizacion.every((c) => c.marcaProducto.toUpperCase() !== marcaNoVendida)) {
      return { ...respuestaMarcaNoVendida(marcaNoVendida, cotizacion), tallerCuenta };
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      if (cotizacion.length > 0) {
        return {
          ok: true,
          reply: respuestaCotizacionDeterministica(cotizacion, tallerCuenta, alcance),
          questions: ["¿Cuántas unidades necesitas?", "¿Delantera o trasera, izquierda o derecha?"],
          action: "quote",
          handoffTag: alcance === "bajo_encargo" ? "bajo_encargo" : "normal",
          cotizacion,
          tallerCuenta,
          alcance,
        };
      }
      return {
        ok: true,
        reply:
          "Te ayudo a cotizar. Cuéntame la pieza o referencia, el vehículo y el año. Confirma el diagnóstico con tu mecánico de confianza.",
        questions: ["¿Qué pieza buscas o qué síntoma presenta el carro?"],
        action: "ask_more",
        handoffTag: "normal",
        tallerCuenta,
        alcance,
      };
    }

    const inventarioJson = formatoInventarioParaPrompt(productos);
    const contextLines = [
      tallerCuenta.validado
        ? `Cliente: taller validado (${tallerCuenta.nombreTaller ?? "registrado"}).`
        : "Cliente: público general.",
      data.context?.whatsapp ? `WhatsApp: ${data.context.whatsapp}` : null,
      data.context?.carro ? `Vehículo: ${data.context.carro}` : null,
      data.context?.ano ? `Año: ${data.context.ano}` : null,
      data.context?.version ? `Versión: ${data.context.version}` : null,
      data.context?.municipio ? `Municipio: ${data.context.municipio}` : null,
      `Alcance detectado: ${alcance}`,
      productos.length === 0 ? "Sin coincidencias en catálogo para este mensaje." : null,
    ].filter(Boolean);

    const transcript = data.history
      .map((m) => `${m.role === "user" ? "Cliente" : "Mostrador"}: ${m.content}`)
      .join("\n");

    const userPrompt = [
      `CONTEXTO\n${contextLines.join("\n")}`,
      "",
      "CONVERSACIÓN",
      transcript,
      "",
      "Responde SOLO con el JSON de SALIDA. Si hay inventario, cotiza con esos datos.",
    ].join("\n");

    try {
      const raw = await callGroq({
        system: buildSystemPrompt(inventarioJson, marcasQueVendemosTexto()),
        user: userPrompt,
        apiKey,
      });
      const parsed = safeJsonParse<MostradorGroqPayload>(raw);

      if (!parsed || typeof parsed.reply !== "string") {
        throw new Error("JSON inválido");
      }

      const actionRaw = parsed.action;
      let action: MostradorResponsePublic["action"] = "ask_more";
      if (actionRaw === "quote" || (cotizacion.length > 0 && actionRaw !== "out_of_scope")) {
        action = "quote";
      } else if (actionRaw === "out_of_scope") {
        action = "out_of_scope";
      } else if (actionRaw === "handoff_whatsapp") {
        action = "handoff_whatsapp";
      }

      return {
        ok: true,
        reply: parsed.reply.slice(0, 900),
        questions: Array.isArray(parsed.questions)
          ? parsed.questions.map((q) => String(q).slice(0, 140)).slice(0, 3)
          : [],
        action,
        handoffTag: parsed.handoffTag === "bajo_encargo" ? "bajo_encargo" : "normal",
        cotizacion: cotizacion.length > 0 ? cotizacion : undefined,
        tallerCuenta,
        alcance,
      };
    } catch {
      if (cotizacion.length > 0) {
        return {
          ok: true,
          reply: respuestaCotizacionDeterministica(cotizacion, tallerCuenta, alcance),
          questions: ["¿Cuántas unidades necesitas?"],
          action: "quote",
          handoffTag: alcance === "bajo_encargo" ? "bajo_encargo" : "normal",
          cotizacion,
          tallerCuenta,
          alcance,
        };
      }
      return {
        ok: true,
        reply:
          "Dame un momento — para cotizarte bien necesito la referencia o una descripción de la pieza, más el vehículo y año. Confirma el diagnóstico con tu mecánico.",
        questions: ["¿Qué pieza buscas?", "¿Marca, modelo y año del vehículo?"],
        action: "ask_more",
        handoffTag: "normal",
        tallerCuenta,
        alcance,
      };
    }
}

export const responderMostrador = createServerFn({ method: "POST" })
  .inputValidator(InputSchema)
  .handler(async (ctx) => {
    const data = (ctx as { data: z.infer<typeof InputSchema> }).data;
    const request = (ctx as { request?: Request }).request;
    const ip = request ? getIpFromHeaders(request.headers) : "unknown";

    if (!checkRateLimit(ip, mostradorCallsByIp, RATE_MAX_MOSTRADOR_CALLS)) {
      const tallerCuenta = await tallerCuentaFromWhatsapp(data.context?.whatsapp);
      return {
        ok: true,
        reply:
          "Ahora mismo el asistente está saturado. Escríbenos por WhatsApp y te cotizamos al toque.",
        questions: [],
        action: "handoff_whatsapp",
        handoffTag: "normal",
        tallerCuenta,
      } satisfies MostradorResponsePublic;
    }

    return procesarTurnoMostrador(data);
  });

export const confirmarPedidoMostrador = createServerFn({ method: "POST" })
  .inputValidator(ConfirmarPedidoSchema)
  .handler(async (ctx) => {
    const data = (ctx as { data: z.infer<typeof ConfirmarPedidoSchema> }).data;
    const request = (ctx as { request?: Request }).request;
    const ip = request ? getIpFromHeaders(request.headers) : "unknown";

    if (!checkRateLimit(ip, pedidoCallsByIp, RATE_MAX_PEDIDOS)) {
      return { ok: false as const, reason: "rate_limit" as const };
    }

    const whatsapp = normalizeWhatsapp(data.whatsapp);
    const taller = await getTallerFidelizadoByWhatsapp(whatsapp);
    const { loadPiezaBySlug } = await import("./inventario.server");
    const lineasValidadas: {
      slug: string;
      referencia: string;
      nombre: string;
      cantidad: number;
      precioUnitario: number;
      disponibilidad: string;
    }[] = [];
    let total = 0;

    for (const l of data.lineas) {
      const piezaData = await loadPiezaBySlug(l.slug);
      if (!piezaData.pieza) {
        return { ok: false as const, reason: "linea_invalida" as const };
      }
      const p = piezaData.pieza;
      let qty = l.cantidad;
      if (p.stock > 0 && qty > p.stock) qty = p.stock;

      const precioUnitario =
        taller != null
          ? p.precioTallerRef != null && p.precioTallerRef > 0
            ? Math.round(p.precioTallerRef)
            : aplicarDescuento(p.precioLista, taller.descuentoPorcentaje)
          : p.precioLista;

      lineasValidadas.push({
        slug: p.slug,
        referencia: p.referencia,
        nombre: p.nombre,
        cantidad: qty,
        precioUnitario,
        disponibilidad: p.stock > 0 ? "bodega" : "bajo_pedido",
      });
      total += precioUnitario * qty;
    }

    const formatoCop = (n: number) =>
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(n);

    const resumenLineas = lineasValidadas
      .map(
        (l) =>
          `· ${l.referencia} ×${l.cantidad} — ${formatoCop(l.precioUnitario)} c/u` +
          (l.disponibilidad === "bajo_pedido" ? " (bajo pedido)" : ""),
      )
      .join("\n");

    const nombre =
      taller?.nombreTaller?.trim() ||
      data.nombreCliente?.trim() ||
      "Cliente mostrador IA";
    const municipio =
      taller?.municipio?.trim() || data.municipio?.trim() || "Por confirmar";
    const direccion =
      taller?.direccionEntrega?.trim() || data.direccion?.trim() || "Por confirmar en WhatsApp";

    const notasPedido = [
      "Pedido desde Mostrador IA (web)",
      `Total referencia: ${formatoCop(total)}`,
      "Líneas:",
      resumenLineas,
      data.notas?.trim() ? `Notas cliente: ${data.notas.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const pedido = await createPedido(
      {
        tallerNombre: nombre,
        whatsapp,
        municipio,
        direccion,
        notas: notasPedido,
        requerimiento: "Pedido mostrador IA",
      },
      {
        esPrueba: false,
        lineas: lineasValidadas.map((l) => ({
          slug: l.slug,
          referencia: l.referencia,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
        })),
      },
    );

    if (!pedido.ok) {
      return { ok: false as const, reason: "pedido_fallo" as const, detail: pedido.reason };
    }

    await notificarApexNuevoPedido({
      pedidoId: pedido.pedidoId,
      tallerNombre: nombre,
      totalCop: total,
      esPrueba: false,
    }).catch(() => {});

    return {
      ok: true as const,
      pedidoId: pedido.pedidoId,
      totalCop: total,
      lineas: lineasValidadas,
    };
  });
