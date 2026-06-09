import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Package, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TallerBanner from "@/components/TallerBanner";
import { useTallerSession } from "@/components/TallerSessionProvider";
import { loadCatalogo } from "@/lib/inventario.server";
import { canonicalHref } from "@/lib/site-url";
import type { PiezaInventario } from "@/lib/inventario";
import {
  categoriasOpciones,
  categoriaDePieza,
  filtrarPiezas,
  hayFiltrosActivos,
  marcasVehiculoOpciones,
  marcaVehiculoDePieza,
  ordenarPiezas,
  particionarPorBodega,
  type OrdenCatalogo,
} from "@/lib/catalogo-filtros";
import { formatoPrecioCop } from "@/lib/formato-cop";
import { agregarAlCarritoTaller } from "@/lib/taller-carrito";
import { allowTallerBorradorEnCliente } from "@/lib/admin-preparacion";
import { obtenerCatalogoTaller } from "@/lib/taller.portal.functions";
import type { PiezaCatalogoTaller } from "@/lib/taller.types";
import { enlaceWhatsApp, mensajeConfirmacionCotizacion } from "@/lib/whatsapp";
import { usePersistentState } from "@/lib/usePersistentState";
import StudioFooterSignature from "@/components/StudioFooterSignature";

export const Route = createFileRoute("/catalogo")({
  loader: () => loadCatalogo(),
  component: CatalogoPage,
  head: () => {
    const href = canonicalHref("/catalogo");
    return {
      meta: [
        { title: "Catálogo de repuestos | Apex Suspensión" },
        {
          name: "description",
          content:
            "Consulta referencias, marcas de vehículo, stock en bodega y precio de lista. Apex Suspensión.",
        },
      ],
      links: href ? [{ rel: "canonical", href }] : [],
    };
  },
});

type PiezaVista = PiezaInventario & { precioTaller?: number };

function precioMostrar(p: PiezaVista): number {
  return p.precioTaller ?? p.precioLista;
}

function mensajeConsultaStock(p: PiezaInventario, moneda: string): string {
  return [
    "Hola Apex Suspensión,",
    "necesito consultar disponibilidad o alternativo:",
    `Referencia: ${p.referencia}`,
    `Pieza: ${p.nombre}`,
    `Vehículo: ${marcaVehiculoDePieza(p)}`,
    `Aplicación: ${p.aplicacion}`,
    `Precio lista (referencia web): ${formatoPrecioCop(p.precioLista)} ${moneda}`,
    "",
    "Nombre:",
  ].join("\n");
}

function CatalogoPage() {
  const { piezas: piezasPublicas, moneda, fuente } = Route.useLoaderData();
  const { taller, whatsappGuardado: whatsappTaller } = useTallerSession();
  const [piezasTaller, setPiezasTaller] = useState<PiezaCatalogoTaller[] | null>(null);
  const [fuenteTaller, setFuenteTaller] = useState<"supabase" | "json" | null>(null);
  const [cargandoTaller, setCargandoTaller] = useState(false);
  const [q, setQ] = useState("");
  const [whatsappGuardado] = usePersistentState("apex.whatsapp", "");
  const [marcaVehiculo, setMarcaVehiculo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [orden, setOrden] = useState<OrdenCatalogo>("stock-desc");
  const [verBajoPedido, setVerBajoPedido] = useState(false);

  useEffect(() => {
    if (!taller || !whatsappTaller) {
      setPiezasTaller(null);
      setFuenteTaller(null);
      return;
    }
    let cancelled = false;
    setCargandoTaller(true);
    obtenerCatalogoTaller({
      data: {
        whatsapp: whatsappTaller,
        allowNoPublicado: allowTallerBorradorEnCliente(),
      },
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setPiezasTaller(res.piezas);
          setFuenteTaller(res.fuente);
        } else {
          setPiezasTaller(null);
          setFuenteTaller(null);
        }
      })
      .finally(() => {
        if (!cancelled) setCargandoTaller(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taller, whatsappTaller]);

  const piezasBase: PiezaVista[] = useMemo(() => {
    if (taller) {
      if (piezasTaller) return piezasTaller;
      return [];
    }
    return piezasPublicas;
  }, [piezasPublicas, piezasTaller, taller]);

  const totalBodega = useMemo(() => piezasBase.filter((p) => p.stock > 0).length, [piezasBase]);

  const marcasOpts = useMemo(() => marcasVehiculoOpciones(piezasBase), [piezasBase]);
  const categoriasOpts = useMemo(() => categoriasOpciones(piezasBase), [piezasBase]);

  const filtros = useMemo(
    () => ({
      q,
      marcaVehiculo,
      marcaProducto: "",
      categoria,
      lineaVehiculo: "todos" as const,
      stockFiltro: "todos" as const,
    }),
    [q, marcaVehiculo, categoria],
  );

  const filtrosActivos = hayFiltrosActivos(filtros);

  const { bodega, bajoPedido } = useMemo(() => {
    const filtradas = filtrarPiezas(piezasBase, filtros);
    const ordenar = (lista: PiezaVista[]) => ordenarPiezas(lista, orden, q, precioMostrar);
    const partes = particionarPorBodega(filtradas);
    return {
      bodega: ordenar(partes.bodega),
      bajoPedido: ordenar(partes.bajoPedido),
    };
  }, [piezasBase, filtros, orden, q]);

  /** Colapsado por defecto; se abre al buscar/filtrar o al pulsar "Ver bajo pedido". */
  const mostrarBajoPedido = verBajoPedido || filtrosActivos;

  const sinResultados = bodega.length === 0 && (!mostrarBajoPedido || bajoPedido.length === 0);

  const listaCargando = taller && cargandoTaller;
  const listaError = taller && !cargandoTaller && piezasTaller === null;

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <header className="border-b border-white/10 px-4 py-4 shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mt-1 text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Package className="h-6 w-6 text-[oklch(0.7_0.2_40)]" />
              Catálogo
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {taller ? "Precio taller" : "Precio público"} · {moneda}
              {taller && !cargandoTaller && fuenteTaller === "supabase" && (
                <span className="text-emerald-400/90"> · sesión taller activa</span>
              )}
              {!taller && (
                <span className="text-gray-400">
                  {" "}
                  · {totalBodega} en bodega · {piezasBase.length.toLocaleString("es-CO")}{" "}
                  referencias
                  {fuente === "json" ? (
                    <span className="text-amber-500/90"> · modo demo (sin Supabase)</span>
                  ) : null}
                </span>
              )}
              {cargandoTaller ? " · cargando precio taller…" : ""}
            </p>
          </div>
          {!taller && (
            <Link
              to="/taller/acceso"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 shrink-0"
            >
              Acceso taller →
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full flex-1 px-4 py-8">
        <TallerBanner />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por referencia, nombre, vehículo o categoría…"
            className="pl-10 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
          />
        </div>

        <a
          href={enlaceWhatsApp(
            mensajeConfirmacionCotizacion({
              pieza:
                "Estoy en el catálogo y no encuentro la pieza. ¿Me pueden orientar para cotizar? Yo confirmo el diagnóstico con mi mecánico.",
              whatsapp: whatsappGuardado,
            }),
          )}
          target="_blank"
          rel="noreferrer"
          className="mb-6 inline-flex text-xs text-gray-500"
        >
          ¿No encuentras lo que buscas o no sabes qué pieza es?
          <span className="ml-1 font-semibold text-[oklch(0.7_0.2_40)] hover:text-orange-300">
            → Escríbenos y te orientamos
          </span>
        </a>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 text-xs">
          <label className="flex flex-col gap-1 text-gray-500 sm:col-span-1">
            <span className="font-medium text-gray-400">Marca del vehículo</span>
            <select
              value={marcaVehiculo}
              onChange={(e) => setMarcaVehiculo(e.target.value)}
              className="rounded-md border border-gray-700 bg-[oklch(0.14_0.04_250)] text-gray-200 px-2 py-2"
            >
              <option value="">Todas ({marcasOpts.length})</option>
              {marcasOpts.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-gray-500 sm:col-span-1">
            <span className="font-medium text-gray-400">Categoría</span>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="rounded-md border border-gray-700 bg-[oklch(0.14_0.04_250)] text-gray-200 px-2 py-2"
            >
              <option value="">Todas</option>
              {categoriasOpts.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-gray-500 sm:col-span-1">
            <span className="font-medium text-gray-400">Orden</span>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as OrdenCatalogo)}
              className="rounded-md border border-gray-700 bg-[oklch(0.14_0.04_250)] text-gray-200 px-2 py-2"
            >
              <option value="stock-desc">Más stock primero</option>
              <option value="relevancia">Relevancia (con búsqueda)</option>
              <option value="precio-asc">Precio ↑</option>
              <option value="precio-desc">Precio ↓</option>
            </select>
          </label>
        </div>
        <p className="text-[10px] text-gray-600 mb-6">
          Primero ves lo que hay <span className="text-gray-500">en bodega</span>. El catálogo bajo
          pedido solo aparece si buscás o abrís esa sección.
        </p>

        {listaCargando && (
          <p className="text-center text-sm text-emerald-200/80 py-12">
            Cargando catálogo con tu precio de taller…
          </p>
        )}

        {listaError && (
          <p className="text-center text-sm text-red-300/90 py-12">
            No pudimos cargar tu catálogo de taller. Cierra sesión e ingresa de nuevo en{" "}
            <Link to="/taller/acceso" className="text-emerald-400 underline">
              acceso taller
            </Link>
            .
          </p>
        )}

        {!listaCargando && !listaError && (
          <>
            <section className="mb-8">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-400">
                  En bodega · despacho inmediato
                </h2>
                <span className="text-xs text-gray-500">
                  {bodega.length} resultado{bodega.length === 1 ? "" : "s"}
                </span>
              </div>
              {bodega.length > 0 ? (
                <ul className="space-y-3">
                  {bodega.map((p) => (
                    <PiezaCard key={p.slug} p={p} moneda={moneda} taller={!!taller} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 rounded-lg border border-dashed border-gray-700 px-4 py-6 text-center">
                  {filtrosActivos
                    ? "Nada en bodega con esos filtros. Revisa el catálogo bajo pedido abajo o ajusta la búsqueda."
                    : "No hay piezas con stock en bodega en este momento."}
                </p>
              )}
            </section>

            <section>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">
                    Catálogo bajo pedido
                  </h2>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Referencias del proveedor sin stock físico · se confirma por WhatsApp
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-300 shrink-0"
                  onClick={() => setVerBajoPedido((v) => !v)}
                >
                  {mostrarBajoPedido ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Ocultar ({bajoPedido.length})
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Ver bajo pedido ({bajoPedido.length})
                    </>
                  )}
                </Button>
              </div>

              {mostrarBajoPedido && bajoPedido.length > 0 && (
                <ul className="space-y-3">
                  {bajoPedido.map((p) => (
                    <PiezaCard key={p.slug} p={p} moneda={moneda} taller={!!taller} bajoPedido />
                  ))}
                </ul>
              )}

              {mostrarBajoPedido && bajoPedido.length === 0 && (
                <p className="text-sm text-gray-500 py-6 text-center">
                  No hay referencias bajo pedido con esos filtros.
                </p>
              )}
            </section>

            {sinResultados && (
              <p className="text-center text-gray-500 py-12">
                No hay resultados para esa búsqueda.
              </p>
            )}
          </>
        )}

        <div className="mt-10 text-center flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="outline" className="border-gray-600 text-gray-300">
            <Link to="/">Inicio</Link>
          </Button>
          <Button asChild variant="outline" className="border-gray-600 text-gray-300">
            <a href="/legal#datos">Información legal</a>
          </Button>
        </div>
      </main>

      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}

function PiezaCard({
  p,
  moneda,
  taller,
  bajoPedido = false,
}: {
  p: PiezaVista;
  moneda: string;
  taller: boolean;
  bajoPedido?: boolean;
}) {
  const catGrupo = categoriaDePieza(p);

  return (
    <li>
      <div
        className={`rounded-lg border bg-[oklch(0.14_0.04_250)] overflow-hidden hover:border-[oklch(0.7_0.2_40)]/50 transition-colors ${
          bajoPedido ? "border-gray-800/80 opacity-95" : "border-emerald-900/40"
        }`}
      >
        <Link to="/repuesto/$slug" params={{ slug: p.slug }} className="block p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-gray-400">
                {marcaVehiculoDePieza(p)}
                {catGrupo ? ` · ${catGrupo}` : ""}
              </p>
              <p className="text-xs font-mono text-[oklch(0.7_0.2_40)] break-all">{p.referencia}</p>
              <p className="font-semibold text-white">{p.nombre}</p>
              {p.aplicacion !== p.nombre && (
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">{p.aplicacion}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              {p.precioTaller != null ? (
                <>
                  <p className="text-[10px] uppercase tracking-wide text-emerald-400/80">
                    Precio taller
                  </p>
                  <p className="text-sm font-bold text-emerald-200">
                    {formatoPrecioCop(p.precioTaller)}
                  </p>
                  <p className="text-[10px] text-gray-500 line-through">
                    Público {formatoPrecioCop(p.precioLista)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[10px] uppercase tracking-wide text-gray-500">
                    Precio público
                  </p>
                  <p className="text-sm font-bold text-white">{formatoPrecioCop(p.precioLista)}</p>
                </>
              )}
              <p
                className={`text-xs mt-1 font-medium ${p.stock > 0 ? "text-emerald-400" : "text-amber-500/90"}`}
              >
                {p.stock > 0 ? `${p.stock} en bodega` : "Bajo pedido"}
              </p>
            </div>
          </div>
        </Link>
        {taller && p.precioTaller != null && (
          <div className="px-4 pb-4 pt-0 border-t border-white/5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-emerald-600/50 text-emerald-200 hover:bg-emerald-950/50"
              onClick={() => {
                agregarAlCarritoTaller({
                  slug: p.slug,
                  referencia: p.referencia,
                  nombre: p.nombre,
                  precioUnitarioCop: p.precioTaller!,
                  stock: p.stock,
                });
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar al pedido
            </Button>
          </div>
        )}
        {p.stock <= 0 && !taller && (
          <div className="px-4 pb-4 pt-0 border-t border-white/5">
            <a
              href={enlaceWhatsApp(mensajeConsultaStock(p, moneda))}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-xs font-semibold text-[oklch(0.7_0.2_40)] hover:text-orange-300"
            >
              Consultar llegada o alternativo por WhatsApp →
            </a>
          </div>
        )}
      </div>
    </li>
  );
}
