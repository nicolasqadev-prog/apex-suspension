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
import { armarBorradorPedido, cotizarDesdeCatalogoWhatsApp, cotizarTrasAclaracion, resumenPieza, resumenVehiculo } from "./quote.server";
import { registrarPedidoDesdeBorrador } from "./confirm.server";
import type { BorradorPedidoWa } from "./types";
import { debePresentarSaludo, bloqueSaludo } from "./greeting";
import { getTallerFidelizadoByWhatsapp } from "../talleres.server";

export type TurnoAgenteWa = {
  texto: string;
  session: WaSession;
};

function limpiarBorrador(session: WaSession): void {
  session.agent.borrador = null;
  session.agent.aclaracionPendiente = null;
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

  if (phase === "esperando_aclaracion" && session.agent.aclaracionPendiente) {
    const taller = await getTallerFidelizadoByWhatsapp(args.phone);
    const res = await cotizarTrasAclaracion({
      pendiente: session.agent.aclaracionPendiente,
      respuesta: body,
      taller,
    });
    session.agent.aclaracionPendiente = null;
    session.agent.phase = "idle";

    if (res.tipo === "necesita_aclaracion") {
      session.agent.aclaracionPendiente = res.pendiente;
      session.agent.phase = "esperando_aclaracion";
      return { texto: res.pendiente.pregunta, session };
    }

    if (res.tipo === "cotizacion_multiple") {
      const lineasOk = res.items.filter((i) => i.estado === "ok");
      session.lastCotizacion = lineasOk.map((i) => i.linea);
      const textoMulti = mensajeCotizacionMultiple({
        items: res.items.map((i) => ({
          estado: i.estado,
          piezaResumen: resumenPieza(i.ctx),
          vehiculoResumen: resumenVehiculo(i.ctx),
          cantidadSugerida: i.cantidadSugerida,
          pregunta: i.estado === "necesita_aclaracion" ? i.pregunta : undefined,
          linea: i.estado === "ok" ? i.linea : undefined,
          alcance: i.estado === "ok" ? i.alcance : undefined,
        })),
        incluirSaludo: false,
        esPrecioTaller: res.esPrecioTaller,
        nombreTaller: res.nombreTaller,
      });
      return { texto: textoMulti.slice(0, 4000), session };
    }

    if (res.tipo === "cotizacion") {
      const cantidad = res.linea.cantidadSugerida ?? 1;
      const borrador = armarBorradorPedido({
        linea: res.linea,
        ctx: res.ctx,
        alcance: res.alcance,
        cantidad,
        esPrecioTaller: res.esPrecioTaller,
        nombreTaller: res.nombreTaller,
      });
      session.agent.borrador = borrador;
      session.agent.phase = "cotizado";
      session.lastCotizacion = [res.linea];
      const texto = mensajeCotizacionBreve({
        linea: res.linea,
        aplicacion: res.aplicacion,
        vehiculoResumen: borrador.vehiculoResumen,
        piezaResumen: borrador.piezaResumen,
        alcance: res.alcance,
        incluirSaludo: false,
        esPrecioTaller: res.esPrecioTaller,
        nombreTaller: res.nombreTaller,
      });
      return { texto: texto.slice(0, 4000), session };
    }

    return {
      texto: "No pude cerrar esa aclaración. ¿Me confirmas delanteros, traseros, izquierda o derecha?",
      session,
    };
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

    const aclaraciones = resultado.items.filter((i) => i.estado === "necesita_aclaracion");
    if (aclaraciones.length === 1) {
      const a = aclaraciones[0];
      session.agent.aclaracionPendiente = {
        segmento: a.segmento,
        ctx: a.ctx,
        candidatosSlugs: a.candidatosSlugs,
        cantidadSugerida: a.cantidadSugerida,
        pregunta: a.pregunta,
      };
      session.agent.phase = "esperando_aclaracion";
    }

    const textoMulti = mensajeCotizacionMultiple({
      items: resultado.items.map((i) => ({
        estado: i.estado,
        piezaResumen: resumenPieza(i.ctx),
        vehiculoResumen: resumenVehiculo(i.ctx),
        cantidadSugerida: i.cantidadSugerida,
        pregunta: i.estado === "necesita_aclaracion" ? i.pregunta : undefined,
        linea: i.estado === "ok" ? i.linea : undefined,
        alcance: i.estado === "ok" ? i.alcance : undefined,
      })),
      incluirSaludo: Boolean(saludo),
      esPrecioTaller: resultado.esPrecioTaller,
      nombreTaller: resultado.nombreTaller,
    });

    return { texto: textoMulti.slice(0, 4000), session };
  }

  if (resultado.tipo === "necesita_aclaracion") {
    session.agent.aclaracionPendiente = resultado.pendiente;
    session.agent.phase = "esperando_aclaracion";
    return { texto: (saludo + resultado.pendiente.pregunta).slice(0, 4000), session };
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
