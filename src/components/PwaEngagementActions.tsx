import { Bell, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  canSuggestNotifications,
  canSuggestPwaInstall,
  iosInstallMode,
  subscribeAndRegisterPush,
} from "@/lib/pwa-engagement";

type Props = {
  onRequestInstall?: () => void;
  compact?: boolean;
};

/** Botones reutilizables (p. ej. en el inicio) para instalar y activar notificaciones. */
export function PwaEngagementActions({ onRequestInstall, compact }: Props) {
  const showInstall = canSuggestPwaInstall();
  const showNotif = canSuggestNotifications();

  if (!showInstall && !showNotif) return null;

  async function onNotif() {
    await subscribeAndRegisterPush();
  }

  function onInstall() {
    if (onRequestInstall) {
      onRequestInstall();
      return;
    }
    if (iosInstallMode()) {
      window.dispatchEvent(new Event("apex-pwa-open-ios-guide"));
      return;
    }
    window.dispatchEvent(new Event("apex-pwa-request-install"));
  }

  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${compact ? "" : "mt-4"}`}>
      {showInstall && (
        <Button
          type="button"
          size={compact ? "sm" : "default"}
          variant="outline"
          className="border-[oklch(0.7_0.2_40)]/50 text-[oklch(0.7_0.2_40)] hover:bg-orange-950/30"
          onClick={onInstall}
        >
          <Download className="h-4 w-4 mr-1.5" />
          Instalar app
        </Button>
      )}
      {showNotif && (
        <Button
          type="button"
          size={compact ? "sm" : "default"}
          variant="outline"
          className="border-emerald-600/50 text-emerald-300 hover:bg-emerald-950/30"
          onClick={() => void onNotif()}
        >
          <Bell className="h-4 w-4 mr-1.5" />
          Notificaciones
        </Button>
      )}
    </div>
  );
}

/** Expone acciones globales para el banner inferior. */
export function dispatchPwaInstallRequest() {
  window.dispatchEvent(new Event("apex-pwa-request-install"));
}

export function dispatchPwaIosGuide() {
  window.dispatchEvent(new Event("apex-pwa-open-ios-guide"));
}
