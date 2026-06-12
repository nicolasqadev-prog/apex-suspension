import { Link } from "@tanstack/react-router";
import { LogOut, ShoppingCart, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTallerSession } from "@/components/TallerSessionProvider";
import { leerCarritoTaller } from "@/lib/taller-carrito";
import { cn } from "@/lib/utils";
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

  const linkClass =
    "inline-flex items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-950/40 px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-900/50 hover:text-white transition-colors";

  return (
    <div className="mb-6 rounded-xl border border-emerald-500/35 bg-emerald-950/25 overflow-hidden">
      <div className="px-3 py-3 sm:px-4 sm:py-3.5 flex items-start gap-2.5 border-b border-emerald-500/15">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
          <Wrench className="h-4 w-4 text-emerald-400" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-50 leading-snug truncate">
            Modo taller · {taller.nombreTaller}
          </p>
          <p className="text-[11px] sm:text-xs text-emerald-200/75 mt-1 leading-relaxed">
            Precio especial taller · stock en bodega y referencias bajo pedido.
          </p>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-2 p-3 sm:p-3.5",
          "grid-cols-2 sm:grid-cols-[1fr_1fr_auto_auto]",
          "sm:items-center",
        )}
      >
        <Link to="/taller" className={cn(linkClass, "col-span-1")}>
          Mi panel
        </Link>
        <Link to="/taller/pedidos" className={cn(linkClass, "col-span-1")}>
          Mis pedidos
        </Link>
        <Button
          asChild
          size="sm"
          className={cn(
            "col-span-2 sm:col-span-1 h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm",
          )}
        >
          <Link to="/taller/pedido">
            <ShoppingCart className="h-4 w-4 mr-1.5 shrink-0" />
            Pedido{itemsCarrito > 0 ? ` (${itemsCarrito})` : ""}
          </Link>
        </Button>
        <button
          type="button"
          onClick={logout}
          className={cn(
            linkClass,
            "col-span-2 sm:col-span-1 border-transparent bg-transparent text-gray-400 hover:text-white hover:bg-white/5",
          )}
        >
          <LogOut className="h-3.5 w-3.5 mr-1.5 inline shrink-0" aria-hidden />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
