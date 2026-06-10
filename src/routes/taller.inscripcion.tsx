import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { UserPlus, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTallerSession } from "@/components/TallerSessionProvider";
import StudioFooterSignature from "@/components/StudioFooterSignature";
import { canonicalHref } from "@/lib/site-url";
import { inscribirTallerEnCampo } from "@/lib/taller.inscripcion.functions";

export const Route = createFileRoute("/taller/inscripcion")({
  component: TallerInscripcionPage,
  head: () => {
    const href = canonicalHref("/taller/inscripcion");
    return {
      meta: [
        { title: "Inscripción taller aliado | Apex Suspensión" },
        {
          name: "description",
          content:
            "Registra tu taller en el programa Apex: catálogo con precio taller, stock en bodega y pedidos desde el celular.",
        },
      ],
      links: href ? [{ rel: "canonical", href }] : [],
    };
  },
});

function TallerInscripcionPage() {
  const navigate = useNavigate();
  const { login } = useTallerSession();
  const [nombreTaller, setNombreTaller] = useState("");
  const [nombreContacto, setNombreContacto] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaPrecioTaller, setAceptaPrecioTaller] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!aceptaTerminos || !aceptaPrecioTaller) {
      setError("Debes aceptar las condiciones del programa para continuar.");
      return;
    }

    setEnviando(true);
    try {
      const res = await inscribirTallerEnCampo({
        data: {
          nombreTaller: nombreTaller.trim(),
          nombreContacto: nombreContacto.trim(),
          whatsapp: whatsapp.trim(),
          municipio: municipio.trim(),
          aceptaTerminos: true,
          aceptaPrecioTaller: true,
        },
      });

      if (!res.ok) {
        if (res.reason === "rate_limit") {
          setError("Demasiados intentos. Espera unos minutos e intenta de nuevo.");
          return;
        }
        setError(
          res.reason === "guardar_fallo"
            ? "No pudimos guardar la inscripción. Intenta de nuevo o escríbenos por WhatsApp."
            : "No se pudo completar la inscripción.",
        );
        return;
      }

      const loginRes = await login(whatsapp);
      if (!loginRes.ok) {
        setError(
          "Inscripción guardada, pero no pudimos iniciar sesión automática. Entra en Acceso taller con tu WhatsApp.",
        );
        void navigate({ to: "/taller/acceso" });
        return;
      }

      void navigate({ to: "/taller" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <Link to="/taller/acceso" className="text-xs text-gray-500 hover:text-[oklch(0.7_0.2_40)]">
            ← Acceso taller
          </Link>
          <Link to="/" className="text-xs text-gray-500 hover:text-[oklch(0.7_0.2_40)]">
            Inicio
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto w-full flex-1 px-4 py-8">
        <div className="flex items-center gap-2 mb-2">
          <UserPlus className="h-7 w-7 text-emerald-400" />
          <h1 className="text-xl font-bold text-white">Inscripción taller</h1>
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">
          Completa este formulario en el taller. Al guardar, tu número queda activo de inmediato para
          ver el catálogo con <strong className="text-emerald-300/90">precio taller</strong>, stock en
          bodega y armar pedidos desde el celular.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm text-gray-400">
            Nombre del taller
            <Input
              value={nombreTaller}
              onChange={(e) => setNombreTaller(e.target.value)}
              placeholder="Ej. Taller Eléctrico San José"
              className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
              required
            />
          </label>

          <label className="block text-sm text-gray-400">
            Persona de contacto
            <Input
              value={nombreContacto}
              onChange={(e) => setNombreContacto(e.target.value)}
              placeholder="Nombre de quien usa el portal"
              className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
              required
            />
          </label>

          <label className="block text-sm text-gray-400">
            WhatsApp del taller (para entrar después)
            <Input
              type="tel"
              inputMode="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ej. 300 123 4567"
              className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
              required
            />
          </label>

          <label className="block text-sm text-gray-400">
            Municipio
            <Input
              value={municipio}
              onChange={(e) => setMunicipio(e.target.value)}
              placeholder="Ej. Chía, Cajicá, Zipaquirá…"
              className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
              required
            />
          </label>

          <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 px-4 py-4 text-xs text-gray-400">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aceptaPrecioTaller}
                onChange={(e) => setAceptaPrecioTaller(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Entiendo que el <strong className="text-gray-300">precio taller</strong> es distinto
                al precio público del catálogo (beneficio del programa, sin descuentos adicionales
                encima).
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={aceptaTerminos}
                onChange={(e) => setAceptaTerminos(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Acepto participar en la prueba del programa de talleres Apex y la{" "}
                <a href="/legal#datos" className="text-emerald-400 underline">
                  información legal
                </a>
                . Puedo salir del programa cuando quiera desde mi sesión.
              </span>
            </label>
          </div>

          {error && (
            <p className="text-sm text-red-300/90" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={enviando}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
          >
            {enviando ? "Activando…" : "Inscribir y entrar al catálogo"}
          </Button>
        </form>

        <div className="mt-8 flex items-start gap-2 rounded-lg border border-gray-700/80 px-4 py-3">
          <Wrench className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 leading-relaxed">
            ¿Ya estás inscrito?{" "}
            <Link to="/taller/acceso" className="text-emerald-400 font-semibold hover:underline">
              Entra con tu WhatsApp
            </Link>
            . Si la prueba no les convence, pueden{" "}
            <strong className="text-gray-400">dejar el programa</strong> desde el banner verde del
            catálogo.
          </p>
        </div>
      </main>

      <StudioFooterSignature pinBottom spacious />
    </div>
  );
}
