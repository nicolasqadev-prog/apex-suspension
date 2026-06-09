import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { isAdminPreviewMode } from "@/lib/admin-preview";
import { isPwaStandalone, shouldShowPwaWelcomePreview } from "@/lib/pwa-standalone";

/** Imagen de bienvenida (reemplaza el archivo en `public/` sin tocar código). */
export const PWA_WELCOME_IMAGE_SRC = "/pwa-welcome.png";

const SESSION_KEY = "apex.pwa.welcome.shown";
const AUTO_DISMISS_MS = 2800;

type Phase = "hidden" | "visible" | "leaving";

export default function PwaWelcomeSplash() {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [imageOk, setImageOk] = useState(true);

  const dismiss = useCallback(() => {
    setPhase((current) => (current === "hidden" ? current : "leaving"));
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isAdminPreviewMode()) return;
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path.startsWith("/taller")) return;
      try {
        const raw = localStorage.getItem("apex.taller.whatsapp");
        if (raw && raw.replace(/\D/g, "").length >= 10) return;
      } catch {
        // ignore
      }
    }
    const esPwa = isPwaStandalone() || shouldShowPwaWelcomePreview();
    if (!esPwa) return;

    try {
      if (sessionStorage.getItem(SESSION_KEY) === "1" && !shouldShowPwaWelcomePreview()) {
        return;
      }
    } catch {
      // ignore
    }

    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = PWA_WELCOME_IMAGE_SRC;
    document.head.appendChild(link);

    setPhase("visible");
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      window.clearTimeout(timer);
      link.remove();
    };
  }, [dismiss]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = window.setTimeout(() => setPhase("hidden"), 450);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "hidden") return null;

  const leaving = phase === "leaving";

  return (
    <div
      role="dialog"
      aria-label="Bienvenida Apex Suspensión"
      className={`fixed inset-0 z-[200] flex flex-col bg-[oklch(0.18_0.04_250)] transition-opacity duration-500 ${
        leaving ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
      onClick={dismiss}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") dismiss();
      }}
    >
      {imageOk ? (
        <img
          src={PWA_WELCOME_IMAGE_SRC}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
          decoding="async"
          onError={() => setImageOk(false)}
        />
      ) : (
        <div
          className="absolute inset-0 bg-gradient-to-b from-[oklch(0.22_0.06_250)] via-[oklch(0.18_0.04_250)] to-black"
          aria-hidden
        />
      )}

      <div
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20"
        aria-hidden
      />

      <div className="relative mt-auto w-full max-w-lg mx-auto px-6 pb-8 pt-16 text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-[oklch(0.7_0.2_40)] font-bold">
          Apex Suspensión
        </p>
        <h1 className="mt-3 text-2xl font-extrabold text-white tracking-tight">Bienvenido</h1>
        <p className="mt-2 text-sm text-gray-300 leading-relaxed">
          Catálogo, stock y pedidos para tu taller — en un solo toque.
        </p>
        <Button
          type="button"
          className="mt-6 w-full bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-semibold"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
        >
          Entrar
        </Button>
        <p className="mt-3 text-[10px] text-gray-500">Toca en cualquier parte para continuar</p>
      </div>
    </div>
  );
}
