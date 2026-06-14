import { useCallback, useEffect, useState } from "react";
import { Database } from "lucide-react";

import { resumenCatalogoAdmin } from "@/lib/admin-inventario.functions";

export default function AdminCatalogoStatus() {
  const [loading, setLoading] = useState(true);
  const [fuente, setFuente] = useState<"supabase" | "json" | null>(null);
  const [total, setTotal] = useState(0);
  const [conStock, setConStock] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await resumenCatalogoAdmin({ data: {} });
      if (res.ok) {
        setFuente(res.resumen.fuente);
        setTotal(res.resumen.totalProductos);
        setConStock(res.resumen.conStock);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading && fuente === null) {
    return (
      <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
        <Database className="h-3.5 w-3.5" />
        Catálogo…
      </p>
    );
  }

  if (fuente === "supabase") {
    return (
      <div className="text-[11px] text-emerald-400/90 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 max-w-full">
        <Database className="h-3.5 w-3.5 shrink-0" />
        <span className="break-words">
          Catálogo: {total} refs · {conStock} con stock
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="text-gray-500 hover:text-gray-300 underline shrink-0 disabled:opacity-50"
        >
          {loading ? "…" : "actualizar"}
        </button>
      </div>
    );
  }

  return (
    <p className="text-[11px] text-amber-400/90 flex items-center gap-1.5">
      <Database className="h-3.5 w-3.5 shrink-0" />
      Catálogo desde JSON local ({total} refs) — configura Supabase para stock en vivo
    </p>
  );
}
