import { useEffect, useState } from "react";
import { AlertTriangle, PackageX } from "lucide-react";

import { listarAlertasStockAdmin } from "@/lib/admin-inventario.functions";
import type { ProductoAdmin } from "@/lib/inventario-admin.server";

type Props = {
  refreshKey?: number;
};

export default function AdminStockAlertas({ refreshKey = 0 }: Props) {
  const [productos, setProductos] = useState<ProductoAdmin[]>([]);
  const [umbral, setUmbral] = useState(2);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listarAlertasStockAdmin({ data: {} })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.reason);
          setProductos([]);
          return;
        }
        setError(null);
        setProductos(res.productos);
        setUmbral(res.umbral);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar alertas de stock");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (error || productos.length === 0) return null;

  const agotados = productos.filter((p) => p.stockActual <= 0);
  const bajos = productos.filter((p) => p.stockActual > 0);

  return (
    <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-100">
            Alerta de inventario ({productos.length} referencia
            {productos.length === 1 ? "" : "s"})
          </p>
          <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
            Bodega KTC/DMB con {umbral} unidades o menos. Solo el stock físico que mueves; Districamiones
            no aparece aquí. Los pedidos del portal descontaron bodega automáticamente.
          </p>
          <ul className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
            {agotados.map((p) => (
              <li key={p.id} className="text-xs text-red-200/90 flex items-center gap-1.5">
                <PackageX className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono text-amber-300">{p.referencia}</span>
                <span className="text-red-300 font-semibold">Agotado</span>
              </li>
            ))}
            {bajos.map((p) => (
              <li key={p.id} className="text-xs text-amber-100/90">
                <span className="font-mono text-amber-300">{p.referencia}</span>
                <span className="text-gray-400"> · </span>
                Quedan <strong>{p.stockActual}</strong> u.
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
