import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTallerSession } from "@/components/TallerSessionProvider";
import {
  subscribeAndRegisterPush,
  vincularPushConTelefonoTaller,
} from "@/lib/pwa-engagement";

/**
 * En portal taller: vincula push al WhatsApp y muestra aviso si aún no hay permiso.
 */
export default function TallerNotificacionesAviso() {
  const { taller, whatsappGuardado } = useTallerSession();
  const [permiso, setPermiso] = useState<NotificationPermission>("default");
  const [vinculado, setVinculado] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!taller || !whatsappGuardado) return;
    if (typeof Notification === "undefined") return;
    setPermiso(Notification.permission);

    if (Notification.permission === "granted") {
      void vincularPushConTelefonoTaller(whatsappGuardado).then((res) => {
        if (res.ok) setVinculado(true);
      });
    }
  }, [taller, whatsappGuardado]);

  if (!taller || vinculado || permiso === "granted") return null;

  async function activar() {
    setBusy(true);
    try {
      const res = await subscribeAndRegisterPush(
        whatsappGuardado ? { telefono: whatsappGuardado } : undefined,
      );
      if (res.ok) {
        setVinculado(true);
        setPermiso("granted");
      }
    } finally {
      setBusy(false);
    }
  }

  if (permiso === "denied") {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2.5 mb-4">
        <p className="text-xs text-amber-200/90 leading-relaxed">
          Las notificaciones están bloqueadas en este navegador. Actívalas en ajustes del sitio para
          recibir avisos cuando cambie el estado de tu pedido.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-3 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <p className="text-xs text-emerald-100/90 leading-relaxed flex-1">
        Activa avisos para saber al instante cuando confirmemos, empacemos o enviemos tu pedido.
      </p>
      <Button
        type="button"
        size="sm"
        disabled={busy}
        className="bg-emerald-600 hover:bg-emerald-500 text-white shrink-0"
        onClick={() => void activar()}
      >
        <Bell className="h-4 w-4 mr-1.5" />
        {busy ? "Activando…" : "Activar avisos"}
      </Button>
    </div>
  );
}
