import { Download, Share } from "lucide-react";

import { Button } from "@/components/ui/button";
import { canSuggestPwaInstall, isIosSafari } from "@/lib/pwa-engagement";
import { isPwaStandalone } from "@/lib/pwa-standalone";
import { dispatchPwaInstallRequest, dispatchPwaIosGuide } from "@/components/PwaEngagementActions";

/**
 * Aviso en portal taller: instalar en pantalla de inicio (Chrome/Android/iOS).
 */
export default function TallerPwaInstalarAviso() {
  if (!canSuggestPwaInstall() || isPwaStandalone()) return null;

  function instalar() {
    if (isIosSafari() || /iphone|ipad|ipod/i.test(navigator.userAgent)) {
      dispatchPwaIosGuide();
      return;
    }
    dispatchPwaInstallRequest();
  }

  return (
    <div className="rounded-xl border border-[oklch(0.7_0.2_40)]/35 bg-orange-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-orange-100">Instala Apex en tu celular</p>
        <p className="text-xs text-orange-200/75 mt-1 leading-relaxed">
          Acceso rápido al catálogo, pedidos y avisos cuando cambie el estado de tu pedido.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        className="shrink-0 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-semibold"
        onClick={instalar}
      >
        <Download className="h-4 w-4 mr-1.5" />
        Instalar app
      </Button>
      {(isIosSafari() || /iphone|ipad|ipod/i.test(navigator.userAgent)) && (
        <p className="text-[10px] text-orange-200/60 sm:hidden flex items-center gap-1">
          <Share className="h-3 w-3" /> Compartir → Agregar a inicio
        </p>
      )}
    </div>
  );
}
