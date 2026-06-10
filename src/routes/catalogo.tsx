import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Package, Plus, Search } from "lucide-react";

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
  ordenarBajoPedido,
  ordenarPiezas,
  particionarPorBodega,
  type OrdenCatalogo,
} from "@/lib/catalogo-filtros";
import { formatoPrecioCop } from "@/lib/formato-cop";
import { agregarAlCarritoTaller } from "@/lib/taller-carrito";
import { allowTallerBorradorEnCliente } from "@/lib/admin-preparacion";
import { obtenerCatalogoTaller } from "@/lib/taller.portal.functions";
import type { PiezaCatalogoTaller } from "@/lib/taller.types";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import StudioFooterSignature from "@/components/StudioFooterSignature";
import { useIsMobile } from "@/hooks/use-mobile";

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

const POR_PAGINA_MOVIL = 6;
const POR_PAGINA_ESCRITORIO = 12;

function paginar<T>(items: T[], pagina: number, porPagina: number) {
  const totalPaginas = Math.max(1, Math.ceil(items.length / porPagina));
  const paginaSegura = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (paginaSegura - 1) * porPagina;
  return {
    items: items.slice(inicio, inicio + porPagina),
    pagina: paginaSegura,
    totalPaginas,
    total: items.length,
  };
}

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
  const { piezas: piezasPublicas, moneda } = Route.useLoaderData();
  const isMobile = useIsMobile();
  const porPagina = isMobile ? POR_PAGINA_MOVIL : POR_PAGINA_ESCRITORIO;
  const { taller, whatsappGuardado: whatsappTaller } = useTallerSession();
  const [piezasTaller, setPiezasTaller] = useState<PiezaCatalogoTaller[] | null>(null);
  const [fuenteTaller, setFuenteTaller] = useState<"supabase" | "json" | null>(null);
  const [cargandoTaller, setCargandoTaller] = useState(false);
  const [q, setQ] = useState("");
  const [marcaVehiculo, setMarcaVehiculo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [orden, setOrden] = useState<OrdenCatalogo>("stock-desc");
  const [verBajoPedido, setVerBajoPedido] = useState(false);
  const [paginaBodega, setPaginaBodega] = useState(1);
  const [paginaBajoPedido, setPaginaBajoPedido] = useState(1);
  const seccionBodegaRef = useRef<HTMLElement | null>(null);
  const seccionBajoPedidoRef = useRef<HTMLElement | null>(null);

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
    const partes = particionarPorBodega(filtradas);
    return {
      bodega: ordenarPiezas(partes.bodega, orden, q, precioMostrar),
      bajoPedido: ordenarBajoPedido(partes.bajoPedido, orden, q, precioMostrar),
    };
  }, [piezasBase, filtros, orden, q]);

  useEffect(() => {
    setPaginaBodega(1);
    setPaginaBajoPedido(1);
  }, [q, marcaVehiculo, categoria, orden, porPagina]);

  const bodegaPag = useMemo(
    () => paginar(bodega, paginaBodega, porPagina),
    [bodega, paginaBodega, porPagina],
  );
  const bajoPedidoPag = useMemo(
    () => paginar(bajoPedido, paginaBajoPedido, porPagina),
    [bajoPedido, paginaBajoPedido, porPagina],
  );

  useEffect(() => {
    if (paginaBodega !== bodegaPag.pagina) setPaginaBodega(bodegaPag.pagina);
  }, [paginaBodega, bodegaPag.pagina]);

  useEffect(() => {
    if (paginaBajoPedido !== bajoPedidoPag.pagina) setPaginaBajoPedido(bajoPedidoPag.pagina);
  }, [paginaBajoPedido, bajoPedidoPag.pagina]);

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
              {cargandoTaller ? " · cargando precio taller…" : ""}
            </p>
          </div>
          {!taller && (
            <Link
              to="/taller"
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 shrink-0"
            >
              Portal taller →
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

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("apex:mostrador:open"))}
          className="mb-6 inline-flex text-xs text-gray-500 text-left"
        >
          ¿No encuentras lo que buscas o no sabes qué pieza es?
          <span className="ml-1 font-semibold text-[oklch(0.7_0.2_40)] hover:text-orange-300">
            → Te orientamos con el asistente
          </span>
        </button>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4 text-xs">
          <label className="flex flex-col gap-1 text-gray-500 sm:col-span-1">
            <span className="font-medium text-gray-400">Marca del vehículo</span>
            <select
              value={marcaVehiculo}
              onChange={(e) => setMarcaVehiculo(e.target.value)}
              className="rounded-md border border-gray-700 bg-[oklch(0.14_0.04_250)] text-gray-200 px-2 py-2"
            >
              <option value="">Todas</option>
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
            <section ref={seccionBodegaRef} className="mb-8">
              <div className="mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-400">
                  En bodega · despacho inmediato
                </h2>
              </div>
              {bodega.length > 0 ? (
                <>
                  <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                    {bodegaPag.items.map((p) => (
                      <PiezaCard key={p.slug} p={p} moneda={moneda} taller={!!taller} />
                    ))}
                  </ul>
                  <CatalogoPaginacion
                    compacto={isMobile}
                    pagina={bodegaPag.pagina}
                    totalPaginas={bodegaPag.totalPaginas}
                    onAnterior={() => {
                      setPaginaBodega((p) => Math.max(1, p - 1));
                      seccionBodegaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    onSiguiente={() => {
                      setPaginaBodega((p) => Math.min(bodegaPag.totalPaginas, p + 1));
                      seccionBodegaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    onIrAPagina={(n) => {
                      setPaginaBodega(n);
                      seccionBodegaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  />
                </>
              ) : (
                <p className="text-sm text-gray-500 rounded-lg border border-dashed border-gray-700 px-4 py-6 text-center">
                  {filtrosActivos
                    ? "Nada en bodega con esos filtros. Revisa el catálogo bajo pedido abajo o ajusta la búsqueda."
                    : "No hay piezas con stock en bodega en este momento."}
                </p>
              )}
            </section>

            <section ref={seccionBajoPedidoRef}>
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
                      Ocultar
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Ver bajo pedido
                    </>
                  )}
                </Button>
              </div>

              {mostrarBajoPedido && bajoPedido.length > 0 && (
                <>
                  <ul className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
                    {bajoPedidoPag.items.map((p) => (
                      <PiezaCard key={p.slug} p={p} moneda={moneda} taller={!!taller} bajoPedido />
                    ))}
                  </ul>
                  <CatalogoPaginacion
                    compacto={isMobile}
                    pagina={bajoPedidoPag.pagina}
                    totalPaginas={bajoPedidoPag.totalPaginas}
                    onAnterior={() => {
                      setPaginaBajoPedido((p) => Math.max(1, p - 1));
                      seccionBajoPedidoRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                    onSiguiente={() => {
                      setPaginaBajoPedido((p) => Math.min(bajoPedidoPag.totalPaginas, p + 1));
                      seccionBajoPedidoRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                    onIrAPagina={(n) => {
                      setPaginaBajoPedido(n);
                      seccionBajoPedidoRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                  />
                </>
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

type PaginaMarcador = number | "ellipsis";

function marcasPaginacion(pagina: number, totalPaginas: number): PaginaMarcador[] {
  if (totalPaginas <= 7) {
    return Array.from({ length: totalPaginas }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, totalPaginas, pagina, pagina - 1, pagina + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= totalPaginas).sort((a, b) => a - b);
  const out: PaginaMarcador[] = [];
  for (let i = 0; i < nums.length; i++) {
    if (i > 0 && nums[i] - nums[i - 1] > 1) out.push("ellipsis");
    out.push(nums[i]);
  }
  return out;
}

function CatalogoPaginacion({
  compacto,
  pagina,
  totalPaginas,
  onAnterior,
  onSiguiente,
  onIrAPagina,
}: {
  compacto: boolean;
  pagina: number;
  totalPaginas: number;
  onAnterior: () => void;
  onSiguiente: () => void;
  onIrAPagina: (pagina: number) => void;
}) {
  if (totalPaginas <= 1) return null;

  if (compacto) {
    return (
      <nav
        aria-label="Paginación del catálogo"
        className="mt-5 flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-3"
      >
        <p className="text-xs text-gray-400 text-center">
          Página <span className="font-semibold text-white">{pagina}</span> de{" "}
          <span className="font-semibold text-white">{totalPaginas}</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-gray-600 text-gray-300 h-11"
            disabled={pagina <= 1}
            onClick={onAnterior}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-gray-600 text-gray-300 h-11"
            disabled={pagina >= totalPaginas}
            onClick={onSiguiente}
          >
            Siguiente
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </nav>
    );
  }

  const marcas = marcasPaginacion(pagina, totalPaginas);

  return (
    <nav
      aria-label="Paginación del catálogo"
      className="mt-5 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-3"
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-gray-600 text-gray-300"
        disabled={pagina <= 1}
        onClick={onAnterior}
      >
        <ChevronLeft className="h-4 w-4 mr-0.5" />
        Anterior
      </Button>

      <div className="flex items-center gap-1">
        {marcas.map((marca, idx) =>
          marca === "ellipsis" ? (
            <span key={`e-${idx}`} className="px-1 text-gray-500 select-none">
              …
            </span>
          ) : (
            <Button
              key={marca}
              type="button"
              size="sm"
              variant={marca === pagina ? "default" : "ghost"}
              className={
                marca === pagina
                  ? "min-w-9 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white"
                  : "min-w-9 text-gray-400 hover:text-white"
              }
              onClick={() => marca !== pagina && onIrAPagina(marca)}
              aria-current={marca === pagina ? "page" : undefined}
            >
              {marca}
            </Button>
          ),
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-gray-600 text-gray-300"
        disabled={pagina >= totalPaginas}
        onClick={onSiguiente}
      >
        Siguiente
        <ChevronRight className="h-4 w-4 ml-0.5" />
      </Button>
    </nav>
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
    <li className="min-h-0">
      <div
        className={`h-full rounded-lg border bg-[oklch(0.14_0.04_250)] overflow-hidden hover:border-[oklch(0.7_0.2_40)]/50 transition-colors ${
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
                {p.stock > 0 ? "Disponible" : "Bajo pedido"}
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
                  precioListaPublicoCop: p.precioLista,
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
