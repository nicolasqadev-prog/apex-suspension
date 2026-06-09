import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTallerSession } from "@/components/TallerSessionProvider";
import StudioFooterSignature from "@/components/StudioFooterSignature";
import { formatoPrecioCop } from "@/lib/formato-cop";
import {
  actualizarCantidadCarritoTaller,
  leerCarritoTaller,
  quitarDelCarritoTaller,
  vaciarCarritoTaller,
} from "@/lib/taller-carrito";
import { allowTallerBorradorEnCliente } from "@/lib/admin-preparacion";
import { enviarPedidoTaller } from "@/lib/taller.portal.functions";
import { enlaceWhatsApp } from "@/lib/whatsapp";
import type { LineaCarritoTaller } from "@/lib/taller.types";

export const Route = createFileRoute("/taller/pedido")({
  component: TallerPedidoPage,
});

function TallerPedidoPage() {
  const navigate = useNavigate();
  const { taller, whatsappGuardado } = useTallerSession();
  const [lineas, setLineas] = useState<LineaCarritoTaller[]>([]);
  const [municipio, setMunicipio] = useState("");
  const [direccion, setDireccion] = useState("");
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLineas(leerCarritoTaller());
  }, []);

  useEffect(() => {
    if (!taller) {
      void navigate({ to: "/taller/acceso" });
    }
  }, [taller, navigate]);

  const total = useMemo(
    () => lineas.reduce((s, l) => s + l.precioUnitarioCop * l.cantidad, 0),
    [lineas],
  );

  function refresh() {
    setLineas(leerCarritoTaller());
  }

  async function onEnviar(e: FormEvent) {
    e.preventDefault();
    if (!taller || lineas.length === 0) return;
    setEnviando(true);
    setError("");
    try {
      const res = await enviarPedidoTaller({
        data: {
          whatsapp: whatsappGuardado,
          lineas: lineas.map((l) => ({ slug: l.slug, cantidad: l.cantidad })),
          municipio: municipio.trim() || undefined,
          direccion: direccion.trim() || undefined,
          notas: notas.trim() || undefined,
          allowNoPublicado: allowTallerBorradorEnCliente(),
        },
      });
      if (!res.ok) {
        setError("No pudimos registrar el pedido. Revisa tu sesión o intenta de nuevo.");
        return;
      }
      vaciarCarritoTaller();
      window.open(enlaceWhatsApp(res.mensajeWhatsapp), "_blank", "noreferrer");
      void navigate({ to: "/catalogo" });
    } finally {
      setEnviando(false);
    }
  }

  if (!taller) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <Link to="/catalogo" className="text-xs text-gray-500 hover:text-[oklch(0.7_0.2_40)]">
            ← Catálogo
          </Link>
          <h1 className="mt-2 text-xl font-bold text-white">Pedido rápido</h1>
          <p className="text-xs text-gray-500">{taller.nombreTaller}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto w-full flex-1 px-4 py-8">
        {lineas.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">Tu carrito está vacío.</p>
            <Button asChild className="mt-6 bg-emerald-600 hover:bg-emerald-500">
              <Link to="/catalogo">Ir al catálogo</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {lineas.map((l) => (
                <li
                  key={l.slug}
                  className="rounded-lg border border-gray-800 bg-[oklch(0.14_0.04_250)] p-4"
                >
                  <p className="text-xs font-mono text-[oklch(0.7_0.2_40)]">{l.referencia}</p>
                  <p className="font-semibold text-white text-sm">{l.nombre}</p>
                  <p className="text-sm text-emerald-300 mt-1">
                    {formatoPrecioCop(l.precioUnitarioCop)} c/u
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Menos"
                        className="p-1 rounded border border-gray-700 text-gray-300"
                        onClick={() => {
                          actualizarCantidadCarritoTaller(l.slug, l.cantidad - 1);
                          refresh();
                        }}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-medium w-8 text-center">{l.cantidad}</span>
                      <button
                        type="button"
                        aria-label="Más"
                        className="p-1 rounded border border-gray-700 text-gray-300"
                        onClick={() => {
                          const max = l.stock > 0 ? l.stock : 99;
                          actualizarCantidadCarritoTaller(l.slug, Math.min(l.cantidad + 1, max));
                          refresh();
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-red-400 p-1"
                      aria-label="Quitar"
                      onClick={() => {
                        quitarDelCarritoTaller(l.slug);
                        refresh();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-right text-lg font-bold text-white">
              Total referencia: {formatoPrecioCop(total)}
            </p>

            <form onSubmit={onEnviar} className="mt-8 space-y-4 border-t border-white/10 pt-6">
              <label className="block text-sm text-gray-400">
                Municipio (opcional)
                <Input
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  placeholder="Ej. Chía"
                  className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
                />
              </label>
              <label className="block text-sm text-gray-400">
                Dirección de entrega (opcional)
                <Input
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Calle, barrio, referencia"
                  className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
                />
              </label>
              <label className="block text-sm text-gray-400">
                Notas para Apex
                <Input
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Urgente, contra entrega, etc."
                  className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
                />
              </label>
              {taller.contraEntregaHabilitada && (
                <p className="text-xs text-emerald-300/90">
                  Tu cuenta tiene contra entrega habilitada; confirma condiciones con el equipo al
                  enviar.
                </p>
              )}
              {error && (
                <p className="text-sm text-red-300" role="alert">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={enviando}
                className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold"
              >
                {enviando ? "Registrando…" : "Enviar pedido y abrir WhatsApp"}
              </Button>
              <p className="text-[10px] text-gray-500 text-center leading-relaxed">
                Guardamos el pedido en Apex y abrimos WhatsApp con el resumen para confirmación de
                stock y despacho.
              </p>
            </form>
          </>
        )}
      </main>

      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}
