import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ADMIN_PREPARACION_EVENT,
  isModoPreparacion,
  setModoPreparacion,
} from "@/lib/admin-preparacion";
import {
  checklistEstadoAdmin,
  type AdminReadinessServidor,
} from "@/lib/admin-readiness.functions";
import { scrollToAvisosOperadorAdmin } from "@/components/AdminOperadorAvisos";

type Props = {
  adminPin: string;
  onIrSoporte?: () => void;
  /** Incrementar tras activar push para refrescar contadores. */
  refreshKey?: number;
};

type ItemEstado = "ok" | "warn" | "fail";

type CheckItem = {
  id: string;
  label: string;
  detalle: string;
  estado: ItemEstado;
  accion?: { label: string; onClick: () => void };
};

function badge(estado: ItemEstado) {
  if (estado === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (estado === "warn") return <CircleAlert className="h-4 w-4 text-amber-400 shrink-0" />;
  return <CircleAlert className="h-4 w-4 text-red-400 shrink-0" />;
}

export default function AdminDemoChecklist({ adminPin, onIrSoporte, refreshKey = 0 }: Props) {
  const [servidor, setServidor] = useState<AdminReadinessServidor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modoPrep, setModoPrep] = useState(false);
  const [notifPermiso, setNotifPermiso] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [expandido, setExpandido] = useState(false);

  const leerCliente = useCallback(() => {
    setModoPrep(isModoPreparacion());
    if (typeof Notification === "undefined") setNotifPermiso("unsupported");
    else setNotifPermiso(Notification.permission);
  }, []);

  const cargar = useCallback(async () => {
    if (!adminPin) return;
    setLoading(true);
    setError(null);
    leerCliente();
    try {
      const res = await checklistEstadoAdmin({ data: { adminPin } });
      if (!res.ok) {
        setError(res.reason);
        setServidor(null);
        return;
      }
      setServidor(res.estado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo comprobar el estado");
      setServidor(null);
    } finally {
      setLoading(false);
    }
  }, [adminPin, leerCliente]);

  useEffect(() => {
    void cargar();
    leerCliente();
    const onPrep = () => leerCliente();
    window.addEventListener(ADMIN_PREPARACION_EVENT, onPrep);
    return () => window.removeEventListener(ADMIN_PREPARACION_EVENT, onPrep);
  }, [cargar, leerCliente, refreshKey]);

  const items = useMemo((): CheckItem[] => {
    if (!servidor) return [];

    const lista: CheckItem[] = [
      {
        id: "supabase",
        label: "Base de datos en vivo",
        detalle: servidor.supabaseVivo
          ? `${servidor.totalProductos} refs · ${servidor.conStock} con stock`
          : servidor.catalogoFuente === "json"
            ? "Usando JSON de ejemplo (sin Supabase)"
            : "Catálogo vacío o sin conectar",
        estado: servidor.supabaseVivo ? "ok" : "fail",
      },
      {
        id: "operacion",
        label: "Operación en vivo (servidor)",
        detalle: servidor.operacionVivo
          ? "Build de producción activo"
          : "Staging: borrador permitido en servidor",
        estado: servidor.operacionVivo ? "ok" : "warn",
      },
      {
        id: "prep",
        label: "Modo preparación (este navegador)",
        detalle: modoPrep
          ? "ACTIVO — solo verás pedidos de prueba"
          : "Apagado — operación real",
        estado: modoPrep ? "fail" : "ok",
        accion: modoPrep
          ? {
              label: "Apagar preparación",
              onClick: () => {
                setModoPreparacion(false);
                leerCliente();
              },
            }
          : undefined,
      },
      {
        id: "pin",
        label: "PIN admin en servidor",
        detalle: servidor.adminPinServidor
          ? "Configurado"
          : "Falta ADMIN_PIN en Cloudflare/GitHub",
        estado: servidor.adminPinServidor ? "ok" : "fail",
      },
      {
        id: "vapid",
        label: "Push VAPID",
        detalle: servidor.vapidOk ? "Claves configuradas" : "Faltan secretos VAPID",
        estado: servidor.vapidOk ? "ok" : "fail",
      },
      {
        id: "wa-sync",
        label: "WhatsApp build = servidor",
        detalle: servidor.whatsappBuildCoincide
          ? `Operador ${servidor.adminWhatsappMascara ?? ""}`
          : `Desfase: servidor ${servidor.adminWhatsappMascara ?? "—"} ≠ build. Revisa secretos GitHub.`,
        estado: servidor.whatsappBuildCoincide ? "ok" : "fail",
      },
      {
        id: "wa",
        label: "WhatsApp operador (servidor)",
        detalle: servidor.adminWhatsappOk
          ? `Push se envía a ${servidor.adminWhatsappMascara ?? ""}`
          : "Falta APEX_ADMIN_WHATSAPP / WHATSAPP_APEX",
        estado: servidor.adminWhatsappOk ? "ok" : "fail",
      },
      {
        id: "push-srv",
        label: "Dispositivos registrados (todos)",
        detalle:
          servidor.pushSuscripcionesOperador > 0
            ? `${servidor.pushSuscripcionesOperador} en total (puede ser otro celular)`
            : "Ningún dispositivo registrado aún",
        estado:
          servidor.pushSuscripcionesOperador > 0 && notifPermiso === "granted"
            ? "ok"
            : servidor.pushSuscripcionesOperador > 0
              ? "warn"
              : "warn",
        accion: { label: "Activar aquí", onClick: () => scrollToAvisosOperadorAdmin() },
      },
      {
        id: "push-local",
        label: "Este dispositivo (permiso)",
        detalle:
          notifPermiso === "granted"
            ? "Permiso OK — pulsa Activar avisos abajo si aún no probaste"
            : notifPermiso === "denied"
              ? "Bloqueadas — Brave → Configuración del sitio → Permitir"
              : notifPermiso === "unsupported"
                ? "Navegador sin soporte"
                : "Pulsa «Activar avisos» abajo (no solo Probar)",
        estado:
          notifPermiso === "granted" ? "ok" : notifPermiso === "denied" ? "fail" : "warn",
        accion:
          notifPermiso !== "granted"
            ? { label: "Activar avisos", onClick: () => scrollToAvisosOperadorAdmin() }
            : undefined,
      },
      {
        id: "talleres",
        label: "Talleres certificados",
        detalle:
          servidor.talleresPublicados > 0
            ? `${servidor.talleresPublicados} publicado(s) · ${servidor.talleresActivos} activo(s)`
            : "Ningún taller publicado para demo",
        estado: servidor.talleresPublicados > 0 ? "ok" : "warn",
        accion:
          servidor.talleresPublicados === 0 && onIrSoporte
            ? { label: "Soporte PWA", onClick: onIrSoporte }
            : undefined,
      },
    ];

    return lista;
  }, [servidor, modoPrep, notifPermiso, onIrSoporte, leerCliente]);

  const resumen = useMemo(() => {
    const fails = items.filter((i) => i.estado === "fail").length;
    const warns = items.filter((i) => i.estado === "warn").length;
    const ok = items.filter((i) => i.estado === "ok").length;
    const listo = fails === 0 && warns === 0;
    return { fails, warns, ok, listo, total: items.length };
  }, [items]);

  useEffect(() => {
    if (!resumen.listo && resumen.fails > 0) setExpandido(true);
  }, [resumen.listo, resumen.fails]);

  if (loading && !servidor) {
    return (
      <p className="mb-4 text-xs text-gray-500 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
        Comprobando estado para demo…
      </p>
    );
  }

  if (error && !servidor) {
    return (
      <p className="mb-4 text-xs text-red-300 rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2">
        Checklist: {error}
      </p>
    );
  }

  return (
    <section
      className={`mb-4 rounded-xl border px-3 py-3 sm:px-4 ${
        resumen.listo
          ? "border-emerald-500/40 bg-emerald-950/20"
          : resumen.fails > 0
            ? "border-red-500/35 bg-red-950/15"
            : "border-amber-500/35 bg-amber-950/15"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="flex-1 text-left min-w-0"
          onClick={() => setExpandido((e) => !e)}
        >
          <p className="text-sm font-semibold text-white">
            {resumen.listo ? "Listo para demo" : "Checklist antes de demo"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {resumen.ok}/{resumen.total} OK
            {resumen.warns > 0 && ` · ${resumen.warns} aviso(s)`}
            {resumen.fails > 0 && ` · ${resumen.fails} pendiente(s)`}
          </p>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 px-2 border-white/15 text-gray-300"
            disabled={loading}
            onClick={() => void cargar()}
            title="Actualizar checklist"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-white"
            onClick={() => setExpandido((e) => !e)}
            aria-expanded={expandido}
          >
            {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expandido && (
        <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-xs">
              {badge(item.estado)}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-200">{item.label}</p>
                <p className="text-gray-500 mt-0.5 leading-snug">{item.detalle}</p>
                {item.accion && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-1.5 h-8 text-[11px] border-white/20 text-gray-300"
                    onClick={item.accion.onClick}
                  >
                    {item.accion.label}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
