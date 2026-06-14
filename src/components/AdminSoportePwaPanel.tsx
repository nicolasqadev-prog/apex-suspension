import { useEffect, useState } from "react";
import { Eye, EyeOff, ExternalLink, Presentation, Rocket, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifyAdminPreviewChange } from "@/components/AdminPreviewBanner";
import {
  isAdminPreviewMode,
  readPreviewBannerDraft,
  savePreviewBannerDraft,
  setAdminPreviewMode,
} from "@/lib/admin-preview";
import {
  ADMIN_PREPARACION_EVENT,
  isModoPreparacion,
  setModoPreparacion,
} from "@/lib/admin-preparacion";
import {
  estadoModoDemostracionAdmin,
  limpiarPedidosPruebaAdmin,
  publicarOperacionVivoAdmin,
  restablecerStockBodegaAdmin,
  toggleModoDemostracionAdmin,
} from "@/lib/admin-operacion.functions";
import { guardarWhatsappTallerEnCliente } from "@/lib/taller-whatsapp";

type Props = {
  onPreparacionChange?: () => void;
};

export default function AdminSoportePwaPanel({ onPreparacionChange }: Props) {
  const [preparacionOn, setPreparacionOn] = useState(false);
  const [previewOn, setPreviewOn] = useState(false);
  const [bannerActivo, setBannerActivo] = useState(false);
  const [bannerMensaje, setBannerMensaje] = useState("");
  const [whatsappPrueba, setWhatsappPrueba] = useState("");
  const [publicando, setPublicando] = useState(false);
  const [modoDemoOn, setModoDemoOn] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    setPreparacionOn(isModoPreparacion());
    setPreviewOn(isAdminPreviewMode());
    const draft = readPreviewBannerDraft();
    if (draft) {
      setBannerActivo(draft.activo);
      setBannerMensaje(draft.mensaje);
    }
    void estadoModoDemostracionAdmin({ data: {} }).then((res) => {
      if (res.ok) setModoDemoOn(res.modoDemostracion);
    });
  }, []);

  function togglePreparacion() {
    const next = !preparacionOn;
    setModoPreparacion(next);
    setPreparacionOn(next);
    if (next) setAdminPreviewMode(true);
    setPreviewOn(next || isAdminPreviewMode());
    notifyAdminPreviewChange();
    onPreparacionChange?.();
    window.dispatchEvent(new Event(ADMIN_PREPARACION_EVENT));
    setMensaje(
      next
        ? "Modo preparación activo: talleres nuevos quedan en borrador y los pedidos de talleres no publicados son de prueba."
        : "Modo preparación apagado. Los cambios de talleres se guardan en vivo si los publicas al guardar.",
    );
  }

  async function onPublicarOperacion() {
    if (
      !window.confirm(
        "¿Publicar a operación en vivo?\n\n· Los talleres en borrador podrán entrar en /taller/acceso.\n· Se borrarán los pedidos marcados como prueba.\n\nLos clientes reales no verán esos pedidos de prueba.",
      )
    ) {
      return;
    }
    setPublicando(true);
    setMensaje(null);
    try {
      const res = await publicarOperacionVivoAdmin({
        data: { limpiarPedidosPrueba: true },
      });
      if (!res.ok) {
        setMensaje(res.reason);
        return;
      }
      setModoPreparacion(false);
      setPreparacionOn(false);
      onPreparacionChange?.();
      window.dispatchEvent(new Event(ADMIN_PREPARACION_EVENT));
      setMensaje(
        `Operación en vivo: ${res.talleresPublicados} taller(es) publicado(s), ${res.pedidosPruebaEliminados} pedido(s) de prueba eliminado(s).`,
      );
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo publicar");
    } finally {
      setPublicando(false);
    }
  }

  async function toggleModoDemo() {
    setDemoBusy(true);
    setMensaje(null);
    try {
      const res = await toggleModoDemostracionAdmin({
        data: { activo: !modoDemoOn },
      });
      if (!res.ok) {
        setMensaje(res.reason);
        return;
      }
      setModoDemoOn(res.modoDemostracion);
      setMensaje(
        res.modoDemostracion
          ? "Modo demostración ACTIVO: los talleres certificados pueden hacer pedidos de prueba sin descontar stock."
          : "Modo demostración apagado. Los pedidos vuelven a ser operación real.",
      );
    } finally {
      setDemoBusy(false);
    }
  }

  async function onRestablecerStock() {
    if (
      !window.confirm(
        "¿Restablecer stock de bodega según inventario-vivo.json?\n\nCorrige unidades descontadas en demos.",
      )
    ) {
      return;
    }
    setDemoBusy(true);
    setMensaje(null);
    try {
      const res = await restablecerStockBodegaAdmin({ data: {} });
      if (!res.ok) {
        setMensaje(res.reason);
        return;
      }
      setMensaje(
        `Stock restablecido: ${res.ajustados} referencia(s) corregida(s)${res.omitidos ? `, ${res.omitidos} omitida(s)` : ""}.`,
      );
    } finally {
      setDemoBusy(false);
    }
  }

  async function onLimpiarPedidosPrueba() {
    setDemoBusy(true);
    setMensaje(null);
    try {
      const res = await limpiarPedidosPruebaAdmin({ data: {} });
      if (!res.ok) {
        setMensaje(res.reason);
        return;
      }
      setMensaje(`Eliminados ${res.eliminados} pedido(s) de prueba.`);
    } finally {
      setDemoBusy(false);
    }
  }

  function togglePreview() {
    const next = !previewOn;
    setAdminPreviewMode(next);
    setPreviewOn(next);
    notifyAdminPreviewChange();
  }

  function guardarBannerBorrador() {
    savePreviewBannerDraft({
      activo: bannerActivo,
      mensaje: bannerMensaje,
    });
    notifyAdminPreviewChange();
  }

  function abrirComoTaller() {
    const w = guardarWhatsappTallerEnCliente(whatsappPrueba);
    if (w.length < 10) {
      setMensaje("Ingresa un WhatsApp válido (mínimo 10 dígitos).");
      return;
    }
    setModoPreparacion(true);
    setPreparacionOn(true);
    onPreparacionChange?.();
    window.dispatchEvent(new Event(ADMIN_PREPARACION_EVENT));
    setMensaje(`Modo preparación activo. Abriendo catálogo como ${w}…`);
    window.open("/catalogo", "_blank", "noreferrer");
  }

  return (
    <section className="rounded-xl border border-violet-500/35 bg-violet-950/20 p-5 mb-6 space-y-4">
      <div className="flex items-start gap-2">
        <Smartphone className="h-5 w-5 text-violet-300 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">
            Soporte y preparación antes de operación
          </p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Configura talleres, haz pedidos de prueba y revisa la PWA{" "}
            <strong className="text-gray-300">sin afectar clientes reales</strong>. Cuando todo esté
            listo, publica a operación en vivo.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/40 bg-amber-950/25 p-4 space-y-3">
        <p className="text-xs font-semibold text-amber-200">
          Modo preparación (borrador operativo)
        </p>
        <ul className="text-[11px] text-gray-400 space-y-1 list-disc pl-4">
          <li>
            Talleres que registres quedan en <strong className="text-gray-300">borrador</strong> (no
            entran en /taller/acceso).
          </li>
          <li>
            Pedidos desde talleres en borrador se guardan como{" "}
            <strong className="text-gray-300">prueba</strong> (sin push al cliente).
          </li>
          <li>En el panel solo verás pedidos de prueba mientras esté activo.</li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={togglePreparacion}
            className={
              preparacionOn
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-white"
            }
          >
            {preparacionOn ? "Preparación activa (tocar para apagar)" : "Activar modo preparación"}
          </Button>
          <Button
            type="button"
            onClick={() => void onPublicarOperacion()}
            disabled={publicando}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <Rocket className="h-4 w-4 mr-1.5" />
            {publicando ? "Publicando…" : "Publicar a operación en vivo"}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-orange-500/45 bg-orange-950/30 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Presentation className="h-4 w-4 text-orange-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-orange-100">
              Demostraciones en campo (clientes reales)
            </p>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              Activa esto <strong className="text-gray-300">antes</strong> de mostrar la PWA a un
              taller certificado. Verán catálogo, precios y pedido completo, pero{" "}
              <strong className="text-orange-200">no se descuenta stock real</strong>.
            </p>
          </div>
        </div>
        <ol className="text-[11px] text-gray-400 space-y-1 list-decimal pl-4">
          <li>Activa modo demostración aquí.</li>
          <li>El taller entra con su WhatsApp en /taller/acceso (como siempre).</li>
          <li>Muestra catálogo, carrito y envío de pedido — aparece aviso ámbar en el banner.</li>
          <li>Al terminar: apaga demostración, restablece stock y limpia pedidos de prueba.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={demoBusy}
            onClick={() => void toggleModoDemo()}
            className={
              modoDemoOn
                ? "bg-orange-600 hover:bg-orange-500 text-white"
                : "bg-gray-700 hover:bg-gray-600 text-white"
            }
          >
            {modoDemoOn ? "Demostración activa (apagar)" : "Activar modo demostración"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={demoBusy}
            className="border-emerald-600 text-emerald-200"
            onClick={() => void onRestablecerStock()}
          >
            Restablecer stock bodega
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={demoBusy}
            className="border-gray-600 text-gray-300"
            onClick={() => void onLimpiarPedidosPrueba()}
          >
            Limpiar pedidos de prueba
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/25 p-4 space-y-3">
        <p className="text-xs font-semibold text-violet-200">
          Vista previa visual (solo tu navegador)
        </p>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Franja morada, ocultar avisos de instalar/notificaciones y banner de prueba. No cambia lo
          que ven los clientes.
        </p>
        <Button
          type="button"
          onClick={togglePreview}
          className={
            previewOn
              ? "bg-violet-600 hover:bg-violet-500 text-white"
              : "bg-gray-700 hover:bg-gray-600 text-white"
          }
        >
          {previewOn ? (
            <>
              <Eye className="h-4 w-4 mr-1.5" />
              Vista previa activa
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4 mr-1.5" />
              Activar vista previa visual
            </>
          )}
        </Button>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/25 p-4 space-y-3">
        <p className="text-xs font-semibold text-violet-200">
          Banner de prueba (solo vista previa)
        </p>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={bannerActivo}
            onChange={(e) => setBannerActivo(e.target.checked)}
          />
          Mostrar banner cuando la vista previa esté activa
        </label>
        <Input
          value={bannerMensaje}
          onChange={(e) => setBannerMensaje(e.target.value)}
          placeholder="Ej. Mensaje de mantenimiento (solo tú lo ves)"
          className="bg-[oklch(0.14_0.04_250)] border-gray-700 text-white text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-violet-600 text-violet-200"
          onClick={guardarBannerBorrador}
        >
          Guardar borrador de banner
        </Button>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/25 p-4 space-y-3">
        <p className="text-xs font-semibold text-violet-200">
          Probar catálogo como taller (borrador)
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={whatsappPrueba}
            onChange={(e) => setWhatsappPrueba(e.target.value)}
            placeholder="WhatsApp del taller (activo, puede estar en borrador)"
            className="bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
          />
          <Button
            type="button"
            className="shrink-0 bg-emerald-600 hover:bg-emerald-500"
            onClick={abrirComoTaller}
          >
            Abrir catálogo taller
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="border-gray-600 text-gray-300">
            <a href="/taller/acceso" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Login taller (solo publicados)
            </a>
          </Button>
        </div>
      </div>

      {mensaje && (
        <p className="text-xs text-gray-300 leading-relaxed" role="status">
          {mensaje}
        </p>
      )}
    </section>
  );
}
