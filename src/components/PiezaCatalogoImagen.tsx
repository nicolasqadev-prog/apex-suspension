import { useEffect, useState } from "react";
import { Maximize2, Package, X } from "lucide-react";

import { cn } from "@/lib/utils";

type Variant = "compact" | "card" | "hero";

type Props = {
  nombre: string;
  referencia?: string;
  imagenUrl?: string;
  className?: string;
  /** compact = miniatura catálogo · card = tarjeta · hero = detalle producto */
  variant?: Variant;
  /** Permite abrir imagen a pantalla casi completa (detalle). */
  expandible?: boolean;
};

/**
 * Foto de referencia del proveedor (solo KTC/DMB en bodega).
 * Sin imagen: no altera el layout (retorna null).
 */
export default function PiezaCatalogoImagen({
  nombre,
  referencia,
  imagenUrl,
  className,
  variant = "hero",
  expandible,
}: Props) {
  const [abierta, setAbierta] = useState(false);
  const puedeExpandir = expandible ?? variant === "hero";

  useEffect(() => {
    if (!abierta) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [abierta]);

  if (!imagenUrl) return null;

  const frame = (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/10 bg-white shadow-sm",
        variant === "compact" && "h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20",
        variant === "card" && "aspect-[5/4] w-full max-h-44 sm:max-h-48",
        variant === "hero" &&
          "aspect-[4/3] w-full min-h-[12rem] sm:min-h-[16rem] md:min-h-[18rem] max-h-[min(70vh,22rem)] md:max-h-[24rem]",
        className,
      )}
    >
      <img
        src={imagenUrl}
        alt={referencia ? `${referencia} · ${nombre}` : nombre}
        className="h-full w-full object-contain p-2 sm:p-3"
        loading="lazy"
        decoding="async"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          e.currentTarget.parentElement?.classList.add("hidden");
        }}
      />
      {puedeExpandir && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/55 to-transparent px-2 py-2 text-[10px] font-medium text-white/90 sm:text-xs">
          <Maximize2 className="h-3 w-3 shrink-0" aria-hidden />
          Toca para ver completa
        </span>
      )}
    </div>
  );

  if (!puedeExpandir) {
    return frame;
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          "block w-full text-left cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.7_0.2_40)] rounded-xl",
          className,
        )}
        onClick={() => setAbierta(true)}
        aria-label={`Ver imagen completa de ${nombre}`}
      >
        {frame}
      </button>

      {abierta ? (
        <div
          className="fixed inset-0 z-[110] flex flex-col bg-[oklch(0.08_0.04_250)]"
          role="dialog"
          aria-modal="true"
          aria-label={referencia ? `${referencia} — ${nombre}` : nombre}
          data-apex-lightbox-open
        >
          <div
            className="shrink-0 flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 bg-[oklch(0.12_0.04_250)]"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
          >
            <div className="min-w-0 flex-1 pr-2">
              {referencia ? (
                <p className="text-xs font-mono text-[oklch(0.7_0.2_40)]">{referencia}</p>
              ) : null}
              <p className="text-sm font-semibold text-white leading-snug line-clamp-3">{nombre}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg p-2.5 text-gray-300 hover:bg-white/10 hover:text-white"
              onClick={() => setAbierta(false)}
              aria-label="Cerrar imagen"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            className="flex-1 min-h-0 flex items-center justify-center bg-white p-4 sm:p-8 touch-manipulation"
            onClick={() => setAbierta(false)}
            aria-label="Cerrar imagen"
          >
            <img
              src={imagenUrl}
              alt={nombre}
              className="block max-h-[calc(100dvh-7rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-[min(100%,42rem)] w-auto h-auto object-contain"
              draggable={false}
            />
          </button>

          <p
            className="shrink-0 text-center text-[11px] text-gray-500 py-2"
            style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
          >
            Toca fuera de la pieza o ✕ para cerrar
          </p>
        </div>
      ) : null}
    </>
  );
}

/** Placeholder opcional en detalle cuando aún no hay foto. */
export function PiezaCatalogoSinImagen({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-white/10 bg-white/[0.02] flex items-center justify-center aspect-[4/3] max-h-40",
        className,
      )}
    >
      <Package className="h-8 w-8 text-gray-600" aria-hidden />
    </div>
  );
}
