import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, ClipboardList, LogOut, Package, ShoppingCart, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import TallerNotificacionesAviso from "@/components/TallerNotificacionesAviso";
import TallerPwaInstalarAviso from "@/components/TallerPwaInstalarAviso";
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
            "Panel para talleres aliados Apex: catálogo con precio taller, stock y pedidos.",
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
          Solo para talleres aliados registrados por Apex.
        </p>

        {loading && (
          <p className="mt-10 text-center text-sm text-gray-400">Verificando sesión…</p>
        )}

        {!loading && !taller && (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-white/10 bg-black/20 p-5">
              <p className="font-semibold text-white">Entrar al programa</p>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                Si Apex ya registró tu taller, ingresa con el <strong className="text-gray-300">mismo
                WhatsApp</strong> que quedó en el sistema. Si aún no estás registrado, pide la visita o
                el alta al equipo Apex.
              </p>
              <Button
                asChild
                className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                <Link to="/taller/acceso">Entrar con mi WhatsApp</Link>
              </Button>
            </div>
          </div>
        )}

        {!loading && taller && (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-4">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wide">
                <BadgeCheck className="h-4 w-4" />
                Aliado Apex certificado
              </div>
              <p className="text-lg font-bold text-white mt-2">{taller.nombreTaller}</p>
              <p className="text-xs text-gray-400 mt-2 font-mono">WhatsApp: {whatsappGuardado}</p>
              <p className="text-xs text-emerald-200/80 mt-1">
                Precio especial taller
                {taller.contraEntregaHabilitada ? " · Contra entrega habilitada" : ""}
              </p>
            </div>

            <TallerPwaInstalarAviso />
            <TallerNotificacionesAviso />

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
                      Revisar carrito y enviar pedido a Apex
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
                <Link to="/taller/pedidos">
                  <ClipboardList className="h-5 w-5 mr-3 shrink-0 text-emerald-400" />
                  <span className="text-left">
                    Mis pedidos
                    <span className="block text-xs font-normal text-gray-400 mt-0.5">
                      Seguimiento: enviado, confirmado, en camino
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
