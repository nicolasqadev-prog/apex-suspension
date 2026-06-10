import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LogOut,
  Package,
  ShoppingCart,
  UserMinus,
  UserPlus,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTallerSession } from "@/components/TallerSessionProvider";
import StudioFooterSignature from "@/components/StudioFooterSignature";
import { leerCarritoTaller } from "@/lib/taller-carrito";
import { canonicalHref } from "@/lib/site-url";

export const Route = createFileRoute("/taller/")({
  component: TallerPanelPage,
  head: () => {
    const href = canonicalHref("/taller");
    return {
      meta: [
        { title: "Portal taller | Apex Suspensión" },
        {
          name: "description",
          content:
            "Panel para talleres aliados: catálogo con precio taller, stock y pedidos. Sin acceso administrativo.",
        },
      ],
      links: href ? [{ rel: "canonical", href }] : [],
    };
  },
});

function TallerPanelPage() {
  const navigate = useNavigate();
  const { taller, loading, logout, whatsappGuardado } = useTallerSession();
  const [itemsCarrito, setItemsCarrito] = useState(0);

  useEffect(() => {
    const sync = () => {
      const lineas = leerCarritoTaller();
      setItemsCarrito(lineas.reduce((n, l) => n + l.cantidad, 0));
    };
    sync();
    window.addEventListener("apex-taller-carrito", sync);
    return () => window.removeEventListener("apex-taller-carrito", sync);
  }, [taller]);

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <Link to="/" className="text-xs text-gray-500 hover:text-[oklch(0.7_0.2_40)]">
            ← Inicio
          </Link>
          <Link to="/catalogo" className="text-xs text-gray-500 hover:text-[oklch(0.7_0.2_40)]">
            Catálogo público
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto w-full flex-1 px-4 py-8">
        <div className="flex items-center gap-2 mb-1">
          <Wrench className="h-7 w-7 text-emerald-400" />
          <h1 className="text-xl font-bold text-white">Portal taller</h1>
        </div>
        <p className="text-sm text-gray-500">
          Solo para talleres aliados. Aquí no hay panel administrativo de Apex.
        </p>

        {loading && (
          <p className="mt-10 text-center text-sm text-gray-400">Verificando sesión…</p>
        )}

        {!loading && !taller && (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5">
              <div className="flex items-start gap-2">
                <UserPlus className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Vincular taller (primera vez)</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Formulario en el celular: quedas activo al instante para ver stock y pedir con
                    precio taller.
                  </p>
                  <Button asChild className="mt-3 w-full bg-emerald-600 hover:bg-emerald-500 text-white">
                    <Link to="/taller/inscripcion">Inscribir taller</Link>
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <p className="font-semibold text-white">Ya estoy inscrito</p>
              <p className="text-xs text-gray-400 mt-1">
                Entra con el WhatsApp que registraron para este taller.
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-3 w-full border-gray-600 text-gray-200"
              >
                <Link to="/taller/acceso">Entrar con mi WhatsApp</Link>
              </Button>
            </div>
          </div>
        )}

        {!loading && taller && (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-emerald-400/80">Tu taller</p>
              <p className="text-lg font-bold text-white mt-1">{taller.nombreTaller}</p>
              <p className="text-xs text-gray-400 mt-2 font-mono">WhatsApp: {whatsappGuardado}</p>
              <p className="text-xs text-emerald-200/80 mt-1">
                Precio taller · {taller.descuentoPorcentaje}% sobre lista pública
                {taller.contraEntregaHabilitada ? " · Contra entrega habilitada" : ""}
              </p>
            </div>

            <nav className="grid gap-3" aria-label="Acciones del taller">
              <Button
                asChild
                size="lg"
                className="h-auto py-4 justify-start bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                <Link to="/catalogo">
                  <Package className="h-5 w-5 mr-3 shrink-0" />
                  <span className="text-left">
                    Catálogo con precio taller
                    <span className="block text-xs font-normal text-emerald-100/80 mt-0.5">
                      Stock en bodega y referencias bajo pedido
                    </span>
                  </span>
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-auto py-4 justify-start border-gray-600 text-gray-100"
              >
                <Link to="/taller/pedido">
                  <ShoppingCart className="h-5 w-5 mr-3 shrink-0 text-emerald-400" />
                  <span className="text-left">
                    Mi pedido{itemsCarrito > 0 ? ` (${itemsCarrito})` : ""}
                    <span className="block text-xs font-normal text-gray-400 mt-0.5">
                      Revisar carrito y enviar por WhatsApp
                    </span>
                  </span>
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-auto py-4 justify-start border-amber-800/50 text-amber-100/90"
              >
                <Link to="/taller/cuenta">
                  <UserMinus className="h-5 w-5 mr-3 shrink-0 text-amber-400" />
                  <span className="text-left">
                    Desvincular taller
                    <span className="block text-xs font-normal text-gray-500 mt-0.5">
                      Si la prueba no les convence, salen del programa al instante
                    </span>
                  </span>
                </Link>
              </Button>
            </nav>

            <button
              type="button"
              onClick={() => {
                logout();
                void navigate({ to: "/taller" });
              }}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-white py-3"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión en este celular
            </button>
          </div>
        )}
      </main>

      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}
