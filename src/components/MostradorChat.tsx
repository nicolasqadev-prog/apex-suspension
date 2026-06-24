import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, MessageCircle, Plus, Send, ShoppingCart, X } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePersistentState } from "@/lib/usePersistentState";
import { confirmarPedidoMostrador, responderMostrador } from "@/lib/mostrador.functions";
import {
  buildWhatsappHandoffLink,
  etiquetaDisponibilidad,
  formatoCop,
  normalizeShortText,
  totalCarrito,
  type MostradorCarritoLinea,
  type MostradorCotizacionLinea,
  type MostradorDraft,
} from "@/lib/mostrador";
import { consultarTallerFidelizado } from "@/lib/talleres.functions";

type ChatMsg = { role: "user" | "assistant"; content: string };

function initialAssistantMessage() {
  return [
    "Hola, soy el mostrador de Apex.",
    "Te cotizo en segundos con precios y stock reales del catálogo.",
    "Dime la pieza, referencia o síntoma — y si puedes, el vehículo y el año.",
  ].join(" ");
}

function scrollMessagesToEnd(el: HTMLDivElement | null) {
  if (!el) return;
  const run = () => {
    el.scrollTop = el.scrollHeight;
  };
  run();
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });
  window.setTimeout(run, 80);
}

export default function MostradorChat() {
  const [open, setOpen] = useState(false);
  const [whatsapp, setWhatsapp] = usePersistentState("apex.whatsapp", "");
  const [carro, setCarro] = usePersistentState("apex.carro", "");
  const [ano, setAno] = usePersistentState("apex.ano", "");
  const [version, setVersion] = usePersistentState("apex.version", "");

  const [piezaOSintoma, setPiezaOSintoma] = useState("");
  const [composer, setComposer] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [direccion, setDireccion] = useState("");

  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "assistant", content: initialAssistantMessage() },
  ]);
  const [loading, setLoading] = useState(false);
  const [lastQuestions, setLastQuestions] = useState<string[]>([]);
  const [handoffTag, setHandoffTag] = useState<"normal" | "bajo_encargo">("normal");
  const [cotizacion, setCotizacion] = useState<MostradorCotizacionLinea[]>([]);
  const [carrito, setCarrito] = useState<MostradorCarritoLinea[]>([]);
  const [pedidoEnviado, setPedidoEnviado] = useState<string | null>(null);
  const [confirmandoPedido, setConfirmandoPedido] = useState(false);
  const [tallerCuenta, setTallerCuenta] = useState<MostradorDraft["tallerCuenta"]>();

  const draft: MostradorDraft = useMemo(
    () => ({
      piezaOSintoma,
      whatsapp,
      carro,
      ano,
      version,
      municipio,
      handoffTag,
      lineasCotizadas: cotizacion,
      tallerCuenta,
    }),
    [piezaOSintoma, whatsapp, carro, ano, version, municipio, handoffTag, cotizacion, tallerCuenta],
  );

  const whatsappLink = useMemo(() => buildWhatsappHandoffLink(draft), [draft]);
  const totalPedido = useMemo(() => totalCarrito(carrito), [carrito]);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  const whatsappValido = whatsapp.replace(/\D/g, "").length >= 10;
  const puedeConfirmarPedido = carrito.length > 0 && whatsappValido && !pedidoEnviado;

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("apex:mostrador:open", onOpen);
    return () => window.removeEventListener("apex:mostrador:open", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    scrollMessagesToEnd(messagesScrollRef.current);
  }, [open, msgs.length, loading, lastQuestions.length, cotizacion.length, carrito.length]);

  async function syncTallerCuenta() {
    if (!whatsappValido) {
      setTallerCuenta(undefined);
      return;
    }
    try {
      const t = await consultarTallerFidelizado({ data: { whatsapp: whatsapp.trim() } });
      if (t.ok && t.validado) {
        setTallerCuenta({ validado: true, contraEntregaHabilitada: t.contraEntregaHabilitada });
      } else if (t.ok) {
        setTallerCuenta({ validado: false });
      } else {
        setTallerCuenta(undefined);
      }
    } catch {
      setTallerCuenta(undefined);
    }
  }

  function agregarAlCarrito(linea: MostradorCotizacionLinea, cantidad = 1) {
    setCarrito((prev) => {
      const idx = prev.findIndex((l) => l.slug === linea.slug);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], cantidad: next[idx].cantidad + cantidad };
        return next;
      }
      return [
        ...prev,
        {
          slug: linea.slug,
          referencia: linea.referencia,
          nombre: linea.nombre,
          cantidad,
          precioUnitarioCop: linea.precioUnitarioCop,
          disponibilidad: linea.disponibilidad,
        },
      ];
    });
    setMsgs((m) => [
      ...m,
      {
        role: "assistant",
        content: `Agregué ${linea.referencia} al pedido (${cantidad} u.). ¿Algo más o confirmamos?`,
      },
    ]);
  }

  async function onSend() {
    const text = normalizeShortText(composer, 280);
    if (!text || loading) return;

    const confirmKeywords = /\b(s[ií]\s*,?\s*(lo\s+)?quiero|confirmo|haz(el)?\s+el\s+pedido|listo\s+el\s+pedido|pedir|ordenar)\b/i;
    if (confirmKeywords.test(text) && carrito.length > 0 && whatsappValido) {
      setComposer("");
      await onConfirmarPedido();
      return;
    }

    setMsgs((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    setLastQuestions([]);
    setComposer("");
    if (!piezaOSintoma.trim()) setPiezaOSintoma(text);

    await syncTallerCuenta();

    try {
      const history = [...msgs, { role: "user" as const, content: text }].slice(-16);
      const res = await responderMostrador({
        data: {
          history,
          context: {
            whatsapp: whatsapp.trim() || undefined,
            carro: carro.trim() || undefined,
            ano: ano.trim() || undefined,
            version: version.trim() || undefined,
            municipio: municipio.trim() || undefined,
            piezaPrioritaria: piezaOSintoma.trim() || undefined,
          },
        },
      });

      if (res?.tallerCuenta) setTallerCuenta(res.tallerCuenta);

      const reply =
        res?.reply?.trim() ||
        "Dame referencia o descripción de la pieza y te cotizo con el catálogo.";

      setMsgs((m) => [...m, { role: "assistant", content: reply }]);

      if (Array.isArray(res?.cotizacion) && res.cotizacion.length > 0) {
        setCotizacion(res.cotizacion);
      }

      setHandoffTag(res?.handoffTag === "bajo_encargo" ? "bajo_encargo" : "normal");
      setLastQuestions(Array.isArray(res?.questions) ? res.questions.slice(0, 3) : []);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Hubo un problema al consultar el catálogo. Intenta de nuevo o escríbenos por WhatsApp con la referencia.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function onConfirmarPedido() {
    if (!puedeConfirmarPedido || confirmandoPedido) return;
    setConfirmandoPedido(true);
    try {
      const res = await confirmarPedidoMostrador({
        data: {
          whatsapp: whatsapp.trim(),
          municipio: municipio.trim() || undefined,
          direccion: direccion.trim() || undefined,
          notas: [carro.trim() && `Vehículo: ${carro.trim()}`, ano.trim() && `Año: ${ano.trim()}`]
            .filter(Boolean)
            .join(" · "),
          lineas: carrito.map((l) => ({ slug: l.slug, cantidad: l.cantidad })),
        },
      });

      if (!res.ok) {
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            content:
              res.reason === "rate_limit"
                ? "Demasiados intentos. Espera un momento o confirma por WhatsApp."
                : "No pude registrar el pedido. Verifica stock y datos, o confirma por WhatsApp.",
          },
        ]);
        return;
      }

      setPedidoEnviado(res.pedidoId);
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: `Pedido registrado en Apex (${formatoCop(res.totalCop)} referencia). El equipo confirma stock y despacho por WhatsApp. Gracias por tu compra.`,
        },
      ]);
      setCarrito([]);
      setCotizacion([]);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content: "Error al registrar el pedido. Usa el botón de WhatsApp para confirmar con el equipo.",
        },
      ]);
    } finally {
      setConfirmandoPedido(false);
    }
  }

  function reset() {
    setMsgs([{ role: "assistant", content: initialAssistantMessage() }]);
    setLastQuestions([]);
    setPiezaOSintoma("");
    setMunicipio("");
    setDireccion("");
    setComposer("");
    setHandoffTag("normal");
    setCotizacion([]);
    setCarrito([]);
    setPedidoEnviado(null);
    setTallerCuenta(undefined);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[oklch(0.7_0.2_40)] px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400"
        aria-label="Abrir Mostrador Apex"
      >
        <MessageCircle className="h-5 w-5" />
        Cotizar con IA
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[oklch(0.18_0.04_250)] border border-white/10 text-gray-200 p-0 overflow-hidden max-w-[680px] w-[min(680px,calc(100vw-24px))] max-h-[min(90dvh,720px)] h-[min(90dvh,720px)] flex flex-col gap-0 sm:rounded-lg [&>button]:hidden">
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10 shrink-0">
            <DialogHeader className="space-y-0 text-left pr-2">
              <DialogTitle className="text-white text-base font-bold">Mostrador Apex</DialogTitle>
              <p className="text-xs text-gray-400 mt-1">
                Cotización en vivo · precios y stock del catálogo · pedido registrado en Apex
              </p>
            </DialogHeader>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 text-gray-300 hover:text-white"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              ref={messagesScrollRef}
              className="flex-1 min-h-0 overflow-y-auto px-5 pt-2 pb-3"
              aria-live="polite"
            >
              <div className="space-y-3">
                {msgs.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[min(100%,520px)] rounded-2xl px-4 py-3 text-[13px] leading-snug ${
                        m.role === "user"
                          ? "bg-[oklch(0.7_0.2_40)] text-white"
                          : "bg-black/25 border border-white/10 text-gray-200"
                      }`}
                    >
                      <span className="whitespace-pre-wrap break-words">{m.content}</span>
                    </div>
                  </div>
                ))}
                {loading && <p className="text-xs text-gray-500">Consultando catálogo…</p>}
              </div>

              {cotizacion.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-white flex items-center gap-1">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    Cotización del sistema
                  </p>
                  {cotizacion.map((l) => (
                    <div
                      key={l.slug}
                      className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs"
                    >
                      <p className="font-semibold text-white">
                        {l.referencia}{" "}
                        <span className="font-normal text-gray-400">· {l.marcaProducto}</span>
                      </p>
                      <p className="text-gray-300 mt-0.5 line-clamp-2">{l.nombre}</p>
                      <p className="mt-1 text-[oklch(0.7_0.2_40)] font-bold">
                        {formatoCop(l.precioUnitarioCop)} c/u
                      </p>
                      <p className="text-gray-500 mt-0.5">{etiquetaDisponibilidad(l.disponibilidad)}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 border-gray-600 text-gray-200 text-[11px]"
                        onClick={() => agregarAlCarrito(l)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Agregar al pedido
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {lastQuestions.length > 0 && (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs font-semibold text-white">Para afinar</p>
                  <ul className="mt-2 space-y-1 text-xs text-gray-400">
                    {lastQuestions.map((q) => (
                      <li key={q}>- {q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 bg-[oklch(0.14_0.04_250)] px-5 py-3 space-y-3 max-h-[48svh] overflow-y-auto">
              {carrito.length > 0 && (
                <div className="rounded-xl border border-[oklch(0.7_0.2_40)]/30 bg-black/30 px-3 py-2.5">
                  <p className="text-xs font-semibold text-white">Tu pedido</p>
                  <ul className="mt-2 space-y-1 text-xs text-gray-300">
                    {carrito.map((l) => (
                      <li key={l.slug} className="flex justify-between gap-2">
                        <span>
                          {l.referencia} ×{l.cantidad}
                        </span>
                        <span>{formatoCop(l.precioUnitarioCop * l.cantidad)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm font-bold text-[oklch(0.7_0.2_40)]">
                    Total referencia: {formatoCop(totalPedido)}
                  </p>
                  {pedidoEnviado ? (
                    <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pedido registrado en Apex
                    </p>
                  ) : (
                    <Button
                      type="button"
                      disabled={!puedeConfirmarPedido || confirmandoPedido}
                      onClick={() => void onConfirmarPedido()}
                      className="mt-2 w-full bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white text-xs h-8"
                    >
                      {confirmandoPedido ? "Registrando…" : "Confirmar pedido en Apex"}
                    </Button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] text-gray-500">WhatsApp (para el pedido)</label>
                  <Input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    onBlur={() => void syncTallerCuenta()}
                    placeholder="3001234567"
                    className="mt-1 h-8 text-xs bg-[oklch(0.12_0.04_250)] border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500">Municipio</label>
                  <Input
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                    placeholder="Chía"
                    className="mt-1 h-8 text-xs bg-[oklch(0.12_0.04_250)] border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500">Carro</label>
                  <Input
                    value={carro}
                    onChange={(e) => setCarro(e.target.value)}
                    placeholder="Chevrolet Sail"
                    className="mt-1 h-8 text-xs bg-[oklch(0.12_0.04_250)] border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500">Año</label>
                  <Input
                    value={ano}
                    onChange={(e) => setAno(e.target.value)}
                    placeholder="2018"
                    className="mt-1 h-8 text-xs bg-[oklch(0.12_0.04_250)] border-gray-700 text-white"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  placeholder="Referencia, pieza o síntoma…"
                  className="text-xs bg-[oklch(0.12_0.04_250)] border-gray-700 text-white"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                />
                <Button
                  onClick={() => void onSend()}
                  disabled={!composer.trim() || loading}
                  className="shrink-0 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="border-gray-600 text-gray-300 text-xs">
                  <a href={whatsappLink} target="_blank" rel="noreferrer">
                    WhatsApp humano →
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-600 text-gray-300 text-xs"
                  onClick={reset}
                  type="button"
                >
                  Reiniciar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
