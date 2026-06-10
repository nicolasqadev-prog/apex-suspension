import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTallerSession } from "@/components/TallerSessionProvider";
import StudioFooterSignature from "@/components/StudioFooterSignature";
import { desvincularTallerPropio } from "@/lib/taller.inscripcion.functions";

export const Route = createFileRoute("/taller/cuenta")({
  component: TallerCuentaPage,
});

function TallerCuentaPage() {
  const navigate = useNavigate();
  const { taller, whatsappGuardado, logout } = useTallerSession();
  const [confirmacion, setConfirmacion] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!taller && !listo) {
      void navigate({ to: "/taller/acceso" });
    }
  }, [taller, listo, navigate]);

  async function onDesvincular(e: FormEvent) {
    e.preventDefault();
    if (!whatsappGuardado || !confirmacion) return;
    setEnviando(true);
    setError("");
    try {
      const res = await desvincularTallerPropio({
        data: { whatsapp: whatsappGuardado, confirmacion: true },
      });
      if (!res.ok) {
        if (res.reason === "rate_limit") {
          setError("Demasiados intentos. Espera unos minutos.");
          return;
        }
        setError("No pudimos procesar la salida. Escríbenos por WhatsApp.");
        return;
      }
      setListo(true);
      logout();
      void navigate({ to: "/taller" });
    } finally {
      setEnviando(false);
    }
  }

  if (!taller && !listo) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-md mx-auto">
          <Link to="/catalogo" className="text-xs text-gray-500 hover:text-[oklch(0.7_0.2_40)]">
            ← Catálogo
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto w-full flex-1 px-4 py-10">
        <div className="flex items-center gap-2 mb-2">
          <LogOut className="h-7 w-7 text-amber-400" />
          <h1 className="text-xl font-bold text-white">Salir del programa</h1>
        </div>

        {taller && (
          <>
            <p className="text-sm text-gray-400 leading-relaxed">
              Taller: <strong className="text-white">{taller.nombreTaller}</strong>
              <br />
              WhatsApp: <span className="font-mono text-gray-300">{whatsappGuardado}</span>
            </p>
            <p className="mt-4 text-sm text-gray-500 leading-relaxed">
              Si la prueba no les convence, pueden desvincularse aquí. Dejan de ver precio taller y
              no podrán armar pedidos con su número. Apex puede reactivarlos después si cambian de
              opinión.
            </p>

            <form onSubmit={onDesvincular} className="mt-8 space-y-4">
              <label className="flex items-start gap-2 text-sm text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmacion}
                  onChange={(e) => setConfirmacion(e.target.checked)}
                  className="mt-1"
                />
                <span>Confirmo que quiero salir del programa de talleres Apex.</span>
              </label>
              {error && (
                <p className="text-sm text-red-300/90" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                variant="outline"
                disabled={!confirmacion || enviando}
                className="w-full border-amber-700/60 text-amber-200 hover:bg-amber-950/40"
              >
                {enviando ? "Procesando…" : "Dejar el programa"}
              </Button>
            </form>
          </>
        )}

        <Button asChild variant="ghost" className="w-full mt-6 text-gray-400">
          <Link to="/catalogo">Cancelar y volver al catálogo</Link>
        </Button>
      </main>

      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}
