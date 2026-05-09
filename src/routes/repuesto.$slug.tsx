import { Link, createFileRoute } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { loadPiezaBySlug } from "@/lib/inventario.server";
import { canonicalHref } from "@/lib/site-url";
import { enlaceWhatsApp } from "@/lib/whatsapp";

export const Route = createFileRoute("/repuesto/$slug")({
  loader: ({ params }) => loadPiezaBySlug(params.slug),
  component: RepuestoDetallePage,
  head: ({ loaderData, params }) => {
    const pieza = loaderData?.pieza;
    const title = pieza
      ? `${pieza.referencia} · ${pieza.nombre} | Apex`
      : "Repuesto no encontrado | Apex";
    const desc = pieza
      ? `${pieza.aplicacion}. Stock y cotización vía WhatsApp. Apex Suspensión.`
      : "La referencia solicitada no está en el catálogo.";
    const href = pieza ? canonicalHref(`/repuesto/${params.slug}`) : null;
    return {
      meta: [{ title }, { name: "description", content: desc }],
      links: href ? [{ rel: "canonical", href }] : [],
    };
  },
});

function formatoPrecio(cop: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cop);
}

function RepuestoDetallePage() {
  const { pieza, moneda, fuente } = Route.useLoaderData();

  if (!pieza) {
    return (
      <div className="min-h-screen bg-[oklch(0.18_0.04_250)] text-gray-200 flex flex-col items-center justify-center px-4">
        <p className="text-white font-semibold">No encontramos esa referencia.</p>
        <Button asChild className="mt-6 bg-[oklch(0.7_0.2_40)]">
          <Link to="/catalogo">Ir al catálogo</Link>
        </Button>
      </div>
    );
  }

  const mensajeWhatsapp = [
    `Hola Apex Suspensión,`,
    `necesito cotizar / confirmar disponibilidad:`,
    `Referencia: ${pieza.referencia}`,
    `Pieza: ${pieza.nombre}`,
    `Aplicación: ${pieza.aplicacion}`,
    `Precio lista (referencia web): ${formatoPrecio(pieza.precioLista)} ${moneda}`,
    `Stock según web: ${pieza.stock}`,
    ``,
    `Nombre: `,
  ].join("\n");

  return (
    <div className="min-h-screen bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <Link to="/catalogo" className="text-xs text-gray-500 hover:text-[oklch(0.7_0.2_40)]">
            ← Catálogo
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <p className="text-xs font-mono text-[oklch(0.7_0.2_40)]">{pieza.referencia}</p>
        <h1 className="text-2xl font-bold text-white mt-1">{pieza.nombre}</h1>
        <p className="text-gray-400 mt-2">{pieza.aplicacion}</p>
        <p className="text-xs text-gray-500 mt-2">{pieza.categoria}</p>

        <div className="mt-8 rounded-lg border border-gray-800 bg-[oklch(0.14_0.04_250)] p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Precio lista</span>
            <span className="font-semibold text-white">{formatoPrecio(pieza.precioLista)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Stock</span>
            <span
              className={
                pieza.stock > 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"
              }
            >
              {pieza.stock > 0 ? `${pieza.stock} unidades` : "Agotado (consultar llegada)"}
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Button
            asChild
            className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold"
          >
            <a href={enlaceWhatsApp(mensajeWhatsapp)} target="_blank" rel="noreferrer">
              Pedir por WhatsApp
            </a>
          </Button>
          {pieza.stock <= 0 && (
            <p className="text-xs text-amber-200/90 text-center leading-relaxed">
              Sin stock en catálogo: escribinos por WhatsApp para confirmar llegada, equivalente u
              otra referencia compatible.
            </p>
          )}
          <Button asChild variant="outline" className="border-gray-600 text-gray-300">
            <Link to="/catalogo">Seguir buscando</Link>
          </Button>
        </div>

        <div className="mt-10 space-y-4 rounded-xl border border-white/10 bg-black/20 p-4 text-xs text-gray-400 leading-relaxed">
          <div>
            <p className="text-sm font-semibold text-white mb-1">Compatibilidad</p>
            <p>
              Esta referencia aplica según el vehículo indicado:{" "}
              <span className="text-gray-200">{pieza.aplicacion}</span>. En WhatsApp confirmamos
              año, versión y lado (si aplica) para evitar cambios incorrectos.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">Qué incluye</p>
            <p>
              Una unidad nueva en su empaque comercial habitual para esta referencia, según
              proveedor. No incluye tornillería auxiliar ni componentes adyacentes salvo que se
              indique expresamente en la cotización.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">Qué no incluye</p>
            <p>
              Mano de obra, alineación, balanceo, lubricantes y daños por mala instalación o uso. Si
              la pieza ya fue montada o manipulada, puede afectar garantía.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-white mb-1">Garantía (resumen)</p>
            <p>
              Cubre defectos de fabricación comprobados en la pieza entregada. Avísanos por WhatsApp
              con foto o video dentro de los 7 días calendario. Respuesta en hasta 3 días hábiles.
              Detalle en la página principal y en{" "}
              <Link
                to="/legal"
                hash="garantia"
                className="text-[oklch(0.7_0.2_40)] hover:underline"
              >
                información legal
              </Link>
              .
            </p>
          </div>
        </div>

        <p className="text-[10px] text-gray-600 mt-8 text-center leading-relaxed">
          Precios y existencias son referencia. La venta definitiva la confirma el equipo Apex por
          WhatsApp.
        </p>
      </main>
    </div>
  );
}
