import { useCallback, useEffect, useState } from "react";
import { Minus, Package, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ajustarStockAdmin,
  buscarProductosInventarioAdmin,
} from "@/lib/admin-inventario.functions";
import type { ProductoAdmin } from "@/lib/inventario-admin.server";
import { formatoPrecioCop } from "@/lib/formato-cop";

export default function AdminInventarioPanel() {
  const [query, setQuery] = useState("");
  const [productos, setProductos] = useState<ProductoAdmin[]>([]);
  const [fuente, setFuente] = useState<"supabase" | "json">("supabase");
  const [aviso, setAviso] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [seleccionado, setSeleccionado] = useState<ProductoAdmin | null>(null);
  const [delta, setDelta] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  const buscar = useCallback(async () => {
    setLoading(true);
    setMensaje(null);
    try {
      const res = await buscarProductosInventarioAdmin({
        data: { query, limit: 30 },
      });
      if (!res.ok) {
        setMensaje(res.reason);
        setProductos([]);
        return;
      }
      setProductos(res.productos);
      setFuente(res.fuente);
      setAviso(res.fuente === "json" && "aviso" in res ? (res.aviso ?? null) : null);
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "Error al buscar");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void buscar();
    }, 300);
    return () => window.clearTimeout(t);
  }, [buscar]);

  async function onAjustar(e: React.FormEvent) {
    e.preventDefault();
    if (!seleccionado) return;
    if (fuente !== "supabase") {
      setMensaje("Los movimientos de stock solo funcionan con productos en Supabase.");
      return;
    }

    const d = Number(delta);
    if (!Number.isFinite(d) || d === 0) {
      setMensaje("Indica una cantidad distinta de cero (positiva entra, negativa sale).");
      return;
    }

    setGuardando(true);
    setMensaje(null);
    try {
      const res = await ajustarStockAdmin({
        data: {
          productoId: seleccionado.id,
          delta: Math.trunc(d),
          motivo: motivo.trim(),
        },
      });
      if (!res.ok) {
        setMensaje(res.reason);
        return;
      }
      setMensaje(`Stock actualizado: ${seleccionado.referencia} → ${res.stockActual} unidad(es).`);
      setDelta("");
      setMotivo("");
      setSeleccionado(null);
      void buscar();
    } finally {
      setGuardando(false);
    }
  }

  function atajoEntrada(cantidad: number) {
    setDelta(String(cantidad));
    setMotivo((m) => m || "Entrada de inventario");
  }

  function atajoSalida(cantidad: number) {
    setDelta(String(-cantidad));
    setMotivo((m) => m || "Salida de inventario");
  }

  return (
    <section className="rounded-xl border border-sky-500/30 bg-sky-950/15 p-5 mb-6">
      <div className="flex items-start gap-2 mb-4">
        <Package className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">Inventario y stock</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Por defecto muestra referencias con stock en bodega. Busca por referencia o nombre. Cada
            ajuste registra un movimiento en{" "}
            <code className="text-gray-300">stock_movimientos</code>.
          </p>
        </div>
      </div>

      {fuente === "json" && (
        <p className="text-xs text-amber-300/90 mb-4 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2">
          Sin Supabase en servidor: ves datos del JSON de ejemplo. Para ajustar stock en vivo,
          configura secretos y ejecuta{" "}
          <code className="text-amber-100">npm run sync:inventory</code>.{" "}
          {aviso && <span className="block mt-1 text-gray-400">{aviso}</span>}
        </p>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Referencia, nombre o slug…"
          className="pl-10 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
        />
      </div>

      <ul className="space-y-2 max-h-64 overflow-y-auto mb-4">
        {productos.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setSeleccionado(p)}
              className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                seleccionado?.id === p.id
                  ? "border-sky-500 bg-sky-950/40"
                  : "border-white/10 bg-black/20 hover:border-white/20"
              }`}
            >
              <div className="flex justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-sky-300">{p.referencia}</p>
                  <p className="font-semibold text-white">{p.nombre}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.marca} · {formatoPrecioCop(p.precioLista)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-lg font-bold ${
                      p.stockActual > 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {p.stockActual}
                  </p>
                  <p className="text-[10px] text-gray-500">en stock</p>
                </div>
              </div>
            </button>
          </li>
        ))}
        {!loading && productos.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-6">Sin resultados.</p>
        )}
        {loading && <p className="text-xs text-gray-500 text-center py-6">Buscando…</p>}
      </ul>

      {seleccionado && (
        <form
          onSubmit={onAjustar}
          className="rounded-lg border border-sky-600/40 bg-black/30 p-4 space-y-3"
        >
          <p className="text-xs font-semibold text-sky-200">
            Ajustar: {seleccionado.referencia} (stock actual {seleccionado.stockActual})
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-emerald-700 text-emerald-200 h-8"
              onClick={() => atajoEntrada(1)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              +1
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-emerald-700 text-emerald-200 h-8"
              onClick={() => atajoEntrada(5)}
            >
              +5
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-red-800 text-red-300 h-8"
              onClick={() => atajoSalida(1)}
            >
              <Minus className="h-3.5 w-3.5 mr-1" />
              −1
            </Button>
          </div>
          <label className="text-xs text-gray-400 block">
            Cantidad (+ entra / − sale)
            <Input
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
              required
            />
          </label>
          <label className="text-xs text-gray-400 block">
            Motivo
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej. Compra proveedor, conteo bodega, venta"
              className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
              required
            />
          </label>
          <Button
            type="submit"
            disabled={guardando || fuente !== "supabase"}
            className="bg-sky-600 hover:bg-sky-500 text-white w-full sm:w-auto"
          >
            {guardando ? "Guardando…" : "Registrar movimiento"}
          </Button>
        </form>
      )}

      {mensaje && (
        <p className="mt-4 text-xs text-gray-300 leading-relaxed" role="status">
          {mensaje}
        </p>
      )}
    </section>
  );
}
