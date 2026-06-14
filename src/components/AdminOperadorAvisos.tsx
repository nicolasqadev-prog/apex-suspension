import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";

import { Button } from "@/components/ui/button";
import { telefonoOperadorAdmin } from "@/lib/admin-readiness.functions";
import { probarPushOperadorAdmin } from "@/lib/push.functions";
import { subscribeAndRegisterPush, vincularPushConTelefonoTaller } from "@/lib/pwa-engagement";

const VINCULO_SESSION_KEY = "apex.admin.push.vinculado";

function withTimeout<T>(promise: Promise<T>, ms: number, mensaje: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(mensaje)), ms);
    }),
  ]);
}

type Props = {
  onVinculado?: () => void;
  compact?: boolean;
};

/**
 * Avisos push al operador (pedidos nuevos y stock bajo).
 * El WhatsApp se lee del servidor para coincidir con el envío de push.
 */
export default function AdminOperadorAvisos({ onVinculado, compact }: Props) {
  const [estado, setEstado] = useState<"idle" | "ok" | "pendiente" | "denegado" | "busy">("idle");
  const [detalle, setDetalle] = useState<string | null>(null);
  const [probando, setProbando] = useState(false);
  const [tel, setTel] = useState<string | null>(null);
  const [cargandoTel, setCargandoTel] = useState(true);

  useEffect(() => {
    setCargandoTel(true);
    void telefonoOperadorAdmin({ data: {} })
      .then((res) => {
        if (res.ok) setTel(res.telefono);
        else setTel(null);
      })
      .catch(() => setTel(null))
      .finally(() => setCargandoTel(false));
  }, []);

  useEffect(() => {
    if (cargandoTel) return;
    if (!tel) {
      setDetalle("Falta WhatsApp del operador en el servidor (APEX_ADMIN_WHATSAPP).");
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
        "Notificaciones bloqueadas. Brave → Configuración del sitio → Notificaciones → Permitir.",
      );
      return;
    }
    if (Notification.permission === "granted") {
      try {
        if (sessionStorage.getItem(VINCULO_SESSION_KEY) === tel) {
          setEstado("ok");
          setDetalle("Este dispositivo vinculado al operador. Pulsa «Probar» para confirmar.");
          return;
        }
      } catch {
        // ignore
      }
      void vincularPushConTelefonoTaller(tel).then((res) => {
        if (res.ok) {
          try {
            sessionStorage.setItem(VINCULO_SESSION_KEY, tel);
          } catch {
            // ignore
          }
          setEstado("ok");
          setDetalle("Vinculado. Pulsa «Probar» para confirmar en este dispositivo.");
          onVinculado?.();
        } else {
          setEstado("pendiente");
          setDetalle(
            res.reason === "vapid_no_configurado"
              ? "Push no configurado en servidor."
              : `Pulsa «Activar avisos»: ${res.reason}`,
          );
        }
      });
      return;
    }
    setEstado("pendiente");
    setDetalle("Pulsa «Activar avisos» — el navegador pedirá permiso una vez.");
  }, [tel, cargandoTel, onVinculado]);

  async function activar(renovar: boolean) {
    if (!tel) return;
    setEstado("busy");
    setDetalle(renovar ? "Renovando suscripción…" : "Solicitando permiso…");
    try {
      const res = await withTimeout(
        subscribeAndRegisterPush({ telefono: tel, renovar }),
        20_000,
        "Tardó demasiado. Revisa conexión y vuelve a intentar.",
      );
      if (res.ok) {
        try {
          sessionStorage.setItem(VINCULO_SESSION_KEY, tel);
        } catch {
          // ignore
        }
        setEstado("ok");
        setDetalle("Listo en este dispositivo. Pulsa «Probar» ahora.");
        onVinculado?.();
        return;
      }
      if (res.reason === "permiso_denegado") {
        setEstado("denegado");
        setDetalle(
          "Permiso denegado. Brave → Configuración del sitio → Notificaciones → Permitir.",
        );
        return;
      }
      setEstado("pendiente");
      setDetalle(res.reason);
    } catch (e) {
      setEstado("pendiente");
      setDetalle(e instanceof Error ? e.message : "No se pudo activar");
    }
  }

  async function probarAviso() {
    if (Notification.permission !== "granted") {
      setDetalle("Primero pulsa «Activar avisos» y acepta el permiso del navegador.");
      setEstado("pendiente");
      return;
    }
    setProbando(true);
    setDetalle("Enviando prueba…");
    try {
      const res = await withTimeout(
        probarPushOperadorAdmin({ data: {} }),
        15_000,
        "El servidor tardó mucho. Si llegó la notificación, ya funciona.",
      );
      if (!res.ok) {
        setDetalle(
          res.reason === "sin_telefono_admin"
            ? "Falta WhatsApp del operador en el servidor."
            : `Prueba falló: ${res.reason}`,
        );
        return;
      }
      if (res.matched === 0) {
        setDetalle(
          `Ningún dispositivo registrado para ${res.telefono}. Pulsa «Activar avisos» en este PC/celular.`,
        );
        setEstado("pendiente");
        onVinculado?.();
        return;
      }
      if (res.sent === 0) {
        setDetalle(
          `${res.matched} registro(s) pero no respondió. Pulsa «Renovar» y «Probar» otra vez.`,
        );
        setEstado("pendiente");
        return;
      }
      setEstado("ok");
      setDetalle(`Enviado a ${res.sent} dispositivo(s). Revisa la barra de notificaciones.`);
      onVinculado?.();
    } catch (e) {
      setDetalle(e instanceof Error ? e.message : "No se pudo enviar la prueba");
    } finally {
      setProbando(false);
    }
  }

  const botonesAccion = (
    <div className="grid grid-cols-2 gap-2 mt-3 sm:flex sm:flex-wrap">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-emerald-600/50 text-emerald-200 text-xs min-h-11 touch-manipulation w-full sm:w-auto"
        disabled={estado === "busy" || probando || !tel}
        onClick={() => void activar(true)}
      >
        {estado === "busy" ? "Espera…" : "Renovar"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="border-sky-600/50 text-sky-200 text-xs min-h-11 touch-manipulation w-full sm:w-auto"
        disabled={probando || estado === "busy"}
        onClick={() => void probarAviso()}
      >
        {probando ? "Enviando…" : "Probar"}
      </Button>
    </div>
  );

  if (compact && estado === "ok") {
    return <span className="text-[10px] text-emerald-300/90 hidden sm:inline">Avisos activos</span>;
  }

  if (estado === "ok" && !compact) {
    return (
      <div
        id="admin-avisos-operador"
        className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-950/25 px-3 py-3 sm:px-4 flex items-start gap-3"
      >
        <BellRing className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-100">Avisos de operador</p>
          <p className="text-xs text-emerald-200/80 mt-1 leading-relaxed break-words">{detalle}</p>
          {botonesAccion}
        </div>
      </div>
    );
  }

  if (estado === "ok" && compact) return null;

  return (
    <div
      id="admin-avisos-operador"
      className={
        compact
          ? "rounded-lg border border-orange-500/40 bg-orange-950/25 px-3 py-2"
          : "mb-4 rounded-xl border border-orange-500/40 bg-orange-950/25 px-3 py-3 sm:px-4"
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Bell className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-orange-100">Avisos al operador</p>
            {tel && (
              <p className="text-[10px] text-orange-300/70 mt-0.5">Operador ***{tel.slice(-4)}</p>
            )}
            <p className="text-xs text-orange-200/80 mt-1 leading-relaxed break-words">
              {cargandoTel
                ? "Cargando…"
                : (detalle ??
                  "Activa para saber cuando un taller pide, sin tener el panel abierto.")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {estado !== "denegado" && tel && (
            <Button
              type="button"
              size="sm"
              disabled={estado === "busy" || probando || cargandoTel}
              className="min-h-11 touch-manipulation bg-orange-600 hover:bg-orange-500 text-white font-semibold w-full sm:w-auto"
              onClick={() => void activar(false)}
            >
              {estado === "busy" ? "Activando…" : "Activar avisos"}
            </Button>
          )}
          {estado !== "denegado" && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-sky-600/50 text-sky-200 min-h-11 touch-manipulation w-full sm:w-auto"
              disabled={probando || estado === "busy"}
              onClick={() => void probarAviso()}
            >
              {probando ? "Enviando…" : "Probar aviso"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Para el botón del header: scroll al bloque de avisos. */
export function scrollToAvisosOperadorAdmin(): void {
  document
    .getElementById("admin-avisos-operador")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
