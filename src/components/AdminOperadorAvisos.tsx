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
  compact?: boolean;
};

/**
 * Avisos push al operador (pedidos nuevos y stock bajo).
 * Visible en todas las pestañas del admin.
 */
export default function AdminOperadorAvisos({ onVinculado, compact }: Props) {
  const [estado, setEstado] = useState<"idle" | "ok" | "pendiente" | "denegado" | "busy">("idle");
  const [detalle, setDetalle] = useState<string | null>(null);
  const tel = telefonoOperadorApex();

  useEffect(() => {
    if (!tel) {
      setDetalle("Falta VITE_WHATSAPP_APEX en el deploy (WhatsApp del operador).");
      setEstado("pendiente");
      return;
    }
    if (typeof Notification === "undefined") {
      setEstado("denegado");
      setDetalle("Este navegador no admite notificaciones.");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("denegado");
      setDetalle(
        "Notificaciones bloqueadas para este sitio. En Brave: menú ⋮ → Configuración del sitio → Notificaciones → Permitir. Luego vuelve aquí.",
      );
      return;
    }
    if (Notification.permission === "granted") {
      void vincularPushConTelefonoTaller(tel).then((res) => {
        if (res.ok) {
          setEstado("ok");
          setDetalle("Este dispositivo recibe avisos de pedidos nuevos y stock bajo.");
          onVinculado?.();
        } else {
          setEstado("pendiente");
          setDetalle(
            res.reason === "vapid_no_configurado"
              ? "Push no configurado en servidor."
              : `Vincula de nuevo: ${res.reason}`,
          );
        }
      });
      return;
    }
    setEstado("pendiente");
    setDetalle("Pulsa el botón para recibir aviso cuando un taller haga un pedido.");
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
      setDetalle(
        "Permiso denegado. Brave → Configuración del sitio → apex-suspension.com.co → Notificaciones → Permitir.",
      );
      return;
    }
    setEstado("pendiente");
    setDetalle(res.reason);
  }

  if (compact && estado === "ok") {
    return (
      <span className="text-[10px] text-emerald-300/90 hidden sm:inline">Avisos activos</span>
    );
  }

  if (estado === "ok" && !compact) {
    return (
      <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-950/25 px-4 py-3 flex items-start gap-3">
        <BellRing className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-100">Avisos de operador activos</p>
          <p className="text-xs text-emerald-200/80 mt-1 leading-relaxed">{detalle}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2 border-emerald-600/50 text-emerald-200 text-xs min-h-10 touch-manipulation"
            onClick={() => void activar()}
          >
            Renovar en este dispositivo
          </Button>
        </div>
      </div>
    );
  }

  if (estado === "ok" && compact) return null;

  return (
    <div
      className={
        compact
          ? "rounded-lg border border-orange-500/40 bg-orange-950/25 px-3 py-2"
          : "mb-4 rounded-xl border border-orange-500/40 bg-orange-950/25 px-4 py-3"
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Bell className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-100">
              {compact ? "Avisos pedidos" : "Avisos al operador (este celular)"}
            </p>
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

/** Para el botón del header: activa y devuelve mensaje para mostrar al usuario. */
export async function activarAvisosOperadorAdmin(): Promise<string> {
  const tel = telefonoOperadorApex();
  if (!tel) return "Falta configurar el WhatsApp del operador en el servidor.";
  const res = await subscribeAndRegisterPush({ telefono: tel });
  if (res.ok) return "Listo: este celular recibirá avisos de pedidos nuevos.";
  if (res.reason === "permiso_denegado") {
    return "Permiso denegado. En Brave abre Configuración del sitio y permite notificaciones.";
  }
  return `No se pudo activar: ${res.reason}`;
}
