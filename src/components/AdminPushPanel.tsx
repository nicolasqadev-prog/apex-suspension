import { useEffect, useState } from "react";
import { Bell, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  actualizarEstadoPedidoAdmin,
  enviarNotificacionPushAdmin,
  estadoPushServidor,
} from "@/lib/push.functions";

const ESTADOS = [
  "borrador",
  "cotizado",
  "confirmado",
  "empacando",
  "en_ruta",
  "entregado",
  "cancelado",
] as const;

type EstadoPedido = (typeof ESTADOS)[number];

const ETIQUETAS: Record<EstadoPedido, string> = {
  borrador: "Borrador",
  cotizado: "Cotizado",
  confirmado: "Confirmado",
  empacando: "Empacando",
  en_ruta: "En ruta",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

type Pedido = {
  id: string;
  estado: string;
  taller_nombre: string;
  telefono: string;
};

type Props = {
  pedidos: Pedido[];
  onPedidosChange: () => void;
};

export default function AdminPushPanel({ pedidos, onPedidosChange }: Props) {
  const [vapidOk, setVapidOk] = useState<boolean | null>(null);
  const [title, setTitle] = useState("Novedades Apex Suspensión");
  const [body, setBody] = useState(
    "Hay actualizaciones en stock y pedidos. Abre la app para ver más.",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fallback = window.setTimeout(() => {
      if (!cancelled) setVapidOk((v) => (v === null ? true : v));
    }, 6000);

    estadoPushServidor()
      .then((r) => {
        if (cancelled) return;
        if (r.ok) setVapidOk(r.webPushConfigured);
        else setVapidOk(false);
      })
      .catch(() => {
        if (!cancelled) setVapidOk(true);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, []);

  async function onBroadcast() {
    setBusy("broadcast");
    setMessage(null);
    try {
      const res = await enviarNotificacionPushAdmin({
        data: { title: title.trim(), body: body.trim(), url: "/catalogo" },
      });
      if (!res.ok) {
        setMessage(res.reason);
        return;
      }
      setMessage(
        `Enviado a ${res.sent} dispositivo(s). Fallos: ${res.failed}. Caducados: ${res.expired}.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error al enviar. Revisa conexión e intenta de nuevo.");
    } finally {
      setBusy(null);
    }
  }

  async function onUpdatePedido(pedidoId: string, estado: string, notificar: boolean) {
    if (!(ESTADOS as readonly string[]).includes(estado)) return;
    setBusy(pedidoId);
    setMessage(null);
    try {
      const res = await actualizarEstadoPedidoAdmin({
        data: { pedidoId, estado, notificarCliente: notificar },
      });
      if (!res.ok) {
        setMessage(res.reason);
        return;
      }
      const push = res.push;
      let extra = "";
      if (push && "sent" in push) {
        extra =
          push.matched === 0
            ? " · Push: 0 enviados — el taller no tiene avisos activados. Pídele que abra la app, entre con su WhatsApp y pulse «Activar avisos»."
            : ` · Push: ${push.sent} enviado(s), ${push.matched} suscripción(es) para este teléfono.`;
      } else if (push && "skipped" in push) {
        extra = ` · Push: ${push.reason}`;
      }
      setMessage(`Pedido actualizado: ${res.estadoAnterior} → ${res.pedido.estado}${extra}`);
      onPedidosChange();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setBusy(null);
    }
  }

  const broadcastDisabled = busy !== null || vapidOk === false;
  const broadcastLabel =
    busy === "broadcast"
      ? "Enviando…"
      : vapidOk === null
        ? "Comprobando servidor…"
        : "Enviar a todos los suscriptores";

  return (
    <section className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 mb-6">
      <div className="flex items-start gap-2">
        <Bell className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Notificaciones push (PWA)</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Difusión a todos los talleres suscritos. Cambia estado del pedido y avisa al cliente.
          </p>
          {vapidOk === false && (
            <p className="mt-2 text-xs text-amber-200/90">
              VAPID no configurado en el Worker. Revisa secretos en GitHub / Cloudflare.
            </p>
          )}
          {vapidOk === true && (
            <p className="mt-2 text-xs text-emerald-300/90">Servidor listo para enviar push.</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-gray-400 block">
          Título (difusión)
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white min-h-11"
          />
        </label>
        <label className="text-xs text-gray-400 block sm:col-span-2">
          Mensaje (difusión a todos los suscriptores)
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white min-h-11"
          />
        </label>
      </div>

      <Button
        type="button"
        size="default"
        disabled={broadcastDisabled}
        className="mt-3 w-full sm:w-auto min-h-12 touch-manipulation bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
        onClick={() => void onBroadcast()}
      >
        <Send className="h-4 w-4 mr-1.5" />
        {broadcastLabel}
      </Button>

      {pedidos.length > 0 && (
        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="text-xs font-semibold text-gray-300 mb-3">
            Estado del pedido + aviso al cliente
          </p>
          <ul className="space-y-3">
            {pedidos.map((p) => (
              <li
                key={p.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.taller_nombre}</p>
                  <p className="text-[11px] text-gray-500">{p.telefono}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    key={`${p.id}-${p.estado}`}
                    defaultValue={p.estado}
                    className="text-xs rounded-md border border-gray-700 bg-[oklch(0.14_0.04_250)] text-gray-200 px-2 py-2.5 min-h-11"
                    id={`estado-${p.id}`}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>
                        {ETIQUETAS[e]}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy !== null || vapidOk === false}
                    className="border-gray-600 text-gray-200 text-xs shrink-0 min-h-11 touch-manipulation"
                    onClick={() => {
                      const sel = document.getElementById(
                        `estado-${p.id}`,
                      ) as HTMLSelectElement | null;
                      const estado = sel?.value ?? p.estado;
                      void onUpdatePedido(p.id, estado, true);
                    }}
                  >
                    {busy === p.id ? "…" : "Guardar y notificar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {message && (
        <p
          className="mt-4 text-sm text-gray-100 leading-relaxed rounded-lg border border-white/10 bg-black/40 px-3 py-3"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </section>
  );
}
