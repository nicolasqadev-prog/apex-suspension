import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, CheckCircle2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import StudioFooterSignature from "@/components/StudioFooterSignature";
import { formatoPrecioCop } from "@/lib/formato-cop";
import {
  etiquetaEstadoTaller,
  mensajeEstadoTaller,
  refPedidoCorta,
} from "@/lib/pedidos-estado-taller";
import { useTallerSession } from "@/components/TallerSessionProvider";
import { canSuggestNotifications, subscribeAndRegisterPush } from "@/lib/pwa-engagement";
import { enlaceWhatsApp } from "@/lib/whatsapp";

export function abrirWhatsAppPedido(mensaje: string) {
  const url = enlaceWhatsApp(mensaje);
  window.open(url, "_blank", "noopener,noreferrer");
}

type Props = {
  pedidoId: string;
  mensajeWhatsapp: string;
  totalCop?: number | null;
};

export default function PedidoEnviadoExito({
  pedidoId,
  mensajeWhatsapp,
  totalCop = null,
}: Props) {
  const { whatsappGuardado } = useTallerSession();
  const [notifOk, setNotifOk] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <main className="max-w-lg mx-auto w-full flex-1 px-4 py-10 text-center">
        <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
        <h1 className="text-2xl font-bold text-white mt-4">¡Pedido recibido!</h1>
        <p className="text-sm text-gray-400 mt-2">
          Referencia <span className="font-mono text-emerald-300">#{refPedidoCorta(pedidoId)}</span>
        </p>
        <p className="text-base text-white mt-4 leading-relaxed font-medium">
          Apex ya tiene tu pedido guardado.
        </p>
        <p className="text-sm text-emerald-200/90 mt-2 leading-relaxed">
          {mensajeEstadoTaller("borrador")}
        </p>

        <div className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-4 text-left">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Estado actual</p>
          <p className="text-lg font-semibold text-white mt-1">{etiquetaEstadoTaller("borrador")}</p>
          <p className="text-xs text-emerald-400/90 mt-1 font-medium">✓ Registrado en Apex — en revisión</p>
          {totalCop != null && (
            <p className="text-sm text-gray-400 mt-2">
              Total referencia:{" "}
              <span className="text-white font-medium">{formatoPrecioCop(totalCop)}</span>
            </p>
          )}
          <p className="text-xs text-gray-500 mt-3 leading-relaxed">
            Puedes quedarte aquí o ir a <strong className="text-gray-400">Mis pedidos</strong> para
            ver el seguimiento. Te avisamos por notificación cuando confirmemos stock y despacho.
          </p>
        </div>

        {mensajeWhatsapp && (
          <p className="text-xs text-gray-500 mt-5 leading-relaxed px-2">
            ¿Quieres acelerar la confirmación? Envía una copia del pedido por WhatsApp cuando
            quieras — es opcional, el pedido ya quedó registrado en Apex.
          </p>
        )}

        <div className="mt-6 grid gap-3">
          <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-12">
            <Link to="/taller/pedidos/$id" params={{ id: pedidoId }}>
              Ver seguimiento del pedido
            </Link>
          </Button>
          {mensajeWhatsapp && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 font-semibold h-12"
              onClick={() => abrirWhatsAppPedido(mensajeWhatsapp)}
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              Confirmar por WhatsApp (opcional)
            </Button>
          )}
          <Button asChild variant="outline" className="w-full border-gray-600 text-gray-300 h-11">
            <Link to="/taller/pedidos">Mis pedidos</Link>
          </Button>
          {canSuggestNotifications() && !notifOk && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-emerald-600/50 text-emerald-200 h-11"
              onClick={() => {
                void subscribeAndRegisterPush(
                  whatsappGuardado ? { telefono: whatsappGuardado } : undefined,
                ).then((res) => {
                  if (res.ok) setNotifOk(true);
                });
              }}
            >
              <Bell className="h-4 w-4 mr-2" />
              Activar avisos cuando confirmemos
            </Button>
          )}
          {notifOk && (
            <p className="text-xs text-emerald-300/90">Notificaciones activadas en este dispositivo.</p>
          )}
          <Button asChild variant="outline" className="w-full border-gray-600 text-gray-300 h-11">
            <Link to="/catalogo">Seguir comprando</Link>
          </Button>
        </div>
      </main>
      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}
