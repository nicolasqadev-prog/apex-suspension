import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Package, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TallerBanner from "@/components/TallerBanner";
import { useTallerSession } from "@/components/TallerSessionProvider";
import { loadCatalogo } from "@/lib/inventario.server";
import { canonicalHref } from "@/lib/site-url";
import type { PiezaInventario } from "@/lib/inventario";
import { marcaInfo } from "@/lib/marcas";
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
            "Consulta referencias, marcas, stock y precio de lista. KTC, Corven, Nakata, MOOG, SABO y más. Apex Suspensión.",
        },
      ],
      links: href ? [{ rel: "canonical", href }] : [],
    };
  },
});

type OrdenCatalogo = "relevancia" | "precio-asc" | "precio-desc" | "stock-desc";

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
    `Marca: ${p.marca}`,
    `Aplicación: ${p.aplicacion}`,
    `Precio lista (referencia web): ${formatoPrecioCop(p.precioLista)} ${moneda}`,
    "",
    "Nombre:",
  ].join("\n");
}

function CatalogoPage() {
  const { piezas: piezasPublicas, moneda } = Route.useLoaderData();
  const { taller, whatsappGuardado: whatsappTaller } = useTallerSession();
  const [piezasTaller, setPiezasTaller] = useState<PiezaCatalogoTaller[] | null>(null);
  const [fuenteTaller, setFuenteTaller] = useState<"supabase" | "json" | null>(null);
  const [cargandoTaller, setCargandoTaller] = useState(false);
  const [q, setQ] = useState("");
  const [whatsappGuardado] = usePersistentState("apex.whatsapp", "");
  const [marca, setMarca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [stockFiltro, setStockFiltro] = useState<"todos" | "con-stock">("todos");
  const [orden, setOrden] = useState<OrdenCatalogo>("relevancia");

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

  const marcasOpts = useMemo(() => {
    const set = new Set(piezasBase.map((p) => p.marca));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [piezasBase]);

  const categoriasOpts = useMemo(() => {
    const set = new Set(piezasBase.map((p) => p.categoria).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [piezasBase]);

  const piezas = useMemo(() => {
    const qn = q.trim().toLowerCase();
    let list = qn
      ? piezasBase.filter((p) => {
          const blob =
            `${p.marca} ${p.referencia} ${p.nombre} ${p.aplicacion} ${p.categoria}`.toLowerCase();
          return blob.includes(qn);
        })
      : piezasBase;
    if (marca) list = list.filter((p) => p.marca === marca);
    if (categoria) list = list.filter((p) => p.categoria === categoria);
    if (stockFiltro === "con-stock") list = list.filter((p) => p.stock > 0);

    if (orden === "relevancia" && qn) {
      list = [...list].sort((a, b) => scoreRelevancia(a, qn) - scoreRelevancia(b, qn));
    } else if (orden === "precio-asc") {
      list = [...list].sort((a, b) => precioMostrar(a) - precioMostrar(b));
    } else if (orden === "precio-desc") {
      list = [...list].sort((a, b) => precioMostrar(b) - precioMostrar(a));
    } else if (orden === "stock-desc") {
      list = [...list].sort((a, b) => b.stock - a.stock);
    }

    return list;
  }, [piezasBase, q, marca, categoria, stockFiltro, orden]);

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
              Stock y precios · {moneda}
              {taller && !cargandoTaller && fuenteTaller === "supabase" && (
                <span className="text-emerald-400/90"> · catálogo en vivo (base de datos)</span>
              )}
              {taller && !cargandoTaller && fuenteTaller === "json" && (
                <span className="text-amber-400/90"> · datos de ejemplo (sin Supabase en servidor)</span>
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
            placeholder="Buscar por referencia, nombre, marca, vehículo o categoría…"
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 text-xs">
          <label className="flex flex-col gap-1 text-gray-500">
            <span className="font-medium text-gray-400">Marca</span>
            <select
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
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
          <label className="flex flex-col gap-1 text-gray-500">
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
          <label className="flex flex-col gap-1 text-gray-500">
            <span className="font-medium text-gray-400">Stock</span>
            <select
              value={stockFiltro}
              onChange={(e) => setStockFiltro(e.target.value as "todos" | "con-stock")}
              className="rounded-md border border-gray-700 bg-[oklch(0.14_0.04_250)] text-gray-200 px-2 py-2"
            >
              <option value="todos">Todos</option>
              <option value="con-stock">Con stock</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-gray-500">
            <span className="font-medium text-gray-400">Orden</span>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as OrdenCatalogo)}
              className="rounded-md border border-gray-700 bg-[oklch(0.14_0.04_250)] text-gray-200 px-2 py-2"
            >
              <option value="relevancia">Relevancia (con búsqueda)</option>
              <option value="precio-asc">Precio ↑</option>
              <option value="precio-desc">Precio ↓</option>
              <option value="stock-desc">Más stock</option>
            </select>
          </label>
        </div>

        {taller && cargandoTaller && (
          <p className="text-center text-sm text-emerald-200/80 py-12">
            Cargando catálogo con tu precio de taller…
          </p>
        )}

        {taller && !cargandoTaller && piezasTaller === null && (
          <p className="text-center text-sm text-red-300/90 py-12">
            No pudimos cargar tu catálogo de taller. Cierra sesión e ingresa de nuevo en{" "}
            <Link to="/taller/acceso" className="text-emerald-400 underline">
              acceso taller
            </Link>
            .
          </p>
        )}

        <ul className="space-y-3">
          {piezas.map((p) => (
            <li key={p.slug}>
              <div className="rounded-lg border border-gray-800 bg-[oklch(0.14_0.04_250)] overflow-hidden hover:border-[oklch(0.7_0.2_40)]/50 transition-colors">
                <Link to="/repuesto/$slug" params={{ slug: p.slug }} className="block p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400">
                        {p.marca}
                        {marcaInfo(p.marca)?.descripcionCorta
                          ? ` · ${marcaInfo(p.marca)!.descripcionCorta}`
                          : ""}
                      </p>
                      <p className="text-xs font-mono text-[oklch(0.7_0.2_40)]">{p.referencia}</p>
                      <p className="font-semibold text-white">{p.nombre}</p>
                      <p className="text-sm text-gray-400 mt-1">{p.aplicacion}</p>
                      <p className="text-xs text-gray-500 mt-1">{p.categoria}</p>
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
                            Lista {formatoPrecioCop(p.precioLista)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-bold text-white">
                          {formatoPrecioCop(p.precioLista)}
                        </p>
                      )}
                      <p
                        className={`text-xs mt-1 ${p.stock > 0 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {p.stock > 0 ? `${p.stock} en stock` : "Sin stock"}
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
          ))}
        </ul>

        {piezas.length === 0 && !(taller && cargandoTaller) && !(taller && !cargandoTaller && piezasTaller === null) && (
          <p className="text-center text-gray-500 py-12">No hay resultados para esa búsqueda.</p>
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

function scoreRelevancia(p: PiezaInventario, q: string): number {
  const ref = p.referencia.toLowerCase();
  const nom = p.nombre.toLowerCase();
  if (ref === q) return 0;
  if (ref.startsWith(q)) return 1;
  if (ref.includes(q)) return 2;
  if (nom.startsWith(q)) return 3;
  if (nom.includes(q)) return 4;
  return 5;
}
