import { useCallback, useEffect, useState } from "react";
import { Calendar, Download, History, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buscarPedidosHistorialAdmin } from "@/lib/admin-pedidos-historial.functions";
import { formatoPrecioCop } from "@/lib/formato-cop";
import { etiquetaEstadoTaller, refPedidoCorta } from "@/lib/pedidos-estado-taller";
import { fechaCalendarioBogota, restarDiasCalendarioBogota } from "@/lib/fecha-bogota";

type Props = {
  modoPreparacion: boolean;
};

type PedidoHistorial = {
  id: string;
  estado: string;
  taller_nombre: string;
  telefono: string;
  direccion: string | null;
  notas: string | null;
  created_at: string;
  es_prueba?: boolean;
  lineas: {
    cantidad: number;
    precio_unitario: number;
    productos: { referencia: string; nombre: string } | null;
  }[];
  totalCop: number;
};

function formatearFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function descargarCsv(nombre: string, filas: string[][]) {
  const bom = "\uFEFF";
  const cuerpo = filas
    .map((fila) => fila.map((celda) => `"${String(celda).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([bom + cuerpo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function pedidosACsv(pedidos: PedidoHistorial[]): string[][] {
  const header = [
    "Fecha",
    "Pedido",
    "Taller",
    "WhatsApp",
    "Estado",
    "Dirección",
    "Referencia",
    "Producto",
    "Cantidad",
    "Precio unitario COP",
    "Subtotal COP",
    "Total pedido COP",
  ];
  const filas: string[][] = [header];

  for (const p of pedidos) {
    const base = [
      formatearFechaHora(p.created_at),
      `#${refPedidoCorta(p.id)}`,
      p.taller_nombre,
      p.telefono,
      etiquetaEstadoTaller(p.estado),
      p.direccion ?? "",
    ];
    if (p.lineas.length === 0) {
      filas.push([...base, "", "", "", "", "", String(p.totalCop || "")]);
      continue;
    }
    for (const l of p.lineas) {
      const sub = l.cantidad * Number(l.precio_unitario);
      filas.push([
        ...base,
        l.productos?.referencia ?? "",
        l.productos?.nombre ?? "",
        String(l.cantidad),
        String(Math.round(Number(l.precio_unitario))),
        String(Math.round(sub)),
        String(Math.round(p.totalCop)),
      ]);
    }
  }
  return filas;
}

export default function AdminHistorialPanel({ modoPreparacion }: Props) {
  const hoy = fechaCalendarioBogota();
  const [fechaDesde, setFechaDesde] = useState(hoy);
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [busqueda, setBusqueda] = useState("");
  const [pedidos, setPedidos] = useState<PedidoHistorial[]>([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setLoading(true);
    setMensaje(null);
    try {
      const res = await buscarPedidosHistorialAdmin({
        data: {
          fechaDesde,
          fechaHasta,
          busqueda: busqueda.trim() || undefined,
          soloProduccion: !modoPreparacion,
        },
      });
      if (!res.ok) {
        setMensaje(res.reason);
        setPedidos([]);
        return;
      }
      setPedidos(res.pedidos as PedidoHistorial[]);
      if (res.pedidos.length === 0) {
        setMensaje("No hay pedidos en ese rango con los filtros actuales.");
      }
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "Error al consultar historial");
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [busqueda, fechaDesde, fechaHasta, modoPreparacion]);

  useEffect(() => {
    void buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta, modoPreparacion]);

  function aplicarRango(desde: string, hasta: string) {
    setFechaDesde(desde);
    setFechaHasta(hasta);
  }

  function exportarCsv() {
    if (pedidos.length === 0) {
      setMensaje("No hay datos para exportar. Ajusta el rango y busca de nuevo.");
      return;
    }
    const nombre =
      fechaDesde === fechaHasta
        ? `apex-pedidos-${fechaDesde}.csv`
        : `apex-pedidos-${fechaDesde}_a_${fechaHasta}.csv`;
    descargarCsv(nombre, pedidosACsv(pedidos));
    setMensaje(`Exportado: ${pedidos.length} pedido(s).`);
  }

  const totalVentas = pedidos.reduce((s, p) => s + p.totalCop, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-800 bg-[oklch(0.14_0.04_250)] p-5">
        <div className="flex items-start gap-3 mb-4">
          <History className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">Historial y trazabilidad</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Consulta pedidos pasados sin mezclarlos con la operación del día. La pestaña
              &quot;Operación y pedidos&quot; sigue mostrando solo el día en curso.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-300 text-xs"
            onClick={() => aplicarRango(hoy, hoy)}
          >
            Hoy
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-300 text-xs"
            onClick={() => {
              const ayer = restarDiasCalendarioBogota(1);
              aplicarRango(ayer, ayer);
            }}
          >
            Ayer
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-300 text-xs"
            onClick={() => aplicarRango(restarDiasCalendarioBogota(6), hoy)}
          >
            Últimos 7 días
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-gray-600 text-gray-300 text-xs"
            onClick={() => aplicarRango(restarDiasCalendarioBogota(29), hoy)}
          >
            Últimos 30 días
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-3">
          <label className="block text-xs text-gray-400">
            Desde
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="mt-1 bg-[oklch(0.18_0.04_250)] border-gray-700 text-white"
            />
          </label>
          <label className="block text-xs text-gray-400">
            Hasta
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="mt-1 bg-[oklch(0.18_0.04_250)] border-gray-700 text-white"
            />
          </label>
          <label className="block text-xs text-gray-400 sm:col-span-2">
            Buscar taller, WhatsApp o #pedido
            <div className="mt-1 flex gap-2">
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej. don juan, 57300, 808E1B"
                className="bg-[oklch(0.18_0.04_250)] border-gray-700 text-white"
              />
              <Button
                type="button"
                onClick={() => void buscar()}
                disabled={loading}
                className="bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white shrink-0"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void buscar()}
            disabled={loading}
            className="border-gray-600 text-gray-300"
          >
            <Calendar className="h-4 w-4 mr-1" />
            {loading ? "Buscando…" : "Actualizar consulta"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={exportarCsv}
            disabled={loading || pedidos.length === 0}
            className="border-emerald-600/50 text-emerald-200"
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>

        {mensaje && (
          <p className="mt-3 text-xs text-gray-400" role="status">
            {mensaje}
          </p>
        )}
      </div>

      {pedidos.length > 0 && (
        <p className="text-xs text-gray-500 px-1">
          {pedidos.length} pedido{pedidos.length === 1 ? "" : "s"} · Total referencia:{" "}
          <span className="text-emerald-300 font-semibold">{formatoPrecioCop(totalVentas)}</span>
        </p>
      )}

      <div className="rounded-xl border border-gray-800 bg-[oklch(0.14_0.04_250)] divide-y divide-white/5">
        {pedidos.map((p) => {
          const abierto = expandido === p.id;
          return (
            <div key={p.id} className="p-4">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setExpandido(abierto ? null : p.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      #{refPedidoCorta(p.id)} · {p.taller_nombre}
                      {p.es_prueba && (
                        <span className="ml-2 text-[10px] font-normal text-amber-400">prueba</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatearFechaHora(p.created_at)} · {p.telefono}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{p.direccion ?? "Sin dirección"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-sky-300">{etiquetaEstadoTaller(p.estado)}</p>
                    {p.totalCop > 0 && (
                      <p className="text-xs text-emerald-300 mt-1">{formatoPrecioCop(p.totalCop)}</p>
                    )}
                    <p className="text-[10px] text-gray-500 mt-1">{abierto ? "Ocultar" : "Ver líneas"}</p>
                  </div>
                </div>
              </button>

              {abierto && (
                <div className="mt-3 pl-2 border-l border-white/10 space-y-2">
                  {p.lineas.length === 0 ? (
                    <p className="text-xs text-gray-500">Sin líneas registradas en Supabase.</p>
                  ) : (
                    p.lineas.map((l, i) => (
                      <div key={i} className="text-xs text-gray-300">
                        <span className="text-orange-300 font-mono">
                          {l.productos?.referencia ?? "—"}
                        </span>{" "}
                        ×{l.cantidad} · {formatoPrecioCop(Number(l.precio_unitario))} c/u
                        {l.productos?.nombre && (
                          <p className="text-gray-500 mt-0.5">{l.productos.nombre}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!loading && pedidos.length === 0 && !mensaje && (
          <p className="text-xs text-gray-500 py-8 text-center">Selecciona un rango y pulsa buscar.</p>
        )}
      </div>
    </div>
  );
}
