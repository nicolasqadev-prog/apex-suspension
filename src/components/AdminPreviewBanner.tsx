import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";

import {
  getPreviewBannerMessage,
  isAdminPreviewMode,
  setAdminPreviewMode,
  shouldShowPreviewBanner,
} from "@/lib/admin-preview";

export default function AdminPreviewBanner() {
  const [visible, setVisible] = useState(false);
  const [bannerText, setBannerText] = useState("");

  useEffect(() => {
    const sync = () => {
      const on = isAdminPreviewMode();
      setVisible(on);
      setBannerText(shouldShowPreviewBanner() ? getPreviewBannerMessage() : "");
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("apex-admin-preview", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("apex-admin-preview", sync);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="sticky top-0 z-[250] bg-violet-700 text-white text-xs shadow-lg">
      <div className="max-w-6xl mx-auto px-3 py-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">Modo vista previa · solo equipo Apex</p>
          <p className="text-violet-100/90 mt-0.5 leading-relaxed">
            Los clientes no ven esta franja.{" "}
            <Link to="/admin" className="underline font-medium">
              Volver al panel
            </Link>
          </p>
          {bannerText && (
            <p className="mt-2 rounded bg-violet-900/60 px-2 py-1 text-[11px]">
              Banner de prueba: {bannerText}
            </p>
          )}
        </div>
        <button
          type="button"
          className="p-1 rounded hover:bg-violet-600 shrink-0"
          aria-label="Salir de vista previa"
          onClick={() => {
            setAdminPreviewMode(false);
            window.dispatchEvent(new Event("apex-admin-preview"));
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function notifyAdminPreviewChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("apex-admin-preview"));
  }
}
