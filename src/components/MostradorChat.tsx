import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePersistentState } from "@/lib/usePersistentState";
import { responderMostrador } from "@/lib/mostrador.functions";
import { buildWhatsappHandoffLink, normalizeShortText, type MostradorDraft } from "@/lib/mostrador";
import { consultarTallerFidelizado } from "@/lib/talleres.functions";

type ChatMsg = { role: "user" | "assistant"; content: string };

function initialAssistantMessage() {
  return [
    "Le orientamos para una cotización (no es diagnóstico mecánico).",
    "Confirme el diagnóstico con su taller de confianza.",
    "Indique la pieza o el síntoma y, si lo sabe, el vehículo y el año.",
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
  window.setTimeout(run, 240);
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

  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "assistant", content: initialAssistantMessage() },
  ]);
  const [turns, setTurns] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastQuestions, setLastQuestions] = useState<string[]>([]);
  const [handoffTag, setHandoffTag] = useState<"normal" | "bajo_encargo">("normal");
  const [primarySuggestion, setPrimarySuggestion] = useState("");
  const [handoffReady, setHandoffReady] = useState(false);
  const [tallerCuenta, setTallerCuenta] = useState<
    MostradorDraft["tallerCuenta"] | undefined
  >(undefined);

  const draft: MostradorDraft = useMemo(
    () => ({
      piezaOSintoma,
      whatsapp,
      carro,
      ano,
      version,
      municipio,
      handoffTag,
      primarySuggestion: primarySuggestion.trim() || undefined,
      tallerCuenta,
    }),
    [piezaOSintoma, whatsapp, carro, ano, version, municipio, handoffTag, primarySuggestion, tallerCuenta],
  );

  const whatsappLink = useMemo(() => buildWhatsappHandoffLink(draft), [draft]);

  const canAskMore = turns < 2;
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

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
  }, [open, msgs.length, loading, lastQuestions.length]);

  function enrichAssistantReply(raw: string, suggestion?: string) {
    let out = raw.trim();
    const sug = suggestion?.trim();
    if (sug && !out.toLowerCase().includes("para cotizar primero")) {
      out += `\n\nPara cotizar primero (orientación, no diagnóstico): ${sug}. Confirme el diagnóstico con su taller de confianza.`;
    }
    return out;
  }

  async function onSend() {
    const text = normalizeShortText(composer, 280);
    if (!text || loading) return;

    const nextTurn = turns + 1;

    const brakeLike = /\b(freno|frenos|frena|pastilla|pastillas|disco|discos|caliper|balata)\b/i.test(
      text,
    );

    setMsgs((m) => [...m, { role: "user", content: text }]);
    setTurns(nextTurn);
    setLoading(true);
    setLastQuestions([]);
    setComposer("");
    if (!piezaOSintoma.trim()) setPiezaOSintoma(text);

    try {
      if (brakeLike) {
        if (whatsapp.replace(/\D/g, "").length >= 10) {
          try {
            const t = await consultarTallerFidelizado({ data: { whatsapp: whatsapp.trim() } });
            if (t.validado) {
              setTallerCuenta({
                validado: true,
                contraEntregaHabilitada: t.contraEntregaHabilitada,
              });
            } else {
              setTallerCuenta({ validado: false });
            }
          } catch {
            setTallerCuenta(undefined);
          }
        } else {
          setTallerCuenta(undefined);
        }
        setHandoffTag("bajo_encargo");
        setPrimarySuggestion("Pastillas y discos de freno (lado delantero o trasero, a confirmar con el taller)");
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            content: enrichAssistantReply(
              "Por lo que indica, podría estar relacionado con frenos (pastillas o discos) o con un caliper. Posibles piezas a revisar: pastillas, discos, caliper, sensor ABS. Podemos cotizarlo bajo encargo con proveedor.",
              "Pastillas y discos de freno (lado delantero o trasero, a confirmar con el taller)",
            ),
          },
        ]);
        const qs =
          nextTurn < 2
            ? [
                "¿El ruido ocurre solo al frenar o también al circular?",
                "¿Delantera o trasera?",
                "¿Dispone de referencia o marca de pastillas o discos actuales?",
              ]
            : [];
        setLastQuestions(qs);
        return;
      }

      const history = [...msgs, { role: "user" as const, content: text }].slice(-10);
      const res = await responderMostrador({
        data: {
          history,
          context: {
            whatsapp: whatsapp.trim() || undefined,
            carro: carro.trim() || undefined,
            ano: ano.trim() || undefined,
            version: version.trim() || undefined,
            municipio: municipio.trim() || undefined,
          },
        },
      });

      const sug = typeof res?.primarySuggestion === "string" ? res.primarySuggestion.trim() : "";
      setPrimarySuggestion(sug);
      if (res?.tallerCuenta) {
        setTallerCuenta(res.tallerCuenta);
      } else {
        setTallerCuenta(undefined);
      }
      let reply =
        res?.reply?.trim() ||
        "Puede escribirnos por WhatsApp para confirmar la referencia y la disponibilidad.";
      reply = enrichAssistantReply(reply, sug || undefined);

      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
      const qs = Array.isArray(res?.questions) ? res.questions : [];
      const filtered = qs.filter((q) => {
        const qq = q.toLowerCase();
        if (carro.trim() && qq.includes("carro")) return false;
        if (ano.trim() && (qq.includes("año") || qq.includes("ano"))) return false;
        if (version.trim() && qq.includes("versión")) return false;
        if (municipio.trim() && qq.includes("municipio")) return false;
        return true;
      });
      setLastQuestions(nextTurn < 2 ? filtered : []);
      setHandoffTag(res?.handoffTag === "bajo_encargo" ? "bajo_encargo" : "normal");
      const ready =
        nextTurn >= 2 || res?.action === "handoff_whatsapp" || res?.handoffTag === "bajo_encargo";
      setHandoffReady(ready);
    } catch {
      setTallerCuenta(undefined);
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Puede continuar por WhatsApp: indique vehículo, año y síntoma, y si puede envíe foto o video. Confirme el diagnóstico con su taller de confianza.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMsgs([{ role: "assistant", content: initialAssistantMessage() }]);
    setTurns(0);
    setLastQuestions([]);
    setPiezaOSintoma("");
    setMunicipio("");
    setComposer("");
    setHandoffTag("normal");
    setPrimarySuggestion("");
    setHandoffReady(false);
    setTallerCuenta(undefined);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[oklch(0.7_0.2_40)] px-4 py-3 text-sm font-bold text-white shadow-lg hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400"
        aria-label="Abrir orientación para cotización"
      >
        <MessageCircle className="h-5 w-5" />
        Orientación al cotizar
      </button>

      <Dialog open={open} onOpenChange={(v) => (setOpen(v), v ? null : null)}>
        <DialogContent className="bg-[oklch(0.18_0.04_250)] border border-white/10 text-gray-200 p-0 overflow-hidden max-w-[680px] w-[min(680px,calc(100vw-24px))] max-h-[min(90dvh,720px)] h-[min(90dvh,720px)] flex flex-col gap-0 sm:rounded-lg [&>button]:hidden">
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-white/10 shrink-0">
            <DialogHeader className="space-y-0 text-left pr-2">
              <DialogTitle className="text-white text-base font-bold">Mostrador Apex</DialogTitle>
              <p className="text-xs text-gray-400 mt-1">
                Orientación para cotizar. No constituye diagnóstico. La confirmación final es por
                WhatsApp.
              </p>
            </DialogHeader>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 text-gray-300 hover:text-white hover:border-white/20"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div
              ref={messagesScrollRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pt-3 pb-2 scroll-smooth"
              aria-live="polite"
              aria-relevant="additions text"
            >
              <div className="space-y-3">
                {msgs.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[min(100%,520px)] min-w-0 rounded-2xl px-4 py-3 text-[13px] sm:text-sm leading-snug ${
                        m.role === "user"
                          ? "bg-[oklch(0.7_0.2_40)] text-white"
                          : "bg-black/25 border border-white/10 text-gray-200"
                      }`}
                    >
                      <span className="whitespace-pre-wrap break-words">{m.content}</span>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="text-xs text-gray-500" aria-busy="true">
                    Generando respuesta…
                  </div>
                )}
              </div>

              {lastQuestions.length > 0 && canAskMore && (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs font-semibold text-white">Para afinar la cotización</p>
                  <ul className="mt-2 space-y-1 text-xs text-gray-400">
                    {lastQuestions.slice(0, 3).map((q) => (
                      <li key={q}>- {q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 bg-[oklch(0.14_0.04_250)] px-5 py-3 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] text-gray-500">WhatsApp de contacto</label>
                  <Input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="3001234567"
                    className="mt-1 bg-[oklch(0.12_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500">Municipio (opcional)</label>
                  <Input
                    value={municipio}
                    onChange={(e) => setMunicipio(e.target.value)}
                    placeholder="Ej.: Chía"
                    className="mt-1 bg-[oklch(0.12_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500">Vehículo (opcional)</label>
                  <Input
                    value={carro}
                    onChange={(e) => setCarro(e.target.value)}
                    placeholder="Ej.: Chevrolet Sail"
                    className="mt-1 bg-[oklch(0.12_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-500">Año (opcional)</label>
                    <Input
                      value={ano}
                      onChange={(e) => setAno(e.target.value)}
                      placeholder="2018"
                      className="mt-1 bg-[oklch(0.12_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500">Versión (opcional)</label>
                    <Input
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="LS / LT"
                      className="mt-1 bg-[oklch(0.12_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-gray-500">Pieza o síntoma (obligatorio)</label>
                <div className="mt-1 flex gap-2">
                  <Input
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    placeholder="Ej.: ruido al girar, rótula delantera, referencia…"
                    className="bg-[oklch(0.12_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
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
                    className="shrink-0 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-semibold"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-gray-500">
                  Para compatibilidad, conviene enviar por WhatsApp foto de la pieza usada o video
                  del síntoma (placa opcional).
                </p>
              </div>

              {handoffReady && (
                <div className="rounded-xl border border-[oklch(0.7_0.2_40)]/40 bg-black/30 px-4 py-3">
                  <p className="text-xs font-semibold text-white">Siguiente paso: cotizar por WhatsApp</p>
                  <p className="mt-2 text-xs text-gray-300 leading-relaxed">
                    Con esto concluye la orientación automática. Use el botón naranja para enviar
                    síntoma, datos del vehículo y contacto al equipo Apex; allí confirman referencia
                    y precio.
                  </p>
                  {primarySuggestion.trim() ? (
                    <p className="mt-2 text-xs text-gray-200">
                      <span className="font-semibold text-[oklch(0.7_0.2_40)]">
                        Pieza prioritaria para cotizar
                      </span>{" "}
                      (orientación, no diagnóstico): {primarySuggestion.trim()}
                    </p>
                  ) : null}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  className="bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-semibold"
                >
                  <a href={whatsappLink} target="_blank" rel="noreferrer">
                    Confirmar por WhatsApp →
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-700 text-gray-300"
                  onClick={reset}
                  type="button"
                >
                  Reiniciar
                </Button>
              </div>

              {!canAskMore && !handoffReady && (
                <div className="text-[11px] text-gray-500">
                  Para seguir de forma ordenada, la cotización se confirma con el equipo por
                  WhatsApp.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
