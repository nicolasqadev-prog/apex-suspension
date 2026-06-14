import {
  ChevronDown,
  ChevronRight,
  MapPin,
  Navigation,
  PackageOpen,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ESTADO_EN_RUTA,
  ESTADO_ENTREGADO,
  ESTADOS_POR_DESPACHAR,
  PEDIDO_NUEVO_MINUTOS,
  esPedidoNuevoReciente,
} from "@/lib/admin-despachos";
import { googleMapsRouteUrl } from "@/lib/maps-ruta";
import { etiquetaEstadoTaller } from "@/lib/pedidos-estado-taller";

export type PedidoDespacho = {
  id: string;
  taller_nombre: string;
  direccion: string | null;
  estado: string;
  notas: string | null;
  created_at: string;
  es_prueba?: boolean;
};

function municipioDePedido(direccion: string | null): string {
  if (!direccion?.trim()) return "Sin municipio";
  const partes = direccion
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (partes.length > 1) return partes[partes.length - 1]!;
  return partes[0] ?? "Sin municipio";
}

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function agruparPorZona(pedidos: PedidoDespacho[]): [string, PedidoDespacho[]][] {
  const porZona = new Map<string, PedidoDespacho[]>();
  for (const p of pedidos) {
    const zona = municipioDePedido(p.direccion);
    const lista = porZona.get(zona) ?? [];
    lista.push(p);
    porZona.set(zona, lista);
  }
  return [...porZona.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
}

function FilaPedido({
  pedido,
  mostrarNuevo,
  conCheckbox,
  seleccionado,
  onToggle,
}: {
  pedido: PedidoDespacho;
  mostrarNuevo?: boolean;
  conCheckbox?: boolean;
  seleccionado?: boolean;
  onToggle?: (checked: boolean) => void;
}) {
  const nuevo = mostrarNuevo && esPedidoNuevoReciente(pedido.created_at);

  return (
    <li className="flex items-start gap-3 bg-[oklch(0.24_0.05_255)] rounded-lg px-3 py-2.5">
      {conCheckbox && pedido.direccion?.trim() ? (
        <input
          type="checkbox"
          checked={!!seleccionado}
          onChange={(e) => onToggle?.(e.target.checked)}
          className="mt-1 shrink-0"
          aria-label={`Incluir ${pedido.taller_nombre} en ruta`}
        />
      ) : (
        <span className="w-4 shrink-0" aria-hidden />
      )}
      <PackageOpen className="w-4 h-4 text-[oklch(0.7_0.2_40)] shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-gray-100">{pedido.taller_nombre}</p>
          {nuevo && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-200 bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded">
              Nuevo
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {pedido.direccion ?? "Sin dirección — no entra en ruta"}
        </p>
        <p className="text-xs text-emerald-300/90 mt-1">
          {etiquetaEstadoTaller(pedido.estado)} · {horaCorta(pedido.created_at)}
          {pedido.es_prueba ? " · prueba" : ""}
        </p>
      </div>
    </li>
  );
}

function ZonaDespacho({
  zona,
  lista,
  seleccionados,
  onToggle,
  onSeleccionarZona,
  onAbrirRuta,
  mostrarNuevo,
}: {
  zona: string;
  lista: PedidoDespacho[];
  seleccionados: Record<string, boolean>;
  onToggle: (id: string, checked: boolean) => void;
  onSeleccionarZona: (lista: PedidoDespacho[]) => void;
  onAbrirRuta: (lista: PedidoDespacho[]) => void;
  mostrarNuevo?: boolean;
}) {
  const conDireccion = lista.filter((p) => p.direccion?.trim());
  const marcadosEnZona = lista.filter((p) => seleccionados[p.id] && p.direccion?.trim());
  const puedeRuta = conDireccion.length > 0;
  const nuevosEnZona = lista.filter((p) => esPedidoNuevoReciente(p.created_at)).length;

  return (
    <div className="bg-[oklch(0.18_0.04_250)] border border-gray-800 rounded-xl p-5 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <MapPin className="w-5 h-5 text-[oklch(0.7_0.2_40)] shrink-0" />
          <p className="text-white font-bold truncate">{zona}</p>
          <span className="text-xs text-gray-500 shrink-0">
            ({lista.length} pedido{lista.length === 1 ? "" : "s"})
          </span>
          {mostrarNuevo && nuevosEnZona > 0 && (
            <span className="text-[10px] font-semibold text-amber-200/90">
              · {nuevosEnZona} nuevo{nuevosEnZona === 1 ? "" : "s"} (últimos {PEDIDO_NUEVO_MINUTOS}{" "}
              min)
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {conDireccion.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-gray-600 text-gray-300 text-xs"
              onClick={() => onSeleccionarZona(lista)}
            >
              {marcadosEnZona.length === conDireccion.length
                ? "Quitar selección"
                : "Seleccionar zona"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-semibold text-xs disabled:opacity-40"
            disabled={!puedeRuta}
            onClick={() => onAbrirRuta(lista)}
          >
            <Navigation className="w-3.5 h-3.5 mr-1.5" />
            {marcadosEnZona.length > 0 ? `Ruta (${marcadosEnZona.length} paradas)` : "Ruta en Maps"}
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {lista.map((p) => (
          <FilaPedido
            key={p.id}
            pedido={p}
            mostrarNuevo={mostrarNuevo}
            conCheckbox
            seleccionado={seleccionados[p.id]}
            onToggle={(checked) => onToggle(p.id, checked)}
          />
        ))}
      </ul>
    </div>
  );
}

type Props = {
  pedidos: PedidoDespacho[];
  ventanaDia?: boolean;
};

export function ActiveRouteBanner({ pedidosEnRuta }: { pedidosEnRuta: number }) {
  if (pedidosEnRuta <= 0) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-[oklch(0.7_0.2_40)] border-b-2 border-[oklch(0.18_0.04_250)] px-4 py-3 shadow-lg">
      <p className="text-sm font-bold text-[oklch(0.18_0.04_250)] text-center max-w-4xl mx-auto">
        {pedidosEnRuta} pedido{pedidosEnRuta === 1 ? "" : "s"} en ruta ahora — sección activa abajo.
      </p>
    </div>
  );
}

export default function AdminDispatchPanel({ pedidos, ventanaDia = true }: Props) {
  const [seleccionados, setSeleccionados] = useState<Record<string, boolean>>({});
  const [verEntregados, setVerEntregados] = useState(false);

  const enRuta = pedidos.filter((p) => p.estado === ESTADO_EN_RUTA);
  const porDespachar = pedidos.filter((p) =>
    (ESTADOS_POR_DESPACHAR as readonly string[]).includes(p.estado),
  );
  const entregados = pedidos.filter((p) => p.estado === ESTADO_ENTREGADO);
  const nuevosPorDespachar = porDespachar.filter((p) => esPedidoNuevoReciente(p.created_at)).length;

  const zonasDespacho = agruparPorZona(porDespachar);
  const zonasEnRuta = agruparPorZona(enRuta);

  function togglePedido(id: string, checked: boolean) {
    setSeleccionados((s) => ({ ...s, [id]: checked }));
  }

  function seleccionarZona(lista: PedidoDespacho[]) {
    const conDireccion = lista.filter((p) => p.direccion?.trim());
    if (conDireccion.length === 0) return;
    const todosMarcados = conDireccion.every((p) => seleccionados[p.id]);
    setSeleccionados((s) => {
      const next = { ...s };
      for (const p of conDireccion) next[p.id] = !todosMarcados;
      return next;
    });
  }

  function abrirRutaZona(lista: PedidoDespacho[]) {
    const marcados = lista.filter((p) => seleccionados[p.id] && p.direccion?.trim());
    const direcciones =
      marcados.length > 0
        ? marcados.map((p) => p.direccion!.trim())
        : lista.map((p) => p.direccion?.trim() ?? "").filter(Boolean);
    const url = googleMapsRouteUrl(direcciones);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const vacio = enRuta.length === 0 && porDespachar.length === 0 && entregados.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-extrabold uppercase text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[oklch(0.7_0.2_40)]" />
          Panel de despachos
        </h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          {ventanaDia
            ? "Pedidos del día (Colombia). Revisa cada 15 min o cuando llegue push de pedido nuevo."
            : "Modo prueba: ventana corta. Agrupa por municipio y abre ruta en Maps."}
        </p>
      </div>

      {vacio && (
        <p className="text-sm text-gray-500 py-8 text-center rounded-xl border border-gray-800 bg-black/20">
          No hay pedidos en el panel de despachos hoy.
        </p>
      )}

      {enRuta.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wide">
              En ruta ahora ({enRuta.length})
            </h3>
          </div>
          <p className="text-xs text-gray-500 -mt-1">
            Entregas en curso. Al llegar al taller, marca{" "}
            <strong className="text-gray-400">Entregado</strong> arriba en estado del pedido.
          </p>
          {zonasEnRuta.map(([zona, lista]) => (
            <div
              key={`ruta-${zona}`}
              className="rounded-xl border border-orange-500/30 bg-orange-950/20 p-4"
            >
              <p className="text-xs font-semibold text-orange-200/90 mb-3 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {zona} · {lista.length} en camino
              </p>
              <ul className="space-y-2">
                {lista.map((p) => (
                  <FilaPedido key={p.id} pedido={p} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <PackageOpen className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wide">
            Por despachar hoy ({porDespachar.length})
          </h3>
          {nuevosPorDespachar > 0 && (
            <span className="text-xs font-semibold text-amber-200 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded-full">
              {nuevosPorDespachar} nuevo{nuevosPorDespachar === 1 ? "" : "s"} últimos{" "}
              {PEDIDO_NUEVO_MINUTOS} min
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Confirmados o en bodega listos para la próxima salida. Marca paradas y abre Maps por zona.
        </p>

        {porDespachar.length === 0 && (
          <p className="text-sm text-gray-500 py-6 text-center rounded-xl border border-dashed border-gray-700">
            No hay pedidos pendientes de salida.
          </p>
        )}

        {zonasDespacho.map(([zona, lista]) => (
          <ZonaDespacho
            key={zona}
            zona={zona}
            lista={lista}
            seleccionados={seleccionados}
            onToggle={togglePedido}
            onSeleccionarZona={seleccionarZona}
            onAbrirRuta={abrirRutaZona}
            mostrarNuevo
          />
        ))}
      </section>

      {entregados.length > 0 && (
        <section className="rounded-xl border border-gray-800 bg-black/20 overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
            onClick={() => setVerEntregados((v) => !v)}
          >
            <span className="text-sm font-semibold text-gray-300">
              Entregados hoy ({entregados.length})
            </span>
            {verEntregados ? (
              <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
            )}
          </button>
          {verEntregados && (
            <ul className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
              {entregados.map((p) => (
                <FilaPedido key={p.id} pedido={p} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
