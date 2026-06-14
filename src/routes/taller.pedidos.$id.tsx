import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import PedidoEstadoTimeline from "@/components/PedidoEstadoTimeline";
import { useTallerSession } from "@/components/TallerSessionProvider";
import StudioFooterSignature from "@/components/StudioFooterSignature";
import { formatoPrecioCop } from "@/lib/formato-cop";
import { allowTallerBorradorEnCliente } from "@/lib/admin-preparacion";
import {
  etiquetaEstadoTaller,
  mensajeEstadoTaller,
  refPedidoCorta,
} from "@/lib/pedidos-estado-taller";
import { obtenerDetallePedidoTaller } from "@/lib/taller.portal.functions";

export const Route = createFileRoute("/taller/pedidos/$id")({
  component: DetallePedidoPage,
});

function DetallePedidoPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { taller, whatsappGuardado } = useTallerSession();
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState("borrador");
  const [direccion, setDireccion] = useState<string | null>(null);
  const [lineas, setLineas] = useState<
    { referencia: string; nombre: string; cantidad: number; precio: number }[]
  >([]);
  const [totalCop, setTotalCop] = useState(0);

  useEffect(() => {
    if (!taller) {
      void navigate({ to: "/taller/acceso" });
      return;
    }
    setLoading(true);
    obtenerDetallePedidoTaller({
      data: {
        whatsapp: whatsappGuardado,
        pedidoId: id,
        allowNoPublicado: allowTallerBorradorEnCliente(),
      },
    })
      .then((res) => {
        if (!res.ok) {
          void navigate({ to: "/taller/pedidos" });
          return;
        }
        setEstado(res.pedido.estado);
        setDireccion(res.pedido.direccion);
        setTotalCop(res.totalCop);
        setLineas(
          res.lineas.map((l) => ({
            referencia: l.productos?.referencia ?? "—",
            nombre: l.productos?.nombre ?? "Referencia",
            cantidad: l.cantidad,
            precio: Number(l.precio_unitario),
          })),
        );
      })
      .finally(() => setLoading(false));
  }, [taller, whatsappGuardado, id, navigate]);

  if (!taller) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <Link
            to="/taller/pedidos"
            className="text-xs text-gray-500 hover:text-[oklch(0.7_0.2_40)]"
          >
            ← Mis pedidos
          </Link>
          <h1 className="mt-2 text-xl font-bold text-white">Pedido #{refPedidoCorta(id)}</h1>
          <p className="text-sm text-emerald-300 mt-1">{etiquetaEstadoTaller(estado)}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto w-full flex-1 px-4 py-6 space-y-6">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">Cargando…</p>
        ) : (
          <>
            <p className="text-sm text-gray-400 leading-relaxed">{mensajeEstadoTaller(estado)}</p>

            <section className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Seguimiento
              </p>
              <PedidoEstadoTimeline estadoActual={estado} />
            </section>

            {direccion && (
              <section className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Entrega
                </p>
                <p className="text-sm text-white mt-1">{direccion}</p>
              </section>
            )}

            {lineas.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Referencias
                </p>
                <ul className="space-y-2">
                  {lineas.map((l, i) => (
                    <li
                      key={`${l.referencia}-${i}`}
                      className="rounded-lg border border-gray-800 bg-[oklch(0.14_0.04_250)] p-3 text-sm"
                    >
                      <p className="text-xs font-mono text-[oklch(0.7_0.2_40)]">{l.referencia}</p>
                      <p className="text-white font-medium">{l.nombre}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        ×{l.cantidad} · {formatoPrecioCop(l.precio)} c/u
                      </p>
                    </li>
                  ))}
                </ul>
                <p className="text-right text-lg font-bold text-white mt-4">
                  Total: {formatoPrecioCop(totalCop)}
                </p>
              </section>
            )}
          </>
        )}
      </main>

      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}
