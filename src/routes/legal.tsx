import { useEffect } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal")({
  component: LegalPage,
  head: () => ({
    meta: [
      { title: "Información legal | Apex Suspensión" },
      {
        name: "description",
        content:
          "Tratamiento de datos, términos de uso y cobertura. Apex Suspensión — repuestos y logística en la Sabana.",
      },
    ],
  }),
});

function LegalPage() {
  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.replace(/^#/, "");
      if (!id) return;
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return (
    <div className="min-h-screen bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <Link to="/" className="text-xs text-[oklch(0.7_0.2_40)] hover:text-orange-300">
            ← Inicio
          </Link>
          <h1 className="text-xl font-bold text-white mt-2">Información legal</h1>
          <p className="text-xs text-gray-500 mt-1">Apex Suspensión · última actualización 2026</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-10 text-sm leading-relaxed text-gray-300">
        <section id="datos">
          <h2 className="text-base font-bold text-white mb-3">Tratamiento de datos personales</h2>
          <p>
            Los datos que nos facilitás por este sitio o por WhatsApp (nombre del taller, teléfono,
            dirección de entrega y mensajes) se usan únicamente para cotizar, coordinar entregas y
            dar seguimiento al pedido.
          </p>
          <p className="mt-3">
            No vendemos ni compartimos tu información con terceros para publicidad. Conservamos lo
            mínimo necesario mientras dure la relación comercial o los plazos legales aplicables.
          </p>
          <p className="mt-3">
            Podés solicitar corrección o supresión de tus datos escribiéndonos por el mismo canal
            WhatsApp con el que cotizaste.
          </p>
        </section>

        <section id="terminos">
          <h2 className="text-base font-bold text-white mb-3">Términos de uso del sitio</h2>
          <p>
            El catálogo y los precios mostrados son referenciales; la disponibilidad, el precio
            final y las condiciones de pago y entrega se confirman siempre con el equipo Apex por
            WhatsApp antes de generar compromiso.
          </p>
          <p className="mt-3">
            Las marcas y referencias mencionadas pertenecen a sus titulares. Apex Suspensión es un
            distribuidor independiente.
          </p>
        </section>

        <section id="cobertura">
          <h2 className="text-base font-bold text-white mb-3">Cobertura y tiempos</h2>
          <p>
            La cobertura operativa y los tiempos de entrega dependen del municipio, la carga del día
            y la modalidad (Express con anticipo o Programado). El tiempo estimado te lo confirma el
            equipo antes de salir en ruta.
          </p>
        </section>

        <section id="garantia">
          <h2 className="text-base font-bold text-white mb-3">Garantía (resumen)</h2>
          <p>
            La garantía cubre defectos de fabricación en la pieza entregada, según evaluación del
            caso. No aplica por instalación incorrecta, uso indebido o piezas ya montadas. El
            detalle completo está en la página principal de la PWA.
          </p>
        </section>

        <p className="text-xs text-gray-500 pt-4 border-t border-white/10">
          Para cotizaciones: usá el formulario en el inicio o escribinos por WhatsApp desde el
          catálogo.
        </p>
      </main>
    </div>
  );
}
