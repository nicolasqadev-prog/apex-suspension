import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

import { Button } from "@/components/ui/button";
import { openIosInstallGuide } from "@/components/IosPwaInstallSheet";
import { dispatchPwaInstallRequest } from "@/components/PwaEngagementActions";
import { canSuggestPwaInstall, iosInstallMode, isInAppBrowser } from "@/lib/pwa-engagement";
import { isPwaStandalone } from "@/lib/pwa-standalone";

const AUTO_GUIDE_KEY = "apex.pwa.ios.autoGuide.shown";

/**
 * Aviso en portal taller: instalar en pantalla de inicio (Chrome/Android/iOS).
 */
export default function TallerPwaInstalarAviso() {
  const iosMode = iosInstallMode();
  const enAppIncrustada = isInAppBrowser();

  useEffect(() => {
    if (!iosMode || isPwaStandalone()) return;
    try {
      if (sessionStorage.getItem(AUTO_GUIDE_KEY) === "1") return;
      sessionStorage.setItem(AUTO_GUIDE_KEY, "1");
    } catch {
      // ignore
    }
    const t = window.setTimeout(() => openIosInstallGuide(), 1200);
    return () => window.clearTimeout(t);
  }, [iosMode]);

  if (!canSuggestPwaInstall() || isPwaStandalone()) return null;

  function instalar() {
    if (iosMode) {
      openIosInstallGuide();
      return;
    }
    dispatchPwaInstallRequest();
  }

  return (
    <div className="rounded-xl border-2 border-[oklch(0.7_0.2_40)]/50 bg-gradient-to-br from-orange-950/40 to-[oklch(0.14_0.04_250)] px-4 py-4 flex flex-col gap-3 shadow-lg shadow-orange-950/20">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.7_0.2_40)]/20 border border-[oklch(0.7_0.2_40)]/40">
          <Download className="h-6 w-6 text-[oklch(0.7_0.2_40)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-white">
            {iosMode ? "Instala Apex en tu iPhone" : "Instala Apex en tu celular"}
          </p>
          <p className="text-xs text-orange-100/80 mt-1 leading-relaxed">
            {enAppIncrustada
              ? "Abriste desde otra app. Toca abajo para ver cómo abrir en Safari e instalar en 3 pasos."
              : iosMode
                ? "En iPhone son 3 toques en Safari (Compartir → Agregar a inicio). Te guiamos paso a paso."
                : "Acceso rápido al catálogo, pedidos y avisos cuando cambie el estado de tu pedido."}
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="lg"
        className="w-full bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-bold h-12 text-base"
        onClick={instalar}
      >
        <Download className="h-5 w-5 mr-2" />
        {iosMode ? "Ver guía · instalar en 3 pasos" : "Instalar app"}
      </Button>
      {iosMode === "safari" && (
        <p className="text-[11px] text-orange-200/70 text-center flex items-center justify-center gap-1">
          <Share className="h-3.5 w-3.5" />
          Compartir (abajo) → Agregar a inicio
        </p>
      )}
    </div>
  );
}
