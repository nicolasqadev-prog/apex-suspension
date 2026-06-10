import { MapPin, Navigation, PackageOpen, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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
  const partes = direccion.split(",").map((s) => s.trim()).filter(Boolean);
  if (partes.length > 1) return partes[partes.length - 1]!;
  return partes[0] ?? "Sin municipio";
}

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

type Props = {
  pedidos: PedidoDespacho[];
};

export function ActiveRouteBanner({ pedidosEnRuta }: { pedidosEnRuta: number }) {
  if (pedidosEnRuta <= 0) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-[oklch(0.7_0.2_40)] border-b-2 border-[oklch(0.18_0.04_250)] px-4 py-3 shadow-lg">
      <p className="text-sm font-bold text-[oklch(0.18_0.04_250)] text-center max-w-4xl mx-auto">
        {pedidosEnRuta} pedido{pedidosEnRuta === 1 ? "" : "s"} en ruta ahora — revisa despachos abajo.
      </p>
    </div>
  );
}

export default function AdminDispatchPanel({ pedidos }: Props) {
  const [seleccionados, setSeleccionados] = useState<Record<string, boolean>>({});

  const operativos = pedidos.filter((p) =>
    ["borrador", "cotizado", "confirmado", "empacando", "en_ruta"].includes(p.estado),
  );

  const porZona = new Map<string, PedidoDespacho[]>();
  for (const p of operativos) {
    const zona = municipioDePedido(p.direccion);
    const lista = porZona.get(zona) ?? [];
    lista.push(p);
    porZona.set(zona, lista);
  }

  const zonas = [...porZona.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));

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

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-extrabold uppercase text-white flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[oklch(0.7_0.2_40)]" />
        Panel de despachos
      </h2>
      <p className="text-xs text-gray-500 -mt-4">
        Pedidos reales agrupados por municipio (últimas 2 h). Marca paradas y abre la ruta del día en
        Google Maps por zona.
      </p>

      {zonas.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center rounded-xl border border-gray-800 bg-black/20">
          No hay pedidos pendientes de despacho en esta ventana.
        </p>
      )}

      {zonas.map(([zona, lista]) => {
        const conDireccion = lista.filter((p) => p.direccion?.trim());
        const marcadosEnZona = lista.filter((p) => seleccionados[p.id] && p.direccion?.trim());
        const puedeRuta = conDireccion.length > 0;

        return (
          <div
            key={zona}
            className="bg-[oklch(0.18_0.04_250)] border border-gray-800 rounded-xl p-5 shadow-xl"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-5 h-5 text-[oklch(0.7_0.2_40)] shrink-0" />
                <p className="text-white font-bold truncate">{zona}</p>
                <span className="text-xs text-gray-500 shrink-0">
                  ({lista.length} pedido{lista.length === 1 ? "" : "s"})
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {conDireccion.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-gray-600 text-gray-300 text-xs"
                    onClick={() => seleccionarZona(lista)}
                  >
                    {marcadosEnZona.length === conDireccion.length ? "Quitar selección" : "Seleccionar zona"}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-semibold text-xs disabled:opacity-40"
                  disabled={!puedeRuta}
                  onClick={() => abrirRutaZona(lista)}
                >
                  <Navigation className="w-3.5 h-3.5 mr-1.5" />
                  {marcadosEnZona.length > 0
                    ? `Ruta (${marcadosEnZona.length} paradas)`
                    : "Ruta en Maps"}
                </Button>
              </div>
            </div>

            <ul className="space-y-2">
              {lista.map((p) => (
                <li
                  key={p.id}
                  className="flex items-start gap-3 bg-[oklch(0.24_0.05_255)] rounded-lg px-3 py-2.5"
                >
                  {p.direccion?.trim() ? (
                    <input
                      type="checkbox"
                      checked={!!seleccionados[p.id]}
                      onChange={(e) => togglePedido(p.id, e.target.checked)}
                      className="mt-1 shrink-0"
                      aria-label={`Incluir ${p.taller_nombre} en ruta`}
                    />
                  ) : (
                    <span className="w-4 shrink-0" aria-hidden />
                  )}
                  <PackageOpen className="w-4 h-4 text-[oklch(0.7_0.2_40)] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-100">{p.taller_nombre}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {p.direccion ?? "Sin dirección — no entra en ruta"}
                    </p>
                    <p className="text-xs text-emerald-300/90 mt-1">
                      {etiquetaEstadoTaller(p.estado)} · {horaCorta(p.created_at)}
                      {p.es_prueba ? " · prueba" : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
