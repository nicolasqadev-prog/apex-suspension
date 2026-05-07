import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Package, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadCatalogo } from "@/lib/inventario.server";
import type { PiezaInventario } from "@/lib/inventario";
import { marcaInfo } from "@/lib/marcas";
import { enlaceWhatsApp } from "@/lib/whatsapp";

export const Route = createFileRoute("/catalogo")({
  loader: () => loadCatalogo(),
  component: CatalogoPage,
  head: () => ({
    meta: [
      { title: "Catálogo de repuestos | Apex Suspensión" },
      {
        name: "description",
        content:
          "Consulta referencias, marcas, stock y precio de lista. KTC, Corven, Nakata, MOOG, SABO y más. Apex Suspensión.",
      },
    ],
  }),
});

function formatoPrecio(cop: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(cop);
}

type OrdenCatalogo = "relevancia" | "precio-asc" | "precio-desc" | "stock-desc";

function mensajeConsultaStock(p: PiezaInventario, moneda: string): string {
  return [
    "Hola Apex Suspensión,",
    "necesito consultar disponibilidad o alternativo:",
    `Referencia: ${p.referencia}`,
    `Pieza: ${p.nombre}`,
    `Marca: ${p.marca}`,
    `Aplicación: ${p.aplicacion}`,
    `Precio lista (referencia web): ${formatoPrecio(p.precioLista)} ${moneda}`,
    "",
    "Nombre del taller:",
  ].join("\n");
}

function CatalogoPage() {
  const { piezas: piezasBase, moneda, fuente } = Route.useLoaderData();
  const [q, setQ] = useState("");
  const [marca, setMarca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [stockFiltro, setStockFiltro] = useState<"todos" | "con-stock">("todos");
  const [orden, setOrden] = useState<OrdenCatalogo>("relevancia");

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
      list = [...list].sort((a, b) => a.precioLista - b.precioLista);
    } else if (orden === "precio-desc") {
      list = [...list].sort((a, b) => b.precioLista - a.precioLista);
    } else if (orden === "stock-desc") {
      list = [...list].sort((a, b) => b.stock - a.stock);
    }

    return list;
  }, [piezasBase, q, marca, categoria, stockFiltro, orden]);

  return (
    <div className="min-h-screen bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-4xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mt-1 text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Package className="h-6 w-6 text-[oklch(0.7_0.2_40)]" />
              Catálogo
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Stock y precio de referencia · {moneda}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 rounded-xl border border-white/10 bg-black/20 px-5 py-5">
          <p className="text-sm font-semibold text-white">Trabajamos con talleres</p>
          <p className="mt-2 text-sm text-gray-400 leading-relaxed">
            Si tienes taller, tienes condiciones diferentes: precio de distribuidor, despacho contra
            entrega y atención directa por WhatsApp. Sin trámites, sin intermediarios.
          </p>
          <a
            href={enlaceWhatsApp(
              "Hola, tengo un taller y quiero conocer las condiciones especiales de Apex.",
            )}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-sm font-semibold text-[oklch(0.7_0.2_40)] hover:text-orange-300"
          >
            Quiero condiciones de taller →
          </a>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por referencia, nombre, marca, vehículo o categoría…"
            className="pl-10 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
          />
        </div>

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
                      <p className="text-sm font-bold text-white">{formatoPrecio(p.precioLista)}</p>
                      <p
                        className={`text-xs mt-1 ${p.stock > 0 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {p.stock > 0 ? `${p.stock} en stock` : "Sin stock"}
                      </p>
                    </div>
                  </div>
                </Link>
                {p.stock <= 0 && (
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

        {piezas.length === 0 && (
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
