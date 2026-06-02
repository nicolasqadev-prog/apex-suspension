import { useEffect, useState } from "react";
import { Eye, EyeOff, ExternalLink, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifyAdminPreviewChange } from "@/components/AdminPreviewBanner";
import {
  isAdminPreviewMode,
  readPreviewBannerDraft,
  savePreviewBannerDraft,
  setAdminPreviewMode,
} from "@/lib/admin-preview";

export default function AdminSoportePwaPanel() {
  const [previewOn, setPreviewOn] = useState(false);
  const [bannerActivo, setBannerActivo] = useState(false);
  const [bannerMensaje, setBannerMensaje] = useState("");
  const [whatsappPrueba, setWhatsappPrueba] = useState("");

  useEffect(() => {
    setPreviewOn(isAdminPreviewMode());
    const draft = readPreviewBannerDraft();
    if (draft) {
      setBannerActivo(draft.activo);
      setBannerMensaje(draft.mensaje);
    }
  }, []);

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
    const w = whatsappPrueba.replace(/\D/g, "");
    if (w.length < 10) return;
    try {
      localStorage.setItem("apex.taller.whatsapp", JSON.stringify(w));
    } catch {
      // ignore
    }
    window.open("/catalogo", "_blank", "noreferrer");
  }

  return (
    <section className="rounded-xl border border-violet-500/35 bg-violet-950/20 p-5 mb-6">
      <div className="flex items-start gap-2 mb-4">
        <Smartphone className="h-5 w-5 text-violet-300 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">Soporte técnico PWA (vista previa)</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Prueba cambios en <strong className="text-gray-300">tu navegador</strong> sin que los
            clientes vean banners de prueba ni avisos de instalación. Los talleres reales sí ven lo
            que registres arriba en cuanto guardes.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/25 p-4 space-y-3 mb-4">
        <p className="text-xs font-semibold text-violet-200">Modo vista previa</p>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Actívalo en el mismo celular o PC donde revisas la web. Verás una franja morada arriba; los
          visitantes normales no la ven.
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
              Vista previa activa (tocar para apagar)
            </>
          ) : (
            <>
              <EyeOff className="h-4 w-4 mr-1.5" />
              Activar vista previa en este dispositivo
            </>
          )}
        </Button>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/25 p-4 space-y-3 mb-4">
        <p className="text-xs font-semibold text-violet-200">Banner de prueba (solo vista previa)</p>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          <input
            type="checkbox"
            checked={bannerActivo}
            onChange={(e) => setBannerActivo(e.target.checked)}
          />
          Mostrar banner de prueba cuando la vista previa esté activa
        </label>
        <Input
          value={bannerMensaje}
          onChange={(e) => setBannerMensaje(e.target.value)}
          placeholder="Ej. Mensaje de mantenimiento o promo (solo tú lo ves en previa)"
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
        <p className="text-xs font-semibold text-violet-200">Probar como taller</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={whatsappPrueba}
            onChange={(e) => setWhatsappPrueba(e.target.value)}
            placeholder="WhatsApp del taller registrado"
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
            <a href="/" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Inicio público
            </a>
          </Button>
          <Button asChild size="sm" variant="outline" className="border-gray-600 text-gray-300">
            <a href="/taller/acceso" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Login taller
            </a>
          </Button>
          <Button asChild size="sm" variant="outline" className="border-gray-600 text-gray-300">
            <a href="/catalogo" target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Catálogo
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
