import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, ShoppingCart, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CARRITO_AGREGADO_EVENT, type CarritoAgregadoPayload } from "@/lib/taller-carrito";

const DURACION_MS = 5500;

export default function CarritoAgregadoAviso() {
  const [aviso, setAviso] = useState<CarritoAgregadoPayload | null>(null);

  useEffect(() => {
    function onAgregado(e: Event) {
      const detalle = (e as CustomEvent<CarritoAgregadoPayload>).detail;
      if (!detalle?.referencia) return;
      setAviso(detalle);
    }
    window.addEventListener(CARRITO_AGREGADO_EVENT, onAgregado);
    return () => window.removeEventListener(CARRITO_AGREGADO_EVENT, onAgregado);
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), DURACION_MS);
    return () => window.clearTimeout(t);
  }, [aviso]);

  if (!aviso) return null;

  const unidadTxt =
    aviso.cantidadAgregada === 1 ? "1 unidad" : `${aviso.cantidadAgregada} unidades`;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-lg animate-in slide-in-from-bottom-4 duration-300"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-xl border border-emerald-500/50 bg-[oklch(0.14_0.04_250)] shadow-2xl shadow-black/50 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/30 text-emerald-300">
            <Check className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Agregado al pedido</p>
            <p className="text-xs font-mono text-[oklch(0.7_0.2_40)] mt-0.5">{aviso.referencia}</p>
            <p className="text-xs text-gray-300 mt-1 line-clamp-2">{aviso.nombre}</p>
            <p className="text-xs text-emerald-300 mt-1">
              {unidadTxt} · {aviso.cantidadEnCarrito} en carrito ({aviso.itemsEnCarrito} ref.
              {aviso.itemsEnCarrito === 1 ? "" : "s"} total)
            </p>
          </div>
          <button
            type="button"
            className="text-gray-500 hover:text-white p-1 shrink-0"
            aria-label="Cerrar aviso"
            onClick={() => setAviso(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <Button
          asChild
          size="sm"
          className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-10"
        >
          <Link to="/taller/pedido">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Ir al pedido y enviar
          </Link>
        </Button>
      </div>
    </div>
  );
}
