import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Package } from "lucide-react";

import TallerNotificacionesAviso from "@/components/TallerNotificacionesAviso";
import { useTallerSession } from "@/components/TallerSessionProvider";
import StudioFooterSignature from "@/components/StudioFooterSignature";
import { formatoPrecioCop } from "@/lib/formato-cop";
import { allowTallerBorradorEnCliente } from "@/lib/admin-preparacion";
import { etiquetaEstadoTaller, refPedidoCorta } from "@/lib/pedidos-estado-taller";
import { listarMisPedidosTaller } from "@/lib/taller.portal.functions";

type PedidoResumen = {
  id: string;
  estado: string;
  created_at: string;
  notas: string | null;
};

export const Route = createFileRoute("/taller/pedidos/")({
  component: MisPedidosPage,
});

function extraerTotalNotas(notas: string | null): number | null {
  if (!notas) return null;
  const m = notas.match(/Total referencia:\s*\$\s*([\d.,]+)/);
  if (!m) return null;
  const n = Number(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function MisPedidosPage() {
  const navigate = useNavigate();
  const { taller, whatsappGuardado } = useTallerSession();
  const [pedidos, setPedidos] = useState<PedidoResumen[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!taller) {
      void navigate({ to: "/taller/acceso" });
      return;
    }
    setLoading(true);
    listarMisPedidosTaller({
      data: {
        whatsapp: whatsappGuardado,
        allowNoPublicado: allowTallerBorradorEnCliente(),
      },
    })
      .then((res) => {
        if (res.ok) setPedidos(res.pedidos);
      })
      .finally(() => setLoading(false));
  }, [taller, whatsappGuardado, navigate]);

  if (!taller) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <Link to="/taller" className="text-xs text-gray-500 hover:text-[oklch(0.7_0.2_40)]">
            ← Portal taller
          </Link>
          <h1 className="mt-2 text-xl font-bold text-white flex items-center gap-2">
            <Package className="h-6 w-6 text-emerald-400" />
            Mis pedidos
          </h1>
          <p className="text-xs text-gray-500 mt-1">Últimos 30 días · {taller.nombreTaller}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto w-full flex-1 px-4 py-6">
        <TallerNotificacionesAviso />
        {loading && <p className="text-sm text-gray-400 text-center py-8">Cargando pedidos…</p>}

        {!loading && pedidos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">Aún no tienes pedidos registrados.</p>
            <Link
              to="/catalogo"
              className="inline-block mt-4 text-sm text-emerald-400 hover:text-emerald-300"
            >
              Ir al catálogo →
            </Link>
          </div>
        )}

        <ul className="space-y-3">
          {pedidos.map((p) => {
            const total = extraerTotalNotas(p.notas);
            const fecha = new Date(p.created_at).toLocaleDateString("es-CO", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() =>
                    void navigate({ to: "/taller/pedidos/$id", params: { id: p.id } })
                  }
                  className="w-full flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[oklch(0.14_0.04_250)] p-4 hover:border-emerald-600/40 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono text-emerald-400">#{refPedidoCorta(p.id)}</p>
                    <p className="text-sm font-semibold text-white mt-0.5">
                      {etiquetaEstadoTaller(p.estado)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{fecha}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {total != null && (
                      <span className="text-sm font-medium text-gray-300">
                        {formatoPrecioCop(total)}
                      </span>
                    )}
                    <ChevronRight className="h-5 w-5 text-gray-600" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </main>

      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}
