import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import StudioFooterSignature from "@/components/StudioFooterSignature";
import { formatoPrecioCop } from "@/lib/formato-cop";
import {
  etiquetaEstadoTaller,
  mensajeEstadoTaller,
  refPedidoCorta,
} from "@/lib/pedidos-estado-taller";
import { canSuggestNotifications, subscribeAndRegisterPush } from "@/lib/pwa-engagement";
import { enlaceWhatsApp } from "@/lib/whatsapp";

export function abrirWhatsAppPedido(mensaje: string) {
  const url = enlaceWhatsApp(mensaje);
  window.location.assign(url);
}

type Props = {
  pedidoId: string;
  mensajeWhatsapp: string;
  totalCop?: number | null;
  autoAbrirWhatsapp?: boolean;
};

export default function PedidoEnviadoExito({
  pedidoId,
  mensajeWhatsapp,
  totalCop = null,
  autoAbrirWhatsapp = true,
}: Props) {
  const [waAbierto, setWaAbierto] = useState(false);
  const [notifOk, setNotifOk] = useState(false);
  const waAutoIntentado = useRef(false);

  useEffect(() => {
    if (!autoAbrirWhatsapp || !mensajeWhatsapp || waAutoIntentado.current) return;
    waAutoIntentado.current = true;
    const t = setTimeout(() => {
      abrirWhatsAppPedido(mensajeWhatsapp);
      setWaAbierto(true);
    }, 900);
    return () => clearTimeout(t);
  }, [autoAbrirWhatsapp, mensajeWhatsapp]);

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <main className="max-w-lg mx-auto w-full flex-1 px-4 py-10 text-center">
        <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
        <h1 className="text-2xl font-bold text-white mt-4">¡Pedido recibido!</h1>
        <p className="text-sm text-gray-400 mt-2">
          Referencia <span className="font-mono text-emerald-300">#{refPedidoCorta(pedidoId)}</span>
        </p>
        <p className="text-base text-white mt-4 leading-relaxed font-medium">
          Apex ya tiene tu pedido.
        </p>
        <p className="text-sm text-emerald-200/90 mt-2 leading-relaxed">
          {mensajeEstadoTaller("borrador")}
        </p>

        <div className="mt-6 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-4 text-left">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Estado actual</p>
          <p className="text-lg font-semibold text-white mt-1 flex items-center gap-2">
            {etiquetaEstadoTaller("borrador")}
            <Loader2 className="h-4 w-4 text-emerald-400 animate-spin" aria-hidden />
          </p>
          {totalCop != null && (
            <p className="text-sm text-gray-400 mt-2">
              Total referencia:{" "}
              <span className="text-white font-medium">{formatoPrecioCop(totalCop)}</span>
            </p>
          )}
          <p className="text-xs text-gray-500 mt-3 leading-relaxed">
            Te avisamos por notificación cuando confirmemos stock y despacho. También puedes
            revisar el estado en <strong className="text-gray-400">Mis pedidos</strong>.
          </p>
        </div>

        {mensajeWhatsapp && (
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            {waAbierto
              ? "Si WhatsApp no se abrió, toca el botón verde de abajo."
              : "Abriendo WhatsApp con el resumen…"}
          </p>
        )}

        <div className="mt-8 grid gap-3">
          {mensajeWhatsapp && (
            <Button
              type="button"
              className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold h-12"
              onClick={() => abrirWhatsAppPedido(mensajeWhatsapp)}
            >
              Enviar copia por WhatsApp
            </Button>
          )}
          <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold h-12">
            <Link to="/taller/pedidos/$id" params={{ id: pedidoId }}>
              Ver seguimiento del pedido
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full border-gray-600 text-gray-300 h-11">
            <Link to="/taller/pedidos">Mis pedidos</Link>
          </Button>
          {canSuggestNotifications() && !notifOk && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-emerald-600/50 text-emerald-200 h-11"
              onClick={() => {
                void subscribeAndRegisterPush().then((res) => {
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
