import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import PedidoEnviadoExito from "@/components/PedidoEnviadoExito";
import { useTallerSession } from "@/components/TallerSessionProvider";
import { allowTallerBorradorEnCliente } from "@/lib/admin-preparacion";
import { obtenerDetallePedidoTaller } from "@/lib/taller.portal.functions";

const SearchSchema = z.object({
  id: z.string().min(8),
});

export const Route = createFileRoute("/taller/pedido/recibido")({
  validateSearch: (search) => {
    const parsed = SearchSchema.safeParse(search);
    if (parsed.success) return parsed.data;
    const raw = typeof (search as { id?: unknown }).id === "string" ? (search as { id: string }).id : "";
    return { id: raw };
  },
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
    if (!id || id.length < 8) {
      void navigate({ to: "/taller/pedidos" });
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

  if (!taller || !id) return null;

  return (
    <PedidoEnviadoExito pedidoId={id} mensajeWhatsapp={mensajeWa} totalCop={totalCop} />
  );
}
