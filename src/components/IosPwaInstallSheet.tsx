import { useEffect, useState } from "react";
import { ArrowDown, Check, Copy, PlusSquare, Share, Smartphone, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { copiarEnlaceActual, iosInstallMode } from "@/lib/pwa-engagement";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function Paso({
  n,
  titulo,
  detalle,
  icon,
}: {
  n: number;
  titulo: string;
  detalle: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[oklch(0.7_0.2_40)] text-sm font-bold text-white">
        {n}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          {icon}
          {titulo}
        </p>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{detalle}</p>
      </div>
    </li>
  );
}

function pasosSafari() {
  return (
    <ol className="space-y-2">
      <Paso
        n={1}
        icon={<Share className="h-4 w-4 text-[oklch(0.7_0.2_40)]" />}
        titulo="Toca Compartir"
        detalle="Botón cuadrado con flecha hacia arriba, abajo en el centro de Safari."
      />
      <Paso
        n={2}
        icon={<PlusSquare className="h-4 w-4 text-[oklch(0.7_0.2_40)]" />}
        titulo="Agregar a inicio"
        detalle="Desliza el menú y elige «Agregar a inicio» o «Añadir a pantalla de inicio»."
      />
      <Paso
        n={3}
        icon={<Check className="h-4 w-4 text-emerald-400" />}
        titulo="Confirma Agregar"
        detalle="Verás el icono de Apex en tu pantalla de inicio. Ábrelo desde ahí."
      />
    </ol>
  );
}

function pasosInApp() {
  return (
    <ol className="space-y-2">
      <li className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-3 py-2.5 text-xs text-amber-100 leading-relaxed">
        Estás dentro de WhatsApp u otra app. Desde ahí <strong>no aparece</strong> «Agregar a
        inicio». Primero abre Apex en Safari.
      </li>
      <Paso
        n={1}
        icon={<Share className="h-4 w-4 text-[oklch(0.7_0.2_40)]" />}
        titulo="Abrir en Safari"
        detalle="Toca ⋯ o Compartir y elige «Abrir en Safari». O copia el enlace abajo y pégalo en Safari."
      />
      <Paso
        n={2}
        icon={<Share className="h-4 w-4 text-[oklch(0.7_0.2_40)]" />}
        titulo="Compartir en Safari"
        detalle="En Safari, toca Compartir (abajo al centro)."
      />
      <Paso
        n={3}
        icon={<PlusSquare className="h-4 w-4 text-[oklch(0.7_0.2_40)]" />}
        titulo="Agregar a inicio"
        detalle="Elige la opción y confirma con Agregar."
      />
    </ol>
  );
}

function SafariBottomHint({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[250] pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-hidden
    >
      <div className="mx-auto max-w-lg px-4 pb-2">
        <div className="flex flex-col items-center gap-1 animate-bounce">
          <ArrowDown className="h-6 w-6 text-[oklch(0.7_0.2_40)] drop-shadow-lg" />
          <p className="rounded-full bg-[oklch(0.7_0.2_40)] px-4 py-1.5 text-xs font-bold text-white shadow-lg text-center">
            El botón Compartir está aquí abajo
          </p>
        </div>
      </div>
      <div className="h-14 bg-gradient-to-t from-[oklch(0.7_0.2_40)]/25 to-transparent" />
    </div>
  );
}

export default function IosPwaInstallSheet({ open, onOpenChange }: Props) {
  const mode = iosInstallMode() ?? "safari";
  const [copiado, setCopiado] = useState(false);
  const mostrarHintSafari = open && mode === "safari";

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function onCopiar() {
    const ok = await copiarEnlaceActual();
    setCopiado(ok);
    if (ok) window.setTimeout(() => setCopiado(false), 3000);
  }

  if (!open) return null;

  return (
    <>
      <SafariBottomHint visible={mostrarHintSafari} />
      <div
        className="fixed inset-0 z-[240] flex flex-col bg-[oklch(0.12_0.04_250)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-install-title"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "max(5rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2 shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-[oklch(0.7_0.2_40)] font-bold">
              iPhone · 3 pasos
            </p>
            <h2 id="ios-install-title" className="text-lg font-bold text-white mt-1">
              Instalar Apex en tu pantalla de inicio
            </h2>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              En iPhone no hay botón automático como en Android. Apple pide estos 3 toques en Safari
              — tarda menos de 10 segundos.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar guía"
            className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-white/10 hover:text-white"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-3 py-2.5 flex gap-2">
            <Smartphone className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-100/90 leading-relaxed">
              Desde la app instalada recibes avisos de pedido al instante. En una pestaña de Safari
              no funcionan las notificaciones.
            </p>
          </div>

          {mode === "in-app" ? pasosInApp() : pasosSafari()}

          {mode === "in-app" && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-gray-600 text-gray-200 h-11"
              onClick={() => void onCopiar()}
            >
              {copiado ? (
                "✓ Enlace copiado — ábrelo en Safari"
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1.5" />
                  Copiar enlace para Safari
                </>
              )}
            </Button>
          )}
        </div>

        <div
          className="shrink-0 px-4 pt-2 border-t border-white/10 bg-[oklch(0.1_0.04_250)]"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {mode === "safari" && (
            <p className="text-[11px] text-center text-gray-500 mb-2">
              Cierra esta guía y busca el botón <strong className="text-gray-300">Compartir</strong>{" "}
              abajo en Safari
            </p>
          )}
          <Button
            type="button"
            className="w-full h-11 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-semibold"
            onClick={() => onOpenChange(false)}
          >
            {mode === "safari" ? "Entendido — voy a Compartir" : "Entendido"}
          </Button>
        </div>
      </div>
    </>
  );
}

/** Abre la guía iOS (evento global). */
export function openIosInstallGuide() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("apex-pwa-open-ios-guide"));
}
