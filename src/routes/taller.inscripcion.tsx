import { Link, createFileRoute } from "@tanstack/react-router";

import StudioFooterSignature from "@/components/StudioFooterSignature";

/** Ruta legacy: el alta es solo desde admin Apex. */
export const Route = createFileRoute("/taller/inscripcion")({
  component: TallerInscripcionLegacyPage,
});

function TallerInscripcionLegacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <main className="max-w-md mx-auto w-full flex-1 px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-white">Alta de talleres</h1>
        <p className="text-sm text-gray-400 mt-4 leading-relaxed">
          El registro en el programa lo hace el equipo Apex durante la visita. Cuando queden
          certificados, entren con su WhatsApp en el portal del taller.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/taller/acceso"
            className="inline-flex justify-center rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Entrar con mi WhatsApp
          </Link>
          <Link to="/taller" className="text-sm text-gray-500 hover:text-white">
            Volver al portal taller
          </Link>
        </div>
      </main>
      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}
