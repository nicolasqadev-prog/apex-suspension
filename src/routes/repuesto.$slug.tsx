import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import TallerBanner from "@/components/TallerBanner";
import { useTallerSession } from "@/components/TallerSessionProvider";
import type { PiezaInventario } from "@/lib/inventario";
import { obtenerPiezaCatalogoPublico } from "@/lib/catalogo.public.functions";
import { canonicalHref } from "@/lib/site-url";
import { formatoPrecioCop } from "@/lib/formato-cop";
import { agregarAlCarritoTaller } from "@/lib/taller-carrito";
import { allowTallerBorradorEnCliente } from "@/lib/admin-preparacion";
import { obtenerPiezaTaller } from "@/lib/taller.portal.functions";
import type { PiezaCatalogoTaller } from "@/lib/taller.types";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import StudioFooterSignature from "@/components/StudioFooterSignature";
import PiezaCatalogoImagen from "@/components/PiezaCatalogoImagen";

export const Route = createFileRoute("/repuesto/$slug")({
  loader: ({ params }) => obtenerPiezaCatalogoPublico({ data: { slug: params.slug } }),
  staleTime: 0,
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

function RepuestoDetallePage() {
  const { pieza: piezaPublica, moneda } = Route.useLoaderData();
  const { taller, whatsappGuardado } = useTallerSession();
  const slug = Route.useParams().slug;
  const router = useRouter();
  const [piezaTaller, setPiezaTaller] = useState<PiezaCatalogoTaller | null>(null);
  const [piezaRescate, setPiezaRescate] = useState<PiezaInventario | null>(null);
  const [rescatando, setRescatando] = useState(false);

  useEffect(() => {
    if (!taller || !whatsappGuardado || !slug) {
      setPiezaTaller(null);
      return;
    }
    let cancelled = false;
    obtenerPiezaTaller({
      data: {
        whatsapp: whatsappGuardado,
        slug,
        allowNoPublicado: allowTallerBorradorEnCliente(),
      },
    }).then((res) => {
      if (cancelled) return;
      if (res.ok) setPiezaTaller(res.pieza);
      else setPiezaTaller(null);
    });
    return () => {
      cancelled = true;
    };
  }, [taller, whatsappGuardado, slug]);

  useEffect(() => {
    if (piezaPublica || !slug) {
      setPiezaRescate(null);
      return;
    }
    let cancelled = false;
    setRescatando(true);
    obtenerPiezaCatalogoPublico({ data: { slug } })
      .then((res) => {
        if (cancelled) return;
        if (res.pieza) setPiezaRescate(res.pieza);
      })
      .finally(() => {
        if (!cancelled) setRescatando(false);
      });
    return () => {
      cancelled = true;
    };
  }, [piezaPublica, slug]);

  const pieza = piezaTaller ?? piezaRescate ?? piezaPublica;
  const precioTaller = piezaTaller?.precioTaller;

  if (!pieza) {
    return (
      <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200">
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
          {rescatando ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-[oklch(0.7_0.2_40)] mb-4" />
              <p className="text-gray-300 text-sm">Cargando referencia…</p>
            </>
          ) : (
            <>
              <p className="text-white font-semibold">No encontramos esa referencia.</p>
              <Button asChild className="mt-6 bg-[oklch(0.7_0.2_40)]">
                <Link to="/catalogo">Ir al catálogo</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="mt-3 border-gray-600 text-gray-300"
                onClick={() => void router.invalidate()}
              >
                Reintentar
              </Button>
            </>
          )}
        </div>
        <StudioFooterSignature pinBottom />
      </div>
    );
  }

  const mensajeWhatsapp = [
    `Hola Apex Suspensión,`,
    `necesito cotizar / confirmar disponibilidad:`,
    `Referencia: ${pieza.referencia}`,
    `Pieza: ${pieza.nombre}`,
    `Aplicación: ${pieza.aplicacion}`,
    precioTaller != null
      ? `Precio taller (referencia web): ${formatoPrecioCop(precioTaller)} ${moneda}`
      : `Precio lista (referencia web): ${formatoPrecioCop(pieza.precioLista)} ${moneda}`,
    `Stock según web: ${pieza.stock}`,
    ``,
    `Nombre: `,
  ].join("\n");

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <header className="border-b border-white/10 px-4 py-4 shrink-0">
        <div className="max-w-lg mx-auto">
          <Link to="/catalogo" className="text-xs text-gray-500 hover:text-[oklch(0.7_0.2_40)]">
            ← Catálogo
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto w-full flex-1 px-4 py-8">
        <TallerBanner />
        <PiezaCatalogoImagen nombre={pieza.nombre} imagenUrl={pieza.imagenUrl} className="mb-4" />
        <p className="text-xs font-mono text-[oklch(0.7_0.2_40)]">{pieza.referencia}</p>
        <h1 className="text-2xl font-bold text-white mt-1">{pieza.nombre}</h1>
        <p className="text-gray-400 mt-2">{pieza.aplicacion}</p>
        <p className="text-xs text-gray-500 mt-2">{pieza.categoria}</p>

        <div className="mt-8 rounded-lg border border-gray-800 bg-[oklch(0.14_0.04_250)] p-4 space-y-2">
          {precioTaller != null ? (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-emerald-400/90">Precio taller</span>
                <span className="font-semibold text-emerald-200 text-right">
                  {formatoPrecioCop(precioTaller)}
                  <span className="block text-[10px] font-normal text-gray-500">c/u</span>
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Precio lista</span>
                <span className="text-gray-500 line-through text-right">
                  {formatoPrecioCop(pieza.precioLista)}
                  <span className="block text-[10px] font-normal no-underline">c/u</span>
                </span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Precio lista</span>
              <span className="font-semibold text-white text-right">
                {formatoPrecioCop(pieza.precioLista)}
                <span className="block text-[10px] font-normal text-gray-500">c/u</span>
              </span>
            </div>
          )}
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
          {taller && precioTaller != null && (
            <Button
              type="button"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              onClick={() => {
                agregarAlCarritoTaller({
                  slug: pieza.slug,
                  referencia: pieza.referencia,
                  nombre: pieza.nombre,
                  precioUnitarioCop: precioTaller,
                  precioListaPublicoCop: pieza.precioLista,
                  stock: pieza.stock,
                });
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar al pedido taller
            </Button>
          )}
          <Button
            asChild
            className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold"
          >
            <a href={enlaceWhatsApp(mensajeWhatsapp)} target="_blank" rel="noreferrer">
              Pedir por WhatsApp
            </a>
          </Button>
          {taller && (
            <Button asChild variant="outline" className="border-emerald-600/50 text-emerald-200">
              <Link to="/taller/pedido">Ver carrito y enviar pedido</Link>
            </Button>
          )}
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

      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}
