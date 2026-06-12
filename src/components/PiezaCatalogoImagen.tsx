import { useState } from "react";
import { Maximize2, Package, X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
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
        className={cn("block w-full text-left cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.7_0.2_40)] rounded-xl", className)}
        onClick={() => setAbierta(true)}
        aria-label={`Ver imagen completa de ${nombre}`}
      >
        {frame}
      </button>

      <Dialog open={abierta} onOpenChange={setAbierta}>
        <DialogContent className="max-w-[min(96vw,42rem)] border-gray-700 bg-[oklch(0.12_0.04_250)] p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">
            {referencia ? `${referencia} — ${nombre}` : nombre}
          </DialogTitle>
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              {referencia && (
                <p className="text-xs font-mono text-[oklch(0.7_0.2_40)] truncate">{referencia}</p>
              )}
              <p className="text-sm font-semibold text-white truncate">{nombre}</p>
            </div>
            <DialogClose className="shrink-0 rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
              <span className="sr-only">Cerrar</span>
            </DialogClose>
          </div>
          <div className="bg-white p-4 sm:p-6 max-h-[min(78vh,640px)] flex items-center justify-center">
            <img
              src={imagenUrl}
              alt={nombre}
              className="max-h-[min(72vh,580px)] w-full object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
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
