import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Download } from "lucide-react";

import { openIosInstallGuide } from "@/components/IosPwaInstallSheet";
import { iosInstallMode, shouldShowEngagementPrompt } from "@/lib/pwa-engagement";
import { isAdminPreviewMode } from "@/lib/admin-preview";
import { isPwaStandalone } from "@/lib/pwa-standalone";

const FAB_HIDE_SESSION = "apex.pwa.iosFab.hideSession";

/**
 * Botón flotante persistente en iPhone hasta instalar la PWA.
 * En /taller el banner dedicado ya guía la instalación.
 */
export default function IosInstallFab() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const ios = iosInstallMode();
    if (
      !ios ||
      isPwaStandalone() ||
      isAdminPreviewMode() ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/taller")
    ) {
      setVisible(false);
      return;
    }
    try {
      if (sessionStorage.getItem(FAB_HIDE_SESSION) === "1") {
        setVisible(false);
        return;
      }
    } catch {
      // ignore
    }
    setVisible(shouldShowEngagementPrompt());
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[85] flex justify-center px-3 pointer-events-none"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-[oklch(0.7_0.2_40)] pl-4 pr-3 py-3 text-sm font-bold text-white shadow-xl shadow-orange-950/50 ring-2 ring-white/20 animate-pulse hover:animate-none hover:bg-orange-600 active:scale-[0.98] transition-transform"
        onClick={() => openIosInstallGuide()}
      >
        <Download className="h-5 w-5 shrink-0" />
        Instalar Apex · 3 pasos
      </button>
    </div>
  );
}
