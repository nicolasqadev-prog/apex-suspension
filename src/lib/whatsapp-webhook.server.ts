import { formatoCop, type MostradorCotizacionLinea } from "./mostrador";
import { procesarTurnoMostrador } from "./mostrador-turno.server";
import { createPedido } from "./pedidos.server";
import { notificarApexNuevoPedido } from "./pedidos-alerta.server";
import { getTallerFidelizadoByWhatsapp, normalizeWhatsapp } from "./talleres.server";
import { enviarTextoWhatsApp } from "./whatsapp-cloud.server";
import { aplicarDescuento } from "./pricing";

type ChatMsg = { role: "user" | "assistant"; content: string };

type WaSession = {
  history: ChatMsg[];
  lastCotizacion: MostradorCotizacionLinea[];
  updatedAt: number;
};

const SESSION_TTL_MS = 2 * 60 * 60_000;
const sessions = new Map<string, WaSession>();

function getSession(phone: string): WaSession {
  const key = normalizeWhatsapp(phone);
  const existing = sessions.get(key);
  const now = Date.now();
  if (existing && now - existing.updatedAt < SESSION_TTL_MS) {
    return existing;
  }
  const fresh: WaSession = { history: [], lastCotizacion: [], updatedAt: now };
  sessions.set(key, fresh);
  return fresh;
}

function saveSession(phone: string, session: WaSession) {
  session.updatedAt = Date.now();
  sessions.set(normalizeWhatsapp(phone), session);
}

function formatearRespuestaWhatsApp(reply: string, questions: string[]): string {
  const qs =
    questions.length > 0 ? `\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}` : "";
  return `${reply}${qs}`.slice(0, 4000);
}

function appendCotizacionAlMensaje(reply: string, cotizacion: MostradorCotizacionLinea[]): string {
  if (!cotizacion.length) return reply;
  const bloque = cotizacion
    .slice(0, 3)
    .map((l) => {
      const disp = l.disponibilidad === "bodega" ? `✓ ${l.stock} en bodega` : "○ Bajo pedido";
      return `• *${l.referencia}* (${l.marcaProducto})\n  ${l.nombre}\n  ${formatoCop(l.precioUnitarioCop)} c/u — ${disp}`;
    })
    .join("\n\n");
  return `${reply}\n\n📋 *Cotización sistema:*\n${bloque}\n\n_Escribe CONFIRMO para pedir la primera línea, o sigue preguntando._`;
}

const CONFIRMO_RX = /\bconfirmo\b/i;

async function intentarConfirmarPedido(
  phone: string,
  session: WaSession,
  contactName?: string,
): Promise<string | null> {
  if (!CONFIRMO_RX.test(session.history.at(-1)?.content ?? "")) return null;
  if (session.lastCotizacion.length === 0) return null;

  const linea = session.lastCotizacion[0];
  const whatsapp = normalizeWhatsapp(phone);
  const taller = await getTallerFidelizadoByWhatsapp(whatsapp);

  const { loadPiezaBySlug } = await import("./inventario.server");
  const piezaData = await loadPiezaBySlug(linea.slug);
  if (!piezaData.pieza) return "No pude validar la referencia. Un asesor te confirma en breve.";

  const p = piezaData.pieza;
  const qty = 1;
  const precioUnitario =
    taller != null
      ? p.precioTallerRef != null && p.precioTallerRef > 0
        ? Math.round(p.precioTallerRef)
        : aplicarDescuento(p.precioLista, taller.descuentoPorcentaje)
      : p.precioLista;

  const nombre = taller?.nombreTaller?.trim() || contactName?.trim() || "Cliente WhatsApp";
  const municipio = taller?.municipio?.trim() || "Por confirmar";
  const direccion = taller?.direccionEntrega?.trim() || "Por confirmar en chat";

  const pedido = await createPedido(
    {
      tallerNombre: nombre,
      whatsapp,
      municipio,
      direccion,
      notas: [
        "Pedido desde agente WhatsApp",
        `Total ref: ${formatoCop(precioUnitario)}`,
        `· ${linea.referencia} ×${qty}`,
      ].join("\n"),
      requerimiento: "Pedido WhatsApp IA",
    },
    {
      esPrueba: false,
      lineas: [
        {
          slug: linea.slug,
          referencia: linea.referencia,
          cantidad: qty,
          precioUnitario,
        },
      ],
    },
  );

  if (!pedido.ok) {
    return "Hubo un problema al registrar el pedido. Un asesor humano te confirma en un momento.";
  }

  await notificarApexNuevoPedido({
    pedidoId: pedido.pedidoId,
    tallerNombre: nombre,
    totalCop: precioUnitario,
    esPrueba: false,
  }).catch(() => {});

  session.lastCotizacion = [];
  return `✅ *Pedido registrado en Apex*\n${linea.referencia} ×${qty} — ${formatoCop(precioUnitario)}\n\nEl equipo confirma stock y despacho por este mismo chat.`;
}

/** Procesa un mensaje entrante de WhatsApp y responde por la API. */
export async function procesarMensajeWhatsAppEntrante(msg: {
  from: string;
  body: string;
  contactName?: string;
}): Promise<void> {
  const session = getSession(msg.from);
  session.history.push({ role: "user", content: msg.body });

  const confirmReply = await intentarConfirmarPedido(msg.from, session, msg.contactName);
  if (confirmReply) {
    session.history.push({ role: "assistant", content: confirmReply });
    saveSession(msg.from, session);
    await enviarTextoWhatsApp(msg.from, confirmReply);
    return;
  }

  const res = await procesarTurnoMostrador({
    history: session.history.slice(-16),
    context: { whatsapp: normalizeWhatsapp(msg.from) },
  });

  if (res.cotizacion?.length) {
    session.lastCotizacion = res.cotizacion;
  }

  let texto = formatearRespuestaWhatsApp(res.reply, res.questions);
  if (res.action === "quote" && res.cotizacion?.length) {
    texto = appendCotizacionAlMensaje(res.reply, res.cotizacion);
  }

  session.history.push({ role: "assistant", content: res.reply });
  saveSession(msg.from, session);

  await enviarTextoWhatsApp(msg.from, texto);
}
