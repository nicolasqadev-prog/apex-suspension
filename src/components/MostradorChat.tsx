import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePersistentState } from "@/lib/usePersistentState";
import { responderMostrador } from "@/lib/mostrador.functions";
import { buildWhatsappHandoffLink, normalizeShortText, type MostradorDraft } from "@/lib/mostrador";

type ChatMsg = { role: "user" | "assistant"; content: string };

function initialAssistantMessage() {
  return [
    "Te orientamos para cotizar (sin diagnosticar).",
    "Confirma el diagnóstico con tu mecánico de confianza.",
    "Cuéntame la pieza o el síntoma y, si lo sabes, el carro y el año.",
  ].join(" ");
}

export default function MostradorChat() {
  const [open, setOpen] = useState(false);
  const [whatsapp, setWhatsapp] = usePersistentState("apex.whatsapp", "");
  const [carro, setCarro] = usePersistentState("apex.carro", "");
  const [ano, setAno] = usePersistentState("apex.ano", "");
  const [version, setVersion] = usePersistentState("apex.version", "");

  const [piezaOSintoma, setPiezaOSintoma] = useState(""); // guardado para el resumen/handoff
  const [composer, setComposer] = useState(""); // texto que el cliente escribe (se limpia al enviar)
  const [municipio, setMunicipio] = useState("");

  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "assistant", content: initialAssistantMessage() },
  ]);
  const [turns, setTurns] = useState(0); // user turns
  const [loading, setLoading] = useState(false);
  const [lastQuestions, setLastQuestions] = useState<string[]>([]);
  const [handoffTag, setHandoffTag] = useState<"normal" | "bajo_encargo">("normal");

  const draft: MostradorDraft = useMemo(
    () => ({
      piezaOSintoma,
      whatsapp,
      carro,
      ano,
      version,
      municipio,
      handoffTag,
    }),
    [piezaOSintoma, whatsapp, carro, ano, version, municipio, handoffTag],
  );

  const whatsappLink = useMemo(() => buildWhatsappHandoffLink(draft), [draft]);

  const canAskMore = turns < 2; // máximo 2 turnos
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("apex:mostrador:open", onOpen);
    return () => window.removeEventListener("apex:mostrador:open", onOpen);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Keep latest messages visible.
    el.scrollTop = el.scrollHeight;
  }, [msgs.length, loading, open]);

  async function onSend() {
    const text = normalizeShortText(composer, 280);
    if (!text || loading) return;

    // Heurística rápida para evitar respuestas tontas en casos obvios (frenos = bajo encargo).
    const brakeLike = /\b(freno|frenos|frena|pastilla|pastillas|disco|discos|caliper|balata)\b/i.test(
      text,
    );

    setMsgs((m) => [...m, { role: "user", content: text }]);
    setTurns((t) => t + 1);
    setLoading(true);
    setLastQuestions([]);
    setComposer("");
    if (!piezaOSintoma.trim()) setPiezaOSintoma(text);

    try {
      if (brakeLike) {
        setHandoffTag("bajo_encargo");
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            content:
              "Por lo que describes, podría estar relacionado con frenos (pastillas/discos) o con un caliper agarrado. Confirma el diagnóstico con tu mecánico de confianza. Si quieres, te lo cotizamos bajo encargo con proveedor.",
          },
        ]);
        const qs = [
          "¿El ruido es solo al frenar o también rodando?",
          "¿Delantera o trasera?",
          "¿Tienes referencia/marca de pastillas o discos?",
        ];
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

      const reply = res?.reply?.trim() || "Listo. Escríbenos por WhatsApp para confirmar la referencia.";
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
      setLastQuestions(filtered);
      setHandoffTag(res?.handoffTag === "bajo_encargo" ? "bajo_encargo" : "normal");
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Listo, te orientamos para cotizar. Confirma el diagnóstico con tu mecánico. Para confirmar compatibilidad, lo mejor es que nos escribas por WhatsApp con carro/año y foto o video.",
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
        Te orientamos
      </button>

      <Dialog open={open} onOpenChange={(v) => (setOpen(v), v ? null : null)}>
        <DialogContent className="bg-[oklch(0.18_0.04_250)] border border-white/10 text-gray-200 p-0 overflow-hidden max-w-[680px] w-[min(680px,calc(100vw-24px))] max-h-[85vh] h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
            <DialogHeader className="space-y-0 text-left">
              <DialogTitle className="text-white text-base font-bold">Mostrador Apex</DialogTitle>
              <p className="text-xs text-gray-400 mt-1">
                Orientación para cotizar. Sin diagnóstico. Confirmación final por WhatsApp.
              </p>
            </DialogHeader>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-gray-300 hover:text-white hover:border-white/20"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-4 flex-1 min-h-0 flex flex-col">
            <div
              ref={scrollRef}
              className="space-y-3 flex-1 min-h-0 overflow-y-auto overscroll-contain px-1 py-2 pr-3"
            >
              {msgs.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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
                <div className="text-xs text-gray-500">Escribiendo…</div>
              )}
            </div>

            {lastQuestions.length > 0 && canAskMore && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 shrink-0">
                <p className="text-xs font-semibold text-white">Para afinar la cotización</p>
                <ul className="mt-2 space-y-1 text-xs text-gray-400">
                  {lastQuestions.slice(0, 3).map((q) => (
                    <li key={q}>- {q}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
              <div>
                <label className="text-[11px] text-gray-500">Tu WhatsApp</label>
                <Input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="3001234567"
                  className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500">Municipio (opcional)</label>
                <Input
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  placeholder="Ej: Chía"
                  className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500">Carro (opcional)</label>
                <Input
                  value={carro}
                  onChange={(e) => setCarro(e.target.value)}
                  placeholder="Ej: Chevrolet Sail"
                  className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-gray-500">Año (opcional)</label>
                  <Input
                    value={ano}
                    onChange={(e) => setAno(e.target.value)}
                    placeholder="2018"
                    className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-gray-500">Versión (opcional)</label>
                  <Input
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="LS / LT"
                    className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 shrink-0">
              <label className="text-[11px] text-gray-500">Pieza o síntoma (requerido)</label>
              <div className="mt-1 flex gap-2">
                <Input
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  placeholder="Ej: ruido al girar / rótula delantera Sail 2018"
                  className="bg-[oklch(0.14_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
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
                  className="bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-semibold"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                Para confirmar compatibilidad, lo más seguro es enviar foto de la pieza vieja o video
                del ruido por WhatsApp (placa opcional).
              </p>
            </div>

            <div className="mt-5 flex flex-col sm:flex-row gap-3 shrink-0">
              <Button asChild className="bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-semibold">
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

            {!canAskMore && (
              <div className="mt-4 text-[11px] text-gray-500 shrink-0">
                Para evitar vueltas, aquí cerramos la orientación y confirmamos por WhatsApp con el
                equipo.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

