import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTallerSession } from "@/components/TallerSessionProvider";
import StudioFooterSignature from "@/components/StudioFooterSignature";
import { canonicalHref } from "@/lib/site-url";

export const Route = createFileRoute("/taller/acceso")({
  component: TallerAccesoPage,
  head: () => {
    const href = canonicalHref("/taller/acceso");
    return {
      meta: [
        { title: "Acceso talleres fidelizados | Apex Suspensión" },
        {
          name: "description",
          content:
            "Talleres aliados: ingresa tu WhatsApp registrado para ver inventario y precios de taller en tiempo real.",
        },
      ],
      links: href ? [{ rel: "canonical", href }] : [],
    };
  },
});

function TallerAccesoPage() {
  const navigate = useNavigate();
  const { taller, login, loading } = useTallerSession();
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (taller) void navigate({ to: "/catalogo" });
  }, [taller, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await login(whatsapp);
    if (res.ok) {
      void navigate({ to: "/catalogo" });
      return;
    }
    if (res.reason === "rate_limit") {
      setError("Demasiados intentos. Espera unos minutos e intenta de nuevo.");
      return;
    }
    setError(
      "Este número no está registrado como taller fidelizado o la cuenta está inactiva. Escríbenos por WhatsApp si crees que es un error.",
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-md mx-auto">
          <Link to="/" className="text-xs text-gray-500 hover:text-[oklch(0.7_0.2_40)]">
            ← Inicio
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto w-full flex-1 px-4 py-10">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="h-7 w-7 text-emerald-400" />
          <h1 className="text-xl font-bold text-white">Acceso taller</h1>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">
          Si tu taller está en el programa de fidelización de Apex, ingresa el mismo WhatsApp que
          tenemos registrado. Verás el catálogo con tu precio de taller y podrás armar pedidos rápido.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm text-gray-400">
            WhatsApp del taller
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="Ej. 300 123 4567"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
              required
            />
          </label>
          {error && (
            <p className="text-sm text-red-300/90 leading-relaxed" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
          >
            {loading ? "Validando…" : "Entrar al catálogo taller"}
          </Button>
        </form>

        <p className="mt-8 text-xs text-gray-500 leading-relaxed">
          El lobby y el catálogo público son los mismos para todos. Los precios de taller solo se
          muestran después de validar tu número en nuestro sistema. Si aún no eres taller aliado,
          cotiza como siempre desde el catálogo o por WhatsApp.
        </p>

        <div className="mt-8">
          <Button asChild variant="outline" className="border-gray-600 text-gray-300 w-full">
            <Link to="/catalogo">Ver catálogo público</Link>
          </Button>
        </div>
      </main>

      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}
