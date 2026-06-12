import { Package } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  nombre: string;
  imagenUrl?: string;
  className?: string;
  compact?: boolean;
};

/**
 * Foto de referencia del proveedor (solo KTC/DMB en bodega).
 * Sin imagen: no altera el layout (retorna null).
 */
export default function PiezaCatalogoImagen({
  nombre,
  imagenUrl,
  className,
  compact = false,
}: Props) {
  if (!imagenUrl) return null;

  return (
    <div
      className={cn(
        "rounded-md border border-white/10 bg-white/[0.04] overflow-hidden shrink-0",
        compact ? "h-16 w-16" : "aspect-[4/3] w-full max-h-40",
        className,
      )}
    >
      <img
        src={imagenUrl}
        alt={`Referencia ${nombre}`}
        className="h-full w-full object-contain p-1.5"
        loading="lazy"
        decoding="async"
        onError={(e) => {
          e.currentTarget.style.display = "none";
          e.currentTarget.parentElement?.classList.add("hidden");
        }}
      />
    </div>
  );
}

/** Placeholder opcional en detalle cuando aún no hay foto (no usar en tarjetas de catálogo). */
export function PiezaCatalogoSinImagen({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md border border-dashed border-white/10 bg-white/[0.02] flex items-center justify-center aspect-[4/3] max-h-40",
        className,
      )}
    >
      <Package className="h-8 w-8 text-gray-600" aria-hidden />
    </div>
  );
}
