import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";

import PedidoEnviadoExito from "@/components/PedidoEnviadoExito";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTallerSession } from "@/components/TallerSessionProvider";
import StudioFooterSignature from "@/components/StudioFooterSignature";
import { formatoPrecioCop } from "@/lib/formato-cop";
import {
  actualizarCantidadCarritoTaller,
  leerCarritoTaller,
  quitarDelCarritoTaller,
  vaciarCarritoTaller,
} from "@/lib/taller-carrito";
import { allowTallerBorradorEnCliente } from "@/lib/admin-preparacion";
import { enviarPedidoTaller, obtenerCatalogoTaller } from "@/lib/taller.portal.functions";
import type { LineaCarritoTaller } from "@/lib/taller.types";

type PedidoEnviado = {
  id: string;
  mensajeWhatsapp: string;
  totalCop: number;
};

export const Route = createFileRoute("/taller/pedido")({
  component: TallerPedidoPage,
});

function TallerPedidoPage() {
  const navigate = useNavigate();
  const { taller, whatsappGuardado } = useTallerSession();
  const [lineas, setLineas] = useState<LineaCarritoTaller[]>([]);
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [pedidoEnviado, setPedidoEnviado] = useState<PedidoEnviado | null>(null);

  useEffect(() => {
    setLineas(leerCarritoTaller());
  }, []);

  useEffect(() => {
    if (!taller) {
      void navigate({ to: "/taller/acceso" });
    }
  }, [taller, navigate]);

  useEffect(() => {
    if (!taller || !whatsappGuardado || lineas.length === 0 || pedidoEnviado) return;
    let cancelled = false;
    obtenerCatalogoTaller({
      data: {
        whatsapp: whatsappGuardado,
        allowNoPublicado: allowTallerBorradorEnCliente(),
      },
    }).then((res) => {
      if (cancelled || !res.ok) return;
      const porSlug = new Map(res.piezas.map((p) => [p.slug, p]));
      setLineas((prev) =>
        prev.map((l) => {
          const pieza = porSlug.get(l.slug);
          if (!pieza) return l;
          return {
            ...l,
            referencia: pieza.referencia,
            nombre: pieza.nombre,
            precioUnitarioCop: pieza.precioTaller,
            precioListaPublicoCop: pieza.precioLista,
            stock: pieza.stock,
          };
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [taller, whatsappGuardado, lineas.length, pedidoEnviado]);

  const total = useMemo(
    () => lineas.reduce((s, l) => s + l.precioUnitarioCop * l.cantidad, 0),
    [lineas],
  );

  const ahorro = useMemo(() => {
    let totalPublico = 0;
    for (const l of lineas) {
      if (l.precioListaPublicoCop != null && l.precioListaPublicoCop > l.precioUnitarioCop) {
        totalPublico += l.precioListaPublicoCop * l.cantidad;
      }
    }
    if (totalPublico <= total) return 0;
    return totalPublico - total;
  }, [lineas, total]);

  function refresh() {
    setLineas(leerCarritoTaller());
  }

  async function onEnviar(e: FormEvent) {
    e.preventDefault();
    if (!taller || lineas.length === 0 || enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await enviarPedidoTaller({
        data: {
          whatsapp: whatsappGuardado,
          lineas: lineas.map((l) => ({ slug: l.slug, cantidad: l.cantidad })),
          notas: notas.trim() || undefined,
          allowNoPublicado: allowTallerBorradorEnCliente(),
        },
      });
      if (!res.ok) {
        const mensajes: Record<string, string> = {
          linea_invalida:
            "Una referencia ya no está en el catálogo. Vuelve al catálogo y agrégala de nuevo.",
          pedido_fallo: "No pudimos guardar el pedido. Intenta de nuevo en unos segundos.",
          no_autorizado: "Tu sesión expiró. Vuelve a entrar con tu WhatsApp.",
        };
        setError(
          mensajes[res.reason ?? ""] ??
            "No pudimos registrar el pedido. Revisa tu sesión o intenta de nuevo.",
        );
        return;
      }

      const totalEnviado = lineas.reduce((s, l) => s + l.precioUnitarioCop * l.cantidad, 0);
      vaciarCarritoTaller();
      setLineas([]);
      try {
        sessionStorage.setItem("apex.pedido.ultimoWa", res.mensajeWhatsapp);
        sessionStorage.setItem("apex.pedido.ultimoId", res.pedidoId);
      } catch {
        // ignore
      }

      setPedidoEnviado({
        id: res.pedidoId,
        mensajeWhatsapp: res.mensajeWhatsapp,
        totalCop: res.totalCop ?? totalEnviado,
      });

      try {
        const url = `/taller/pedido/recibido?id=${encodeURIComponent(res.pedidoId)}`;
        window.history.replaceState(null, "", url);
      } catch {
        // ignore
      }
    } catch {
      setError("Error de conexión. Revisa tu internet e intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!taller) return null;

  if (pedidoEnviado) {
    return (
      <PedidoEnviadoExito
        pedidoId={pedidoEnviado.id}
        mensajeWhatsapp={pedidoEnviado.mensajeWhatsapp}
        totalCop={pedidoEnviado.totalCop}
      />
    );
  }

  const tieneEntrega = Boolean(taller.municipio.trim() || taller.direccionEntrega.trim());

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      {enviando && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 px-6 text-center"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-12 w-12 text-emerald-400 animate-spin" />
          <p className="mt-4 text-lg font-semibold text-white">Enviando tu pedido a Apex…</p>
          <p className="mt-2 text-sm text-gray-400">No cierres esta pantalla</p>
        </div>
      )}

      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <Link to="/catalogo" className="text-xs text-gray-500 hover:text-[oklch(0.7_0.2_40)]">
            ← Catálogo
          </Link>
          <h1 className="mt-2 text-xl font-bold text-white">Pedido rápido</h1>
          <p className="text-xs text-gray-500">{taller.nombreTaller}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto w-full flex-1 px-4 py-8">
        {lineas.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Tu carrito está vacío.</p>
            <Button asChild className="mt-6 bg-emerald-600 hover:bg-emerald-500">
              <Link to="/catalogo">Ir al catálogo</Link>
            </Button>
            <p className="mt-4 text-xs text-gray-500">
              Si acabas de enviar un pedido, revisa{" "}
              <Link to="/taller/pedidos" className="text-emerald-400 underline">
                Mis pedidos
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {lineas.map((l) => (
                <li
                  key={l.slug}
                  className="rounded-lg border border-gray-800 bg-[oklch(0.14_0.04_250)] p-4"
                >
                  <p className="text-xs font-mono text-[oklch(0.7_0.2_40)]">{l.referencia}</p>
                  <p className="font-semibold text-white text-sm">{l.nombre}</p>
                  <p className="text-sm text-emerald-300 mt-1">
                    {formatoPrecioCop(l.precioUnitarioCop)} c/u
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Menos"
                        className="p-1 rounded border border-gray-700 text-gray-300"
                        onClick={() => {
                          actualizarCantidadCarritoTaller(l.slug, l.cantidad - 1);
                          refresh();
                        }}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-medium w-8 text-center">{l.cantidad}</span>
                      <button
                        type="button"
                        aria-label="Más"
                        className="p-1 rounded border border-gray-700 text-gray-300"
                        onClick={() => {
                          const max = l.stock > 0 ? l.stock : 99;
                          actualizarCantidadCarritoTaller(l.slug, Math.min(l.cantidad + 1, max));
                          refresh();
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-red-400 p-1"
                      aria-label="Quitar"
                      onClick={() => {
                        quitarDelCarritoTaller(l.slug);
                        refresh();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-1 text-right">
              <p className="text-lg font-bold text-white">
                Total referencia: {formatoPrecioCop(total)}
              </p>
              {ahorro > 0 && (
                <p className="text-sm text-emerald-300">
                  Tu ahorro en esta compra: {formatoPrecioCop(ahorro)}
                </p>
              )}
            </div>

            <form onSubmit={onEnviar} className="mt-8 space-y-4 border-t border-white/10 pt-6">
              {tieneEntrega ? (
                <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    Entrega registrada
                  </p>
                  {taller.municipio.trim() && (
                    <p className="text-white mt-1">{taller.municipio}</p>
                  )}
                  {taller.direccionEntrega.trim() && (
                    <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">
                      {taller.direccionEntrega}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-500 mt-2">
                    Si cambió el punto de entrega, indícalo en notas para Apex.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-amber-300/90 leading-relaxed">
                  Aún no hay dirección de entrega registrada. Escribe el punto en notas para Apex o
                  pide al equipo que actualice tu ficha.
                </p>
              )}
              <label className="block text-sm text-gray-400">
                Notas para Apex
                <Input
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Urgente, contra entrega, cambio de dirección, etc."
                  className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
                  disabled={enviando}
                />
              </label>
              {taller.contraEntregaHabilitada && (
                <p className="text-xs text-emerald-300/90">
                  Tu cuenta tiene contra entrega habilitada; confirma condiciones con el equipo al
                  enviar.
                </p>
              )}
              {error && (
                <p className="text-sm text-red-300 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={enviando}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-12 text-base"
              >
                {enviando ? "Enviando…" : "Enviar pedido"}
              </Button>
              <p className="text-[10px] text-gray-500 text-center leading-relaxed">
                Al enviar verás la confirmación en pantalla y podrás mandar copia por WhatsApp.
              </p>
            </form>
          </>
        )}
      </main>

      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}
