import type { BorradorPedidoWa, CarritoItemWa, WaSession } from "./types";
import {
  clasificarIntencion,
  esConfirmoEstricto,
  esConsultaLogisticaMixta,
  esNuevaConsultaPieza,
  esPedidoTotalCarrito,
  esSeguimientoRepuestosPendientes,
  esSolicitudCotizacionAdicional,
  esJuegoAmortiguadoresCompleto,
  esConsultaDetalleCotizacion,
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
  mensajeLogisticaMixta,
  mensajeModificar,
  mensajePlazoEntrega,
  mensajePlazoYAceptacion,
  mensajePreguntaCotizacionPendiente,
  mensajePreguntaCotizacionLista,
  mensajeRecordatorioConfirmo,
  mensajeRechazoCotizacion,
  mensajeReferenciaYaEnCarrito,
  mensajeResumenCarrito,
  mensajeResumenPedido,
  mensajeSinMatch,
  mensajeTransicionCarrito,
  mensajeTransicionResumen,
  mensajeDetallePosicionCotizada,
} from "./copy";
import { armarBorradorPedido, cotizarDesdeCatalogoWhatsApp, cotizarTrasAclaracion, intentarCotizarRespuestaCorta, resumenPieza, resumenVehiculo } from "./quote.server";
import { registrarPedidoDesdeBorrador, registrarPedidoDesdeCarrito } from "./confirm.server";
import { debePresentarSaludo, bloqueSaludo } from "./greeting";
import { debeAbandonarAclaracionPendiente } from "./aclaracion-flow";
import { esConsultaMultiplePiezas } from "../mostrador-inventario.server";
import { getTallerFidelizadoByWhatsapp } from "../talleres.server";
import {
  buscarEnCarritoPorMensaje,
  registrarCotizacionEnCarrito,
} from "./carrito.server";

export type TurnoAgenteWa = {
  texto: string;
  session: WaSession;
};

function limpiarBorrador(session: WaSession, opts?: { limpiarCarrito?: boolean }): void {
  session.agent.borrador = null;
  session.agent.aclaracionPendiente = null;
  session.agent.phase = "idle";
  session.agent.confirmacionCarrito = false;
  session.lastCotizacion = [];
  if (opts?.limpiarCarrito) session.agent.carrito = [];
}

function pasarAResumenCarrito(session: WaSession): string {
  session.agent.confirmacionCarrito = session.agent.carrito.length >= 1;
  session.agent.borrador = null;
  session.agent.phase = "esperando_confirmacion";
  return mensajeTransicionCarrito(session.agent.carrito);
}

function respuestaCarritoExistente(session: WaSession, item: CarritoItemWa): TurnoAgenteWa {
  session.agent.confirmacionCarrito = session.agent.carrito.length > 1;
  session.agent.phase = "esperando_confirmacion";
  return {
    texto: `${mensajeReferenciaYaEnCarrito(item.referencia)}\n\n${mensajeResumenCarrito(session.agent.carrito)}`,
    session,
  };
}

function ultimaListaRepuestosEnHistorial(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h?.role !== "user") continue;
    if (esConsultaMultiplePiezas(h.content)) return h.content;
  }
  return null;
}

function intentarRespuestaDetalleCotizacion(
  session: WaSession,
  body: string,
): TurnoAgenteWa | null {
  if (!esConsultaDetalleCotizacion(body)) return null;

  const lineas =
    session.lastCotizacion.length > 0
      ? session.lastCotizacion
      : session.agent.borrador
        ? [
            {
              referencia: session.agent.borrador.referencia,
              nombre: session.agent.borrador.nombre,
            },
          ]
        : [];

  if (lineas.length === 0) return null;

  const preguntaDel = /\bdelantera?s?\b/i.test(body);
  const preguntaTras = /\btrasera?s?\b/i.test(body);

  if (lineas.length === 1) {
    const l = lineas[0]!;
    const detalle = mensajeDetallePosicionCotizada({
      referencia: l.referencia,
      nombre: l.nombre,
    });
    const nombreUp = l.nombre.toUpperCase();
    const esDel = /\bDEL\b|\bDELANT/i.test(nombreUp);
    const esTras = /\bTRAS\b/i.test(nombreUp);

    if (preguntaDel && esTras) {
      return {
        texto:
          `No — ${detalle}\n\n` +
          "Si necesitas los *delanteros* del mismo vehículo, dime y te cotizo esa referencia.",
        session,
      };
    }
    if (preguntaDel && esDel) {
      return { texto: `Sí — ${detalle}\n\n¿Te sirve para pedirla?`, session };
    }
    if (preguntaTras && esDel) {
      return {
        texto:
          `No — ${detalle}\n\n` +
          "Si necesitas los *traseros*, dime y te cotizo esa referencia.",
        session,
      };
    }
    return { texto: `${detalle}\n\n¿Te sirve o buscas otra referencia?`, session };
  }

  const list = lineas
    .map((l, i) => {
      const n = l.nombre.toUpperCase();
      const pos = /\bTRAS\b/i.test(n) ? "trasera" : /\bDEL\b/i.test(n) ? "delantera" : "";
      return `*${i + 1}.* *${l.referencia}*${pos ? ` (${pos})` : ""}`;
    })
    .join("\n");

  return {
    texto:
      `Así van las referencias que te cotizé:\n\n${list}\n\n` +
      "¿Alguna en particular o quieres que te aclare delanteros/traseros?",
    session,
  };
}

function intentarRespuestaCarrito(session: WaSession, body: string): TurnoAgenteWa | null {
  if (esConsultaMultiplePiezas(body)) return null;

  if (esConsultaLogisticaMixta(body) && session.agent.carrito.length >= 2) {
    return {
      texto: `${mensajeLogisticaMixta(session.agent.carrito)}\n\n${mensajeResumenCarrito(session.agent.carrito)}`,
      session,
    };
  }

  if (
    (esPedidoTotalCarrito(body) || (/\bambas?\b/i.test(body) && session.agent.carrito.length >= 2)) &&
    session.agent.carrito.length >= 2
  ) {
    return { texto: pasarAResumenCarrito(session), session };
  }

  if (/\b(y\s+)?m[aá]s\b/i.test(body) || esNuevaConsultaPieza(body)) {
    const ya = buscarEnCarritoPorMensaje(session.agent.carrito, body);
    if (ya) return respuestaCarritoExistente(session, ya);
  }

  return null;
}

function registrarItemsCotizadosEnCarrito(
  session: WaSession,
  borrador: BorradorPedidoWa,
): void {
  registrarCotizacionEnCarrito(session, borrador);
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
  let phase = session.agent.phase;
  const intent = clasificarIntencion(body, phase);

  let textoCotizacion = body;
  if (esSeguimientoRepuestosPendientes(body)) {
    const lista = ultimaListaRepuestosEnHistorial(session.history);
    if (lista) {
      textoCotizacion = lista;
      session.agent.confirmacionCarrito = false;
      session.agent.borrador = null;
      if (phase === "esperando_confirmacion" || phase === "cotizado") {
        session.agent.phase = "idle";
        phase = "idle";
      }
    }
  }

  if (intent === "agradecimiento" && phase === "idle") {
    session.agent.greeted = true;
    return { texto: mensajeDespedida(), session };
  }

  if (intent === "cancelar") {
    limpiarBorrador(session, { limpiarCarrito: true });
    return { texto: mensajeCancelacion(), session };
  }

  const detalleCot = intentarRespuestaDetalleCotizacion(session, body);
  if (detalleCot) return detalleCot;

  const respuestaCarrito = intentarRespuestaCarrito(session, body);
  if (respuestaCarrito) return respuestaCarrito;

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
    if (!debeAbandonarAclaracionPendiente(body, session.agent.aclaracionPendiente)) {
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
      registrarItemsCotizadosEnCarrito(session, borrador);
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

    const recuperado = await intentarCotizarRespuestaCorta({
      history: session.history,
      whatsapp: args.phone,
    });
    if (recuperado?.tipo === "cotizacion") {
      const cantidad = recuperado.linea.cantidadSugerida ?? 1;
      const borrador = armarBorradorPedido({
        linea: recuperado.linea,
        ctx: recuperado.ctx,
        alcance: recuperado.alcance,
        cantidad,
        esPrecioTaller: recuperado.esPrecioTaller,
        nombreTaller: recuperado.nombreTaller,
      });
      session.agent.borrador = borrador;
      session.agent.phase = "cotizado";
      session.lastCotizacion = [recuperado.linea];
      registrarItemsCotizadosEnCarrito(session, borrador);
      const texto = mensajeCotizacionBreve({
        linea: recuperado.linea,
        aplicacion: recuperado.aplicacion,
        vehiculoResumen: borrador.vehiculoResumen,
        piezaResumen: borrador.piezaResumen,
        alcance: recuperado.alcance,
        incluirSaludo: false,
        esPrecioTaller: recuperado.esPrecioTaller,
        nombreTaller: recuperado.nombreTaller,
      });
      return { texto: texto.slice(0, 4000), session };
    }

    return {
      texto: "No pude cerrar esa aclaración. ¿Me confirmas delanteros, traseros, izquierda o derecha?",
      session,
    };
    } else {
      session.agent.aclaracionPendiente = null;
      session.agent.phase = "idle";
      phase = "idle";
    }
  }

  if (phase === "cotizado" && session.agent.borrador) {
    const carritoPrevio = intentarRespuestaCarrito(session, body);
    if (carritoPrevio) return carritoPrevio;

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

    if (
      (intent === "aceptar_cotizacion" || intent === "cantidad") &&
      !esConsultaMultiplePiezas(body) &&
      !esSolicitudCotizacionAdicional(body)
    ) {
      const qty = extraerCantidad(body) ?? session.agent.borrador.cantidad;
      return { texto: pasarAResumen(session, qty), session };
    }

    if (intent === "confirmar_pedido") {
      return { texto: pasarAResumen(session), session };
    }

    if (
      intent === "validar_compatibilidad" ||
      esConsultaMultiplePiezas(body) ||
      esJuegoAmortiguadoresCompleto(body) ||
      esConsultaDetalleCotizacion(body) ||
      (intent === "consulta" && esSolicitudCotizacionAdicional(body) && esNuevaConsultaPieza(body))
    ) {
      limpiarBorrador(session);
    } else if (intent === "consulta" && esSolicitudCotizacionAdicional(body)) {
      return {
        texto:
          "Claro, envíame cada repuesto con el vehículo (marca y modelo) en un solo mensaje y te cotizo todo.",
        session,
      };
    } else if (intent === "consulta" || intent === "agradecimiento") {
      return { texto: mensajePreguntaCotizacionPendiente(), session };
    } else {
      return { texto: mensajePreguntaCotizacionPendiente(), session };
    }
  }

  if (phase === "esperando_confirmacion") {
    if (session.agent.confirmacionCarrito && session.agent.carrito.length > 0) {
      const carritoPrevio = intentarRespuestaCarrito(session, body);
      if (carritoPrevio) return carritoPrevio;

      if (intent === "consulta_plazo") {
        return {
          texto:
            "Los plazos varían por referencia. Lo de *bodega* se despacha según operación del día; " +
            "lo *bajo pedido* te confirmamos al registrar.\n\n" +
            mensajeResumenCarrito(session.agent.carrito),
          session,
        };
      }

      if (intent === "confirmar_pedido" && esConfirmoEstricto(body)) {
        const reg = await confirmarPedidoCarrito(session, args.phone, args.contactName);
        return { texto: reg.texto, session };
      }

      if (intent === "confirmar_pedido") {
        return { texto: mensajeRecordatorioConfirmo(), session };
      }

      if (intent === "consulta" && esNuevaConsultaPieza(body)) {
        if (!esConsultaMultiplePiezas(body)) {
          const ya = buscarEnCarritoPorMensaje(session.agent.carrito, body);
          if (ya) return respuestaCarritoExistente(session, ya);
        }
        session.agent.confirmacionCarrito = false;
        session.agent.phase = "idle";
      } else if (intent === "consulta" && esSeguimientoRepuestosPendientes(body)) {
        session.agent.confirmacionCarrito = false;
        session.agent.phase = "idle";
      } else if (intent === "consulta") {
        return { texto: mensajeRecordatorioConfirmo(), session };
      }
    } else if (session.agent.borrador) {
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
  }

  if (!body) {
    const saludo = prefijoSaludo(session);
    return { texto: saludo + (saludo ? "¿Qué repuesto necesitas?" : mensajeBienvenidaConsulta()), session };
  }

  const historyCotizar =
    textoCotizacion !== body
      ? [...session.history, { role: "user" as const, content: textoCotizacion }]
      : session.history;

  const resultado = await cotizarDesdeCatalogoWhatsApp({
    history: historyCotizar,
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
    const recuperado = await intentarCotizarRespuestaCorta({
      history: session.history,
      whatsapp: args.phone,
    });
    if (recuperado?.tipo === "necesita_aclaracion") {
      session.agent.aclaracionPendiente = recuperado.pendiente;
      session.agent.phase = "esperando_aclaracion";
      return { texto: (saludo + recuperado.pendiente.pregunta).slice(0, 4000), session };
    }
    if (recuperado?.tipo === "cotizacion") {
      const cantidad = recuperado.linea.cantidadSugerida ?? 1;
      const borrador = armarBorradorPedido({
        linea: recuperado.linea,
        ctx: recuperado.ctx,
        alcance: recuperado.alcance,
        cantidad,
        esPrecioTaller: recuperado.esPrecioTaller,
        nombreTaller: recuperado.nombreTaller,
      });
      session.agent.borrador = borrador;
      session.agent.phase = "cotizado";
      session.lastCotizacion = [recuperado.linea];
      registrarItemsCotizadosEnCarrito(session, borrador);
      const texto = mensajeCotizacionBreve({
        linea: recuperado.linea,
        aplicacion: recuperado.aplicacion,
        vehiculoResumen: borrador.vehiculoResumen,
        piezaResumen: borrador.piezaResumen,
        alcance: recuperado.alcance,
        incluirSaludo: Boolean(saludo),
        esPrecioTaller: recuperado.esPrecioTaller,
        nombreTaller: recuperado.nombreTaller,
      });
      return { texto: texto.slice(0, 4000), session };
    }

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

    for (const item of lineasOk) {
      const qty = item.cantidadSugerida ?? 1;
      const borradorItem = armarBorradorPedido({
        linea: item.linea,
        ctx: item.ctx,
        alcance: item.alcance,
        cantidad: qty,
        esPrecioTaller: resultado.esPrecioTaller,
        nombreTaller: resultado.nombreTaller,
      });
      registrarItemsCotizadosEnCarrito(session, borradorItem);
    }

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
  registrarItemsCotizadosEnCarrito(session, borrador);

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
  limpiarBorrador(session, { limpiarCarrito: true });
  session.agent.phase = "pedido_creado";
  return { texto: reg.texto };
}

async function confirmarPedidoCarrito(
  session: WaSession,
  phone: string,
  contactName?: string,
): Promise<{ texto: string }> {
  const resumen = mensajeResumenCarrito(session.agent.carrito);
  const reg = await registrarPedidoDesdeCarrito({
    phone,
    items: session.agent.carrito,
    resumenEnviado: resumen,
    contactName,
  });
  if (!reg.ok) {
    return { texto: reg.texto };
  }
  limpiarBorrador(session, { limpiarCarrito: true });
  session.agent.phase = "pedido_creado";
  return { texto: reg.texto };
}
