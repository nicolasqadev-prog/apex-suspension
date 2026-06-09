import { useCallback, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Bell, Download, Share, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  canSuggestNotifications,
  canSuggestPwaInstall,
  hideEngagementForSession,
  isIosSafari,
  shouldShowEngagementPrompt,
  snoozeEngagementPrompt,
  subscribeAndRegisterPush,
} from "@/lib/pwa-engagement";
import { isAdminPreviewMode } from "@/lib/admin-preview";
import { isPwaStandalone } from "@/lib/pwa-standalone";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function PwaEngagementPrompt() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState<"install" | "notif" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const enFlujoTaller =
      pathname.startsWith("/taller") ||
      (typeof window !== "undefined" &&
        Boolean(localStorage.getItem("apex.taller.whatsapp")?.replace(/\D/g, "").length));
    const show =
      !isAdminPreviewMode() &&
      !enFlujoTaller &&
      shouldShowEngagementPrompt() &&
      (canSuggestPwaInstall() || canSuggestNotifications()) &&
      !pathname.startsWith("/admin");
    setVisible(show);
    if (typeof Notification !== "undefined") {
      setNotifPermission(Notification.permission);
    }
  }, [pathname]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onRequestInstall = () => void onInstallClick();
    const onIosGuide = () => setIosGuideOpen(true);

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("apex-pwa-request-install", onRequestInstall);
    window.addEventListener("apex-pwa-open-ios-guide", onIosGuide);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("apex-pwa-request-install", onRequestInstall);
      window.removeEventListener("apex-pwa-open-ios-guide", onIosGuide);
    };
    // onInstallClick is stable enough for this bridge from landing buttons
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredPrompt]);

  const needsInstall = canSuggestPwaInstall();
  const needsNotif = canSuggestNotifications() && notifPermission !== "granted";

  if (!visible || (!needsInstall && !needsNotif)) return null;

  async function onInstallClick() {
    setFeedback(null);
    if (deferredPrompt) {
      setBusy("install");
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
          refresh();
        }
      } finally {
        setBusy(null);
      }
      return;
    }
    if (isIosSafari() || /iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setIosGuideOpen(true);
      return;
    }
    setFeedback("En Chrome o Edge: menú ⋮ → Instalar aplicación o Agregar a pantalla de inicio.");
  }

  async function onNotificationsClick() {
    setFeedback(null);
    if (!("Notification" in window)) {
      setFeedback("Tu navegador no admite notificaciones.");
      return;
    }
    setBusy("notif");
    try {
      if (!import.meta.env.PROD && !isPwaStandalone()) {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (!reg) {
          setFeedback("En producción, activa la app instalada para recibir avisos.");
        }
      }

      const reg = await subscribeAndRegisterPush();
      setNotifPermission(typeof Notification !== "undefined" ? Notification.permission : "denied");

      if (reg.ok) {
        setFeedback("Listo. Te avisaremos de stock, pedidos y novedades de Apex.");
        refresh();
      } else if (reg.reason === "permiso_denegado") {
        setNotifPermission("denied");
        setFeedback(
          "Bloqueaste las notificaciones. En ajustes del navegador puedes volver a activarlas para Apex.",
        );
      } else if (reg.reason === "vapid_no_configurado") {
        setFeedback(
          "El servidor aún no tiene activado el envío de avisos. Mientras tanto puedes escribirnos por WhatsApp.",
        );
      } else {
        setFeedback(reg.reason);
      }
    } finally {
      setBusy(null);
    }
  }

  function onHideSession() {
    hideEngagementForSession();
    setVisible(false);
  }

  function onSnoozeDay() {
    snoozeEngagementPrompt(24);
    setVisible(false);
  }

  return (
    <>
      <div
        className="fixed bottom-0 inset-x-0 z-[90] px-3 pb-3 pointer-events-none"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        role="region"
        aria-label="Instalar aplicación y notificaciones"
      >
        <div className="pointer-events-auto mx-auto max-w-lg rounded-xl border border-white/15 bg-[oklch(0.14_0.04_250)]/95 backdrop-blur-md shadow-2xl p-4 text-gray-200">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">Aprovecha Apex al máximo</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Instala la app en tu celular y activa avisos de stock, pedidos y novedades.
              </p>
            </div>
            <button
              type="button"
              aria-label="Cerrar sugerencia"
              className="shrink-0 p-1 text-gray-500 hover:text-white"
              onClick={onHideSession}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            {needsInstall && (
              <Button
                type="button"
                size="sm"
                disabled={busy !== null}
                className="flex-1 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-semibold"
                onClick={() => void onInstallClick()}
              >
                <Download className="h-4 w-4 mr-1.5 shrink-0" />
                {busy === "install" ? "Abriendo…" : "Instalar en el celular"}
              </Button>
            )}
            {needsNotif && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== null}
                className="flex-1 border-emerald-600/60 text-emerald-100 hover:bg-emerald-950/40"
                onClick={() => void onNotificationsClick()}
              >
                <Bell className="h-4 w-4 mr-1.5 shrink-0" />
                {busy === "notif" ? "Activando…" : "Activar notificaciones"}
              </Button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px]">
            <button
              type="button"
              className="text-gray-500 hover:text-gray-300"
              onClick={onHideSession}
            >
              Ahora no
            </button>
            <span className="text-gray-700" aria-hidden>
              ·
            </span>
            <button
              type="button"
              className="text-gray-500 hover:text-gray-300"
              onClick={onSnoozeDay}
            >
              Recordar mañana
            </button>
          </div>

          {feedback && (
            <p className="mt-2 text-[11px] text-amber-200/90 leading-relaxed" role="status">
              {feedback}
            </p>
          )}
        </div>
      </div>

      <Sheet open={iosGuideOpen} onOpenChange={setIosGuideOpen}>
        <SheetContent
          side="bottom"
          className="bg-[oklch(0.14_0.04_250)] border-gray-800 text-gray-200 rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle className="text-white flex items-center gap-2">
              <Share className="h-5 w-5 text-[oklch(0.7_0.2_40)]" />
              Instalar en iPhone
            </SheetTitle>
            <SheetDescription className="text-gray-400 text-left space-y-3 pt-2">
              <p>
                1. Toca el botón <strong className="text-gray-200">Compartir</strong> (cuadrado con
                flecha).
              </p>
              <p>
                2. Elige <strong className="text-gray-200">Agregar a inicio</strong> o{" "}
                <strong className="text-gray-200">Añadir a pantalla de inicio</strong>.
              </p>
              <p>
                3. Confirma con <strong className="text-gray-200">Agregar</strong>.
              </p>
              <p className="text-xs text-gray-500">
                Desde la app instalada podrás activar notificaciones con el botón de arriba.
              </p>
            </SheetDescription>
          </SheetHeader>
          <Button
            className="mt-4 w-full bg-[oklch(0.7_0.2_40)] hover:bg-orange-600"
            onClick={() => setIosGuideOpen(false)}
          >
            Entendido
          </Button>
        </SheetContent>
      </Sheet>
    </>
  );
}
