import { Link } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";
import {
  AlertTriangle,
  Truck,
  Package,
  Search,
  CheckCircle2,
  Wrench,
  Send,
  ArrowRight,
  Clock,
  ShieldCheck,
  MapPin,
  MessageCircle,
} from "lucide-react";
import ApexHeaderBrand from "@/components/ApexHeaderBrand";
import MarcasSection from "@/components/MarcasSection";
import { enlaceWhatsApp } from "@/lib/whatsapp";

export default function ApexLandingPage() {
  const [pieza, setPieza] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onSubmitDespacho(e: FormEvent) {
    e.preventDefault();
    if (!whatsapp.trim()) return;

    const mensaje = [
      `Hola, necesito: ${pieza.trim() || "repuesto de suspensión/dirección"}.`,
      `Mi WhatsApp es ${whatsapp.trim()}.`,
    ]
      .filter(Boolean)
      .join("\n");

    setEnviando(true);
    setEnviando(false);
    window.open(enlaceWhatsApp(mensaje), "_blank", "noreferrer");
  }
  return (
    <div className="min-h-screen bg-[oklch(0.18_0.04_250)] font-sans text-gray-200 antialiased">
      <header className="border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <ApexHeaderBrand />
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <Link
              to="/catalogo"
              className="text-xs sm:text-sm font-semibold text-[oklch(0.7_0.2_40)] hover:text-orange-300 transition-colors"
            >
              Catálogo
            </Link>
            <a
              href="#pagos"
              className="hidden sm:inline text-xs sm:text-sm font-semibold text-gray-300 hover:text-[oklch(0.7_0.2_40)] transition-colors"
            >
              Pagos y garantía
            </a>
            <a
              href="#despacho"
              className="text-xs sm:text-sm font-semibold text-gray-300 hover:text-[oklch(0.7_0.2_40)] transition-colors"
            >
              Despacho urgente →
            </a>
          </div>
        </div>
      </header>

      <section className="relative flex flex-col items-center justify-center px-4 py-20 md:py-32 text-center overflow-hidden">
        <div className="max-w-3xl mx-auto relative">
          <p className="text-xs uppercase tracking-[0.3em] text-[oklch(0.7_0.2_40)] font-bold mb-4">
            Apex Suspensión · suspensión y dirección
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold uppercase tracking-tight text-white leading-tight">
            El impulso exacto <br className="hidden sm:block" /> para no detenerte.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
            Cotiza repuestos de suspensión y dirección para tu taller: respuesta en minutos y
            entrega donde trabajas en la Sabana de Bogotá. En Chía y alrededores, con pieza en
            stock, coordinamos salida el mismo día.
          </p>

          <a
            href="#despacho"
            className="mt-10 inline-flex items-center gap-3 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-bold text-lg px-8 py-5 rounded-lg shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <Search className="w-6 h-6" />
            Cotizar ahora — respuesta en minutos
            <ArrowRight className="w-5 h-5 ml-1" />
          </a>

          <div className="mt-4" />

          <div className="mt-8 mx-auto max-w-2xl rounded-xl border border-white/10 bg-black/20 px-5 py-5 text-left">
            <p className="text-sm font-semibold text-white">Trabajamos con talleres</p>
            <p className="mt-2 text-sm text-gray-400 leading-relaxed">
              Si tienes taller, tienes condiciones diferentes: precio de distribuidor, despacho
              contra entrega y atención directa por WhatsApp. Sin trámites, sin intermediarios.
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
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-[oklch(0.7_0.2_40)]/30 rounded-full mt-12 hidden md:block">
          {" "}
        </div>
      </section>

      <section className="px-4 py-12 md:py-16 bg-[oklch(0.14_0.04_250)]">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-semibold">
            QUIÉNES SOMOS
          </p>
          <p className="mt-4 text-base sm:text-lg text-white leading-relaxed max-w-3xl mx-auto">
            Somos operadores de taller. Armamos Apex porque lo necesitábamos nosotros primero: un
            proveedor que llegara rápido, sin llamadas perdidas y sin excusas.
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="rounded-xl border border-white/10 bg-black/20 px-6 py-5">
              <p className="text-4xl font-extrabold text-[oklch(0.7_0.2_40)] leading-none">5</p>
              <p className="mt-2 text-sm text-gray-300">marcas especializadas en catálogo</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-6 py-5">
              <p className="text-4xl font-extrabold text-[oklch(0.7_0.2_40)] leading-none">4</p>
              <p className="mt-2 text-sm text-gray-300">
                municipios de la Sabana con cobertura activa
              </p>
            </div>
          </div>

          <div className="mt-8 inline-flex items-center justify-center rounded-full border border-[oklch(0.7_0.2_40)]/30 bg-black/20 px-4 py-2 text-xs text-gray-200">
            Abriendo operaciones — cupos de taller fidelizado limitados en la primera temporada
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:py-16 bg-[oklch(0.16_0.04_248)] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-xl sm:text-2xl font-extrabold uppercase text-white mb-8 tracking-wide">
            Por qué los talleres nos escriben primero
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                Icon: MessageCircle,
                title: "Respuesta en minutos",
                text: "Cotización y confirmación por WhatsApp. Sin formularios eternos: vas directo a quien coordina la pieza y la ruta.",
              },
              {
                Icon: MapPin,
                title: "Sabana, sin vueltas",
                text: "Chía, Cajicá, Zipaquirá, Tocancipá y alrededores. Te decimos domicilio (gratis en Chía) y ETA real antes de salir.",
              },
              {
                Icon: ShieldCheck,
                title: "Tu plata, protegida",
                text: "El anticipo se pide solo cuando el despacho está confirmado por nosotros. Si no podemos cumplir, te avisamos y se devuelve sin rodeos.",
              },
            ].map(({ Icon, title, text }) => (
              <div
                key={title}
                className="rounded-xl border border-white/10 bg-black/25 px-5 py-5 text-left"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[oklch(0.7_0.2_40)]/15 mb-4">
                  <Icon className="h-5 w-5 text-[oklch(0.7_0.2_40)]" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">{title}</h3>
                <p className="text-xs text-gray-400 mt-2 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:py-24 bg-[oklch(0.14_0.04_250)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold uppercase text-white mb-12 tracking-wide">
            Lo que frena tu taller no es la pericia, es la espera
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                Icon: AlertTriangle,
                title: "Elevador Ocupado",
                text: "Un vehículo esperando repuestos es dinero perdido para tu taller. Cada minuto sin rotación reduce tu facturación diaria.",
              },
              {
                Icon: Truck,
                title: "Proveedores Lentos",
                text: "Olvida las horas perdidas esperando a que llegue el mensajero. La improductividad no es un costo que puedas seguir cargando.",
              },
              {
                Icon: Package,
                title: "Falta de Stock",
                text: "Nuestro enfoque especializado garantiza hiper‑rotación en piezas clave. Deja de rechazar trabajos por falta de componentes.",
              },
            ].map(({ Icon, title, text }) => (
              <div
                key={title}
                className="bg-[oklch(0.18_0.04_250)] border border-gray-800 rounded-xl p-6 flex flex-col items-start transition-transform hover:scale-[1.02]"
              >
                <div className="w-12 h-12 bg-[oklch(0.7_0.2_40)]/10 rounded-full flex items-center justify-center mb-5">
                  <Icon className="w-6 h-6 text-[oklch(0.7_0.2_40)]" />
                </div>
                <h3 className="text-lg font-bold text-white uppercase mb-3">{title}</h3>
                <p className="text-gray-400 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:py-24 bg-[oklch(0.18_0.04_250)]">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold uppercase text-white mb-12 tracking-wide">
            Tan simple como un repuesto, tan rápido como tú
          </h2>
          <div className="flex flex-col md:flex-row justify-center items-center gap-8 md:gap-16">
            {[
              {
                Icon: Search,
                title: "Busca en el catálogo PWA",
                text: "Encuentra el repuesto exacto con referencia o descripción. Búsqueda optimizada para grasa en los dedos.",
              },
              {
                Icon: CheckCircle2,
                title: "Confirma tu pedido y taller",
                text: "Sin registros engorrosos. Solo tu nombre y WhatsApp para coordinar la entrega.",
              },
              {
                Icon: Clock,
                title: "Recibe en tu taller en franja corta",
                text: "Cuando hay stock y cupo en ruta, coordinamos salida rápida; el ETA exacto te lo confirma despachos antes de salir.",
              },
            ].map(({ Icon, title, text }, i, arr) => (
              <div key={title} className="contents">
                <div className="flex flex-col items-center max-w-xs">
                  <div className="w-16 h-16 bg-[oklch(0.7_0.2_40)] rounded-full flex items-center justify-center text-white font-extrabold text-2xl shadow-lg mb-4">
                    <Icon className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                    {title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{text}</p>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden md:block w-12 h-px bg-gray-700 self-center"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <MarcasSection />

      <section id="despacho" className="px-4 py-16 md:py-24 bg-[oklch(0.14_0.04_250)] scroll-mt-20">
        <div className="max-w-2xl mx-auto bg-[oklch(0.18_0.04_250)] border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl sm:text-2xl font-extrabold uppercase text-white mb-2 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-[oklch(0.7_0.2_40)]" />
            ¿Qué pieza necesitas?
          </h2>

          <form className="mt-6 space-y-6" onSubmit={onSubmitDespacho}>
            <div>
              <label htmlFor="pieza" className="block text-sm font-semibold text-gray-300 mb-1">
                Pieza o referencia
              </label>
              <input
                type="text"
                id="pieza"
                placeholder="Ej: rotula delantera Chevrolet Sail 2018"
                value={pieza}
                onChange={(e) => setPieza(e.target.value)}
                className="w-full bg-[oklch(0.24_0.05_255)] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[oklch(0.7_0.2_40)] focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="whatsapp" className="block text-sm font-semibold text-gray-300 mb-1">
                Tu WhatsApp
              </label>
              <input
                type="tel"
                id="whatsapp"
                placeholder="3001234567"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full bg-[oklch(0.24_0.05_255)] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[oklch(0.7_0.2_40)] focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={enviando || !whatsapp.trim()}
              className="w-full flex items-center justify-center gap-3 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-bold text-lg px-6 py-4 rounded-lg shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60"
            >
              <Send className="w-5 h-5" />
              {enviando ? "Abriendo…" : "Solicitar por WhatsApp →"}
            </button>
            <p className="text-xs text-gray-500 text-center">
              El equipo de despachos confirma stock y ruta por WhatsApp.
            </p>
          </form>
        </div>
      </section>

      <section id="pagos" className="px-4 py-12 md:py-16 bg-[oklch(0.16_0.04_248)] scroll-mt-20">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-black/20 px-6 py-6">
          <p className="text-sm font-semibold text-white">Pagos y modalidades</p>
          <ul className="mt-3 text-sm text-gray-400 space-y-2 leading-relaxed">
            <li>
              - Los precios son por unidad. Para confirmar tu pedido necesitamos el 50% de anticipo.
            </li>
            <li>- Métodos: Nequi, Daviplata, transferencia o efectivo contra entrega.</li>
            <li>
              - El anticipo se pide solo cuando el despacho está confirmado por nosotros. Si no
              podemos cumplir, te avisamos y se devuelve sin rodeos.
            </li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-gray-800 px-4 py-10">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <p className="text-sm font-semibold text-white tracking-tight">
            &copy; {new Date().getFullYear()} Apex Suspensión
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Repuestos de suspensión y dirección (KTC, Corven, Nakata, MOOG, SABO y otras marcas de
            trayectoria) con logística para tu taller en la Sabana.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-2 text-[11px] text-gray-500">
            <Link to="/legal" hash="datos" className="hover:text-[oklch(0.7_0.2_40)]">
              Datos personales
            </Link>
            <span className="text-gray-700">·</span>
            <Link to="/legal" hash="terminos" className="hover:text-[oklch(0.7_0.2_40)]">
              Términos
            </Link>
            <span className="text-gray-700">·</span>
            <Link to="/legal" hash="cobertura" className="hover:text-[oklch(0.7_0.2_40)]">
              Cobertura legal
            </Link>
          </nav>
        </div>

        <div className="max-w-md mx-auto mt-8 pt-6 border-t border-white/10 flex items-center justify-center gap-3">
          <span className="text-[11px] text-gray-600">Plataforma</span>
          <img
            src="/ockham-systems-marca.png"
            alt="Ockham Systems"
            className="h-5 w-auto object-contain opacity-40 brightness-0 invert"
            loading="lazy"
            decoding="async"
          />
        </div>
      </footer>
    </div>
  );
}
