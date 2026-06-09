import { Link } from "@tanstack/react-router";
import { ShoppingCart, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTallerSession } from "@/components/TallerSessionProvider";
import { leerCarritoTaller } from "@/lib/taller-carrito";
import { useEffect, useState } from "react";

export default function TallerBanner() {
  const { taller, logout } = useTallerSession();
  const [itemsCarrito, setItemsCarrito] = useState(0);

  useEffect(() => {
    const sync = () => {
      const lineas = leerCarritoTaller();
      setItemsCarrito(lineas.reduce((n, l) => n + l.cantidad, 0));
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("apex-taller-carrito", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("apex-taller-carrito", sync);
    };
  }, [taller]);

  if (!taller) return null;

  return (
    <div className="mb-6 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-2">
        <Wrench className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-100">
            Modo taller · {taller.nombreTaller}
          </p>
          <p className="text-xs text-emerald-200/80 mt-0.5">
            Precio taller con {taller.descuentoPorcentaje}% de descuento sobre lista · stock y
            referencias desde la base de datos.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button
          asChild
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
        >
          <Link to="/taller/pedido">
            <ShoppingCart className="h-4 w-4 mr-1.5" />
            Pedido{itemsCarrito > 0 ? ` (${itemsCarrito})` : ""}
          </Link>
        </Button>
        <button
          type="button"
          onClick={logout}
          className="text-xs text-gray-400 hover:text-white px-2 py-1"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
