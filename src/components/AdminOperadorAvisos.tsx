import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  subscribeAndRegisterPush,
  vincularPushConTelefonoTaller,
} from "@/lib/pwa-engagement";

function telefonoOperadorApex(): string | undefined {
  const raw = import.meta.env.VITE_WHATSAPP_APEX as string | undefined;
  return raw?.trim() || undefined;
}

type Props = {
  onVinculado?: () => void;
};

/**
 * Avisos push al operador (pedidos nuevos y stock bajo).
 * Siempre visible en admin — en móvil hay que activar permisos una vez.
 */
export default function AdminOperadorAvisos({ onVinculado }: Props) {
  const [estado, setEstado] = useState<"idle" | "ok" | "pendiente" | "denegado" | "busy">("idle");
  const [detalle, setDetalle] = useState<string | null>(null);
  const tel = telefonoOperadorApex();

  useEffect(() => {
    if (!tel) {
      setDetalle("Configura VITE_WHATSAPP_APEX en el deploy para vincular este dispositivo.");
      return;
    }
    if (typeof Notification === "undefined") {
      setEstado("denegado");
      setDetalle("Este navegador no admite notificaciones.");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("denegado");
      setDetalle("Notificaciones bloqueadas. Actívalas en ajustes del sitio (Brave / Chrome).");
      return;
    }
    if (Notification.permission === "granted") {
      void vincularPushConTelefonoTaller(tel).then((res) => {
        if (res.ok) {
          setEstado("ok");
          setDetalle("Este dispositivo recibe avisos de pedidos nuevos y stock bajo.");
          onVinculado?.();
        }
      });
      return;
    }
    setEstado("pendiente");
    setDetalle("Activa avisos para saber al instante cuando un taller pida desde la app.");
  }, [tel, onVinculado]);

  async function activar() {
    if (!tel) return;
    setEstado("busy");
    setDetalle(null);
    const res = await subscribeAndRegisterPush({ telefono: tel });
    if (res.ok) {
      setEstado("ok");
      setDetalle("Listo. Te avisamos aquí cuando entre un pedido o quede stock bajo.");
      onVinculado?.();
      return;
    }
    if (res.reason === "permiso_denegado") {
      setEstado("denegado");
      setDetalle("Permiso denegado. Revisa ajustes de notificaciones para apex-suspension.com.co");
      return;
    }
    setEstado("pendiente");
    setDetalle(res.reason);
  }

  if (estado === "ok") {
    return (
      <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-950/25 px-4 py-3 flex items-start gap-3">
        <BellRing className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-100">Avisos de operador activos</p>
          <p className="text-xs text-emerald-200/80 mt-1 leading-relaxed">{detalle}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 border-emerald-600/50 text-emerald-200 text-xs"
            onClick={() => void activar()}
          >
            Renovar en este dispositivo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-orange-500/40 bg-orange-950/25 px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Bell className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-100">Avisos al operador (este celular)</p>
            <p className="text-xs text-orange-200/80 mt-1 leading-relaxed">
              {detalle ??
                "Sin esto no sabrás cuando un taller pide, aunque el panel esté cerrado."}
            </p>
          </div>
        </div>
        {estado !== "denegado" && tel && (
          <Button
            type="button"
            size="sm"
            disabled={estado === "busy"}
            className="w-full sm:w-auto min-h-11 touch-manipulation bg-orange-600 hover:bg-orange-500 text-white font-semibold shrink-0"
            onClick={() => void activar()}
          >
            {estado === "busy" ? "Activando…" : "Activar avisos de pedidos"}
          </Button>
        )}
      </div>
    </div>
  );
}
