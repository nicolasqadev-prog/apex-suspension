import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
import { enlaceWhatsApp } from "@/lib/whatsapp";

const SearchSchema = z.object({
  id: z.string().uuid(),
});

export const Route = createFileRoute("/taller/pedido/recibido")({
  validateSearch: SearchSchema,
  component: PedidoRecibidoPage,
});

function PedidoRecibidoPage() {
  const navigate = useNavigate();
  const { id } = Route.useSearch();
  const { taller, whatsappGuardado } = useTallerSession();
  const [totalCop, setTotalCop] = useState<number | null>(null);
  const [mensajeWa, setMensajeWa] = useState("");

  useEffect(() => {
    try {
      setMensajeWa(sessionStorage.getItem("apex.pedido.ultimoWa") ?? "");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!taller) {
      void navigate({ to: "/taller/acceso" });
      return;
    }
    obtenerDetallePedidoTaller({
      data: {
        whatsapp: whatsappGuardado,
        pedidoId: id,
        allowNoPublicado: allowTallerBorradorEnCliente(),
      },
    }).then((res) => {
      if (res.ok) setTotalCop(res.totalCop);
    });
  }, [taller, whatsappGuardado, id, navigate]);

  if (!taller) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <main className="max-w-lg mx-auto w-full flex-1 px-4 py-10 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto" />
        <h1 className="text-2xl font-bold text-white mt-4">Pedido recibido</h1>
        <p className="text-sm text-gray-400 mt-2">
          Referencia <span className="font-mono text-emerald-300">#{refPedidoCorta(id)}</span>
        </p>
        <p className="text-sm text-emerald-200/90 mt-4 leading-relaxed">{mensajeEstadoTaller("borrador")}</p>

        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-4 py-4 text-left">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Estado actual</p>
          <p className="text-lg font-semibold text-white mt-1">{etiquetaEstadoTaller("borrador")}</p>
          {totalCop != null && (
            <p className="text-sm text-gray-400 mt-2">
              Total referencia: <span className="text-white font-medium">{formatoPrecioCop(totalCop)}</span>
            </p>
          )}
        </div>

        <div className="mt-8 grid gap-3">
          <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold">
            <Link to="/taller/pedidos/$id" params={{ id }}>
              Ver seguimiento del pedido
            </Link>
          </Button>
          {mensajeWa && (
            <Button asChild variant="outline" className="w-full border-[#25D366] text-[#25D366]">
              <a href={enlaceWhatsApp(mensajeWa)} target="_blank" rel="noreferrer">
                Continuar por WhatsApp
              </a>
            </Button>
          )}
          <Button asChild variant="outline" className="w-full border-gray-600 text-gray-300">
            <Link to="/catalogo">Seguir comprando</Link>
          </Button>
        </div>
      </main>
      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}
