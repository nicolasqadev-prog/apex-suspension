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
  adminPin: string;
  pedidos: Pedido[];
  onPedidosChange: () => void;
};

export default function AdminPushPanel({ adminPin, pedidos, onPedidosChange }: Props) {
  const [vapidOk, setVapidOk] = useState<boolean | null>(null);
  const [title, setTitle] = useState("Novedades Apex Suspensión");
  const [body, setBody] = useState("Hay actualizaciones en stock y pedidos. Abre la app para ver más.");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    estadoPushServidor().then((r) => {
      if (r.ok) setVapidOk(r.webPushConfigured);
    });
  }, []);

  async function onBroadcast() {
    setBusy("broadcast");
    setMessage(null);
    try {
      const res = await enviarNotificacionPushAdmin({
        data: { adminPin, title, body, url: "/catalogo" },
      });
      if (!res.ok) {
        setMessage(res.reason);
        return;
      }
      setMessage(
        `Enviado a ${res.sent} dispositivo(s). Fallos: ${res.failed}. Caducados: ${res.expired}.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error al enviar");
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
        data: { adminPin, pedidoId, estado, notificarCliente: notificar },
      });
      if (!res.ok) {
        setMessage(res.reason);
        return;
      }
      const push = res.push;
      let extra = "";
      if (push && "sent" in push) {
        extra = ` · Push: ${push.sent} enviado(s), ${push.matched} suscripción(es) para este teléfono.`;
      } else if (push && "skipped" in push) {
        extra = ` · Push: ${push.reason}`;
      }
      setMessage(
        `Pedido actualizado: ${res.estadoAnterior} → ${res.pedido.estado}${extra}`,
      );
      onPedidosChange();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 mb-6">
      <div className="flex items-start gap-2">
        <Bell className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Notificaciones push (PWA)</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Avisos a clientes que activaron notificaciones en la app instalada. Cambia el estado del
            pedido y opcionalmente notifica al teléfono registrado.
          </p>
          {vapidOk === false && (
            <p className="mt-2 text-xs text-amber-200/90">
              VAPID no configurado en el Worker. Ejecuta{" "}
              <code className="font-mono text-[11px]">npm run vapid:keys</code> y agrega los secretos
              en GitHub / Cloudflare (ver docs/push-notificaciones.md).
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
            className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
          />
        </label>
        <label className="text-xs text-gray-400 block sm:col-span-2">
          Mensaje (difusión a todos los suscriptores)
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
          />
        </label>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={busy !== null || vapidOk === false}
        className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white"
        onClick={() => void onBroadcast()}
      >
        <Send className="h-4 w-4 mr-1.5" />
        {busy === "broadcast" ? "Enviando…" : "Enviar a todos los suscriptores"}
      </Button>

      {pedidos.length > 0 && (
        <div className="mt-6 border-t border-white/10 pt-4">
          <p className="text-xs font-semibold text-gray-300 mb-3">Estado del pedido + aviso al cliente</p>
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
                    defaultValue={p.estado}
                    className="text-xs rounded-md border border-gray-700 bg-[oklch(0.14_0.04_250)] text-gray-200 px-2 py-2"
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
                    className="border-gray-600 text-gray-200 text-xs shrink-0"
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
        <p className="mt-3 text-xs text-gray-300 leading-relaxed" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
