import { Link, createFileRoute } from "@tanstack/react-router";

import StudioFooterSignature from "@/components/StudioFooterSignature";

export const Route = createFileRoute("/taller/cuenta")({
  component: TallerCuentaLegacyPage,
});

function TallerCuentaLegacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <main className="max-w-md mx-auto w-full flex-1 px-4 py-16 text-center">
        <p className="text-sm text-gray-400 leading-relaxed">
          Para salir del programa o pausar la relación comercial, contacta al equipo Apex. Ellos
          gestionan el estado de tu taller desde el sistema.
        </p>
        <Link
          to="/taller"
          className="inline-flex mt-8 rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Volver al portal taller
        </Link>
      </main>
      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}
