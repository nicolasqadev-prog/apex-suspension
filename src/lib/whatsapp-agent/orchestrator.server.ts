import type { WaSession } from "./types";
import {
  clasificarIntencion,
  esConfirmoEstricto,
  esNuevaConsultaPieza,
  extraerCantidad,
  buildConfirmToken,
} from "./intents";
import {
  mensajeBienvenidaConsulta,
  mensajeCancelacion,
  mensajeCotizacionBreve,
  mensajeCotizacionMultiple,
  mensajeDespedida,
  mensajeFaltaVehiculo,
  mensajeFueraAlcance,
  mensajeModificar,
  mensajePlazoEntrega,
  mensajePlazoYAceptacion,
  mensajePreguntaCotizacionPendiente,
  mensajePreguntaCotizacionLista,
  mensajeRecordatorioConfirmo,
  mensajeRechazoCotizacion,
  mensajeResumenPedido,
  mensajeSinMatch,
  mensajeTransicionResumen,
} from "./copy";
import { armarBorradorPedido, cotizarDesdeCatalogoWhatsApp, resumenPieza, resumenVehiculo } from "./quote.server";
import { registrarPedidoDesdeBorrador } from "./confirm.server";
import type { BorradorPedidoWa } from "./types";
import { debePresentarSaludo, bloqueSaludo } from "./greeting";

export type TurnoAgenteWa = {
  texto: string;
  session: WaSession;
};

function limpiarBorrador(session: WaSession): void {
  session.agent.borrador = null;
  session.agent.phase = "idle";
  session.lastCotizacion = [];
}

function pasarAResumen(session: WaSession, cantidad?: number): string {
  const b = session.agent.borrador!;
  if (cantidad != null) b.cantidad = cantidad;
  b.confirmToken = buildConfirmToken(b);
  b.resumenEnviado = mensajeResumenPedido(b);
  session.agent.phase = "esperando_confirmacion";
  return mensajeTransicionResumen(b);
}

function prefijoSaludo(session: WaSession): string {
  return debePresentarSaludo(session) ? bloqueSaludo() : "";
}

/** Orquestador del agente WhatsApp (plantilla Apex). */
export async function ejecutarTurnoAgenteWhatsApp(args: {
  session: WaSession;
  mensajeUsuario: string;
  phone: string;
  contactName?: string;
}): Promise<TurnoAgenteWa> {
  const session = args.session;
  const body = args.mensajeUsuario.trim();
  const phase = session.agent.phase;
  const intent = clasificarIntencion(body, phase);

  if (intent === "agradecimiento" && phase === "idle") {
    session.agent.greeted = true;
    return { texto: mensajeDespedida(), session };
  }

  if (intent === "cancelar") {
    limpiarBorrador(session);
    return { texto: mensajeCancelacion(), session };
  }

  if (
    session.lastCotizacion.length > 1 &&
    phase === "idle" &&
    (intent === "aceptar_cotizacion" || /\b(s[ií]|si)\s*,?\s*(me\s+)?sirve\b/i.test(body))
  ) {
    return { texto: mensajePreguntaCotizacionLista(), session };
  }

  if (intent === "modificar_pedido") {
    limpiarBorrador(session);
    return { texto: mensajeModificar(), session };
  }

  if (phase === "cotizado" && session.agent.borrador) {
    if (intent === "consulta_plazo") {
      const b = session.agent.borrador;
      if (/\b(s[ií]|si)\s*,?\s*(me\s+)?sirve\b/i.test(body)) {
        const qty = extraerCantidad(body) ?? b.cantidad;
        if (qty != null) b.cantidad = qty;
        b.confirmToken = buildConfirmToken(b);
        b.resumenEnviado = mensajeResumenPedido(b);
        session.agent.phase = "esperando_confirmacion";
        return { texto: mensajePlazoYAceptacion(b), session };
      }
      return { texto: mensajePlazoEntrega(session.agent.borrador), session };
    }

    if (intent === "rechazar") {
      limpiarBorrador(session);
      return { texto: mensajeRechazoCotizacion(), session };
    }

    if (intent === "aceptar_cotizacion" || intent === "cantidad") {
      const qty = extraerCantidad(body) ?? session.agent.borrador.cantidad;
      return { texto: pasarAResumen(session, qty), session };
    }

    if (intent === "confirmar_pedido") {
      return { texto: pasarAResumen(session), session };
    }

    if (intent === "validar_compatibilidad" || (intent === "consulta" && esNuevaConsultaPieza(body))) {
      limpiarBorrador(session);
    } else if (intent === "consulta" || intent === "agradecimiento") {
      return { texto: mensajePreguntaCotizacionPendiente(), session };
    } else {
      return { texto: mensajePreguntaCotizacionPendiente(), session };
    }
  }

  if (phase === "esperando_confirmacion" && session.agent.borrador) {
    if (intent === "consulta_plazo") {
      return { texto: mensajePlazoEntrega(session.agent.borrador), session };
    }

    const qty = extraerCantidad(body);
    if (qty != null && intent === "cantidad") {
      session.agent.borrador.cantidad = qty;
      session.agent.borrador.confirmToken = buildConfirmToken(session.agent.borrador);
      session.agent.borrador.resumenEnviado = mensajeResumenPedido(session.agent.borrador);
      return {
        texto: `Listo, *${qty}* unidad(es).\n\n${session.agent.borrador.resumenEnviado}`,
        session,
      };
    }

    if (intent === "aceptar_cotizacion") {
      return { texto: mensajeRecordatorioConfirmo(), session };
    }

    if (intent === "confirmar_pedido" && esConfirmoEstricto(body)) {
      const reg = await confirmarPedido(session, args.phone, args.contactName);
      return { texto: reg.texto, session };
    }

    if (intent === "confirmar_pedido") {
      return { texto: mensajeRecordatorioConfirmo(), session };
    }

    if (intent === "consulta" && esNuevaConsultaPieza(body)) {
      limpiarBorrador(session);
    } else if (intent === "consulta") {
      return { texto: mensajeRecordatorioConfirmo(), session };
    }
  }

  if (!body) {
    const saludo = prefijoSaludo(session);
    return { texto: saludo + (saludo ? "¿Qué repuesto necesitas?" : mensajeBienvenidaConsulta()), session };
  }

  const resultado = await cotizarDesdeCatalogoWhatsApp({
    history: session.history,
    whatsapp: args.phone,
  });

  const saludo = prefijoSaludo(session);

  if (resultado.tipo === "fuera_alcance") {
    limpiarBorrador(session);
    return { texto: saludo + mensajeFueraAlcance(), session };
  }

  if (resultado.tipo === "falta_contexto") {
    limpiarBorrador(session);
    return { texto: saludo + mensajeFaltaVehiculo(resultado.ctx.pieza), session };
  }

  if (resultado.tipo === "sin_match") {
    limpiarBorrador(session);
    const pieza = resultado.ctx.pieza ?? "esa pieza";
    const veh = [resultado.ctx.marcaVehiculo, resultado.ctx.vehiculo, resultado.ctx.ano]
      .filter(Boolean)
      .join(" ");
    return { texto: saludo + mensajeSinMatch(pieza, veh), session };
  }

  if (resultado.tipo === "marca_no_vendida") {
    limpiarBorrador(session);
    return {
      texto:
        saludo +
        `No manejamos la marca *${resultado.marca}* de forma habitual. ` +
        "Si me das referencia y vehículo, busco el equivalente en catálogo.",
      session,
    };
  }

  if (resultado.tipo === "cotizacion_multiple") {
    const lineasOk = resultado.items.filter((i) => i.estado === "ok");
    session.agent.borrador = null;
    session.agent.phase = "idle";
    session.lastCotizacion = lineasOk.map((i) => i.linea);

    const textoMulti = mensajeCotizacionMultiple({
      items: resultado.items.map((i) => ({
        estado: i.estado,
        piezaResumen: resumenPieza(i.ctx),
        vehiculoResumen: resumenVehiculo(i.ctx),
        cantidadSugerida: i.cantidadSugerida,
        linea: i.estado === "ok" ? i.linea : undefined,
        alcance: i.estado === "ok" ? i.alcance : undefined,
      })),
      incluirSaludo: Boolean(saludo),
      esPrecioTaller: resultado.esPrecioTaller,
      nombreTaller: resultado.nombreTaller,
    });

    return { texto: textoMulti.slice(0, 4000), session };
  }

  if (resultado.tipo !== "cotizacion") {
    return { texto: "No pude cotizar en este momento. Un asesor te ayuda en breve.", session };
  }

  const cantidad =
    extraerCantidad(body) ?? resultado.linea.cantidadSugerida ?? 1;
  const borrador = armarBorradorPedido({
    linea: resultado.linea,
    ctx: resultado.ctx,
    alcance: resultado.alcance,
    cantidad,
    esPrecioTaller: resultado.esPrecioTaller,
    nombreTaller: resultado.nombreTaller,
  });

  session.agent.borrador = borrador;
  session.agent.phase = "cotizado";
  session.lastCotizacion = [resultado.linea];

  const texto = mensajeCotizacionBreve({
    linea: resultado.linea,
    aplicacion: resultado.aplicacion,
    vehiculoResumen: borrador.vehiculoResumen,
    piezaResumen: borrador.piezaResumen,
    alcance: resultado.alcance,
    incluirSaludo: Boolean(saludo),
    esPrecioTaller: resultado.esPrecioTaller,
    nombreTaller: resultado.nombreTaller,
  });

  return { texto: texto.slice(0, 4000), session };
}

async function confirmarPedido(
  session: WaSession,
  phone: string,
  contactName?: string,
): Promise<{ texto: string }> {
  const borrador = session.agent.borrador as BorradorPedidoWa;
  const tokenVigente = buildConfirmToken(borrador);
  if (tokenVigente !== borrador.confirmToken) {
    borrador.confirmToken = tokenVigente;
    borrador.resumenEnviado = mensajeResumenPedido(borrador);
    return {
      texto:
        "Actualicé el total. Revísalo y escribe *CONFIRMO*:\n\n" + borrador.resumenEnviado,
    };
  }

  const reg = await registrarPedidoDesdeBorrador({
    phone,
    borrador,
    contactName,
  });
  if (!reg.ok) {
    return { texto: reg.texto };
  }
  limpiarBorrador(session);
  session.agent.phase = "pedido_creado";
  return { texto: reg.texto };
}
