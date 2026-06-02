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
import { PwaEngagementActions } from "@/components/PwaEngagementActions";
import MarcasSection from "@/components/MarcasSection";
import StudioFooterSignature from "@/components/StudioFooterSignature";
import { enlaceWhatsApp, mensajeConfirmacionCotizacion } from "@/lib/whatsapp";
import { usePersistentState } from "@/lib/usePersistentState";

export default function ApexLandingPage() {
  const [pieza, setPieza] = useState("");
  const [whatsapp, setWhatsapp] = usePersistentState("apex.whatsapp", "");
  const [vehiculo, setVehiculo] = useState("");
  const [ano, setAno] = useState("");
  const [version, setVersion] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function onSubmitDespacho(e: FormEvent) {
    e.preventDefault();
    if (!whatsapp.trim()) return;

    const mensaje = mensajeConfirmacionCotizacion({
      pieza: pieza.trim() || "repuesto de suspensión/dirección",
      whatsapp: whatsapp.trim(),
      vehiculo,
      ano,
      version,
    });

    setEnviando(true);
    setEnviando(false);
    window.open(enlaceWhatsApp(mensaje), "_blank", "noreferrer");
  }
  return (
    <div className="min-h-screen bg-[oklch(0.18_0.04_250)] font-sans text-gray-200 antialiased">
      <header className="border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <ApexHeaderBrand />
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 sm:gap-4 shrink-0 max-w-[58%] sm:max-w-none">
            <Link
              to="/catalogo"
              className="text-xs sm:text-sm font-semibold text-[oklch(0.7_0.2_40)] hover:text-orange-300 transition-colors"
            >
              Catálogo
            </Link>
            <Link
              to="/taller/acceso"
              className="text-xs sm:text-sm font-semibold text-emerald-400/90 hover:text-emerald-300 transition-colors"
            >
              Talleres
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
            Tu carro no puede esperar. Busca en el catálogo y confirma por WhatsApp en minutos — con
            entrega el mismo día en la Sabana de Bogotá.
          </p>

          <a
            href={enlaceWhatsApp("Hola, quiero cotizar un repuesto. ¿Me pueden ayudar?")}
            target="_blank"
            rel="noreferrer"
            className="mt-10 inline-flex items-center gap-3 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-bold text-lg px-8 py-5 rounded-lg shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <Search className="w-6 h-6" />
            Cotizar ahora — respuesta en minutos
            <ArrowRight className="w-5 h-5 ml-1" />
          </a>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("apex:mostrador:open"))}
            className="mt-4 inline-flex text-sm font-semibold text-[oklch(0.7_0.2_40)] hover:text-orange-300"
          >
            ¿No sabes qué pieza es? Te orientamos para cotizar →
          </button>

          <PwaEngagementActions />

          <section className="mt-8 mx-auto max-w-2xl text-left">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-semibold">
              ¿CÓMO TE PODEMOS AYUDAR?
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-black/10 px-5 py-5">
                <p className="text-sm font-semibold text-white">Sé exactamente qué necesito</p>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                  Busca por nombre de pieza, vehículo o referencia. Stock y precios en tiempo real.
                </p>
                <Link
                  to="/catalogo"
                  className="mt-3 inline-flex text-sm font-semibold text-white hover:text-gray-100"
                >
                  Ver catálogo →
                </Link>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/10 px-5 py-5">
                <p className="text-sm font-semibold text-white">Mi carro falla pero no sé qué es</p>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                  Cuéntanos qué pasa — un ruido, una vibración, el volante que jala — y te
                  orientamos para cotizar. Siempre confirma el diagnóstico con tu mecánico de
                  confianza.
                </p>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event("apex:mostrador:open"))}
                  className="mt-3 inline-flex text-sm font-semibold text-[oklch(0.7_0.2_40)] hover:text-orange-300"
                >
                  Describir el problema →
                </button>
              </div>
            </div>
          </section>
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
            Vendemos repuestos y los entregamos en tu dirección. Armamos Apex para resolver lo que
            más frena el día a día: conseguir la pieza correcta y que llegue a tiempo, sin llamadas
            perdidas y sin excusas.
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
            Respuesta en minutos · suspensión y dirección en la Sabana
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:py-16 bg-[oklch(0.16_0.04_248)] border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-xl sm:text-2xl font-extrabold uppercase text-white mb-8 tracking-wide">
            Por qué nos escriben primero
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                Icon: MessageCircle,
                title: "En minutos, no en horas",
                text: "Un mensaje en WhatsApp y listo. Vas directo a quien coordina la pieza y la ruta — sin apps, sin registros, sin esperas en línea.",
              },
              {
                Icon: MapPin,
                title: "Sabana, sin vueltas",
                text: "Chía, Cajicá, Zipaquirá, Tocancipá y alrededores. Te confirmamos el costo de domicilio (gratis en Chía) y el tiempo estimado de llegada antes de salir.",
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
            Lo que frena tu día no es la pericia, es la espera
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                Icon: AlertTriangle,
                title: "Elevador Ocupado",
                text: "Un vehículo esperando repuestos es tiempo y dinero perdido. Cada minuto sin avanzar es un trabajo que se retrasa.",
              },
              {
                Icon: Truck,
                title: "Proveedores Lentos",
                text: "Olvida las horas perdidas esperando a que llegue el mensajero. La improductividad no es un costo que puedas seguir cargando.",
              },
              {
                Icon: Package,
                title: "Falta de Stock",
                text: "Nos especializamos en las piezas que más salen. La que necesitas hoy, la tenemos hoy. Deja de rechazar trabajos por falta de repuesto.",
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
                title: "Busca en el catálogo",
                text: "Ej: rótula delantera Chevrolet Sail 2018. Busca por referencia o descripción.",
              },
              {
                Icon: CheckCircle2,
                title: "Confirma tu pedido",
                text: "Solo la pieza que necesitas y tu WhatsApp. En segundos inicias el chat para confirmar referencia y disponibilidad.",
              },
              {
                Icon: Clock,
                title: "Recibe en tu dirección el mismo día",
                text: "Cuando hay stock y cupo en ruta, coordinamos salida el mismo día. La hora de llegada estimada te la confirma el equipo antes de salir.",
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
          <p className="mt-2 text-sm text-gray-400 leading-relaxed">
            Para confirmar compatibilidad más rápido: vehículo, año y versión. Si puedes, envía foto
            de la pieza vieja (y placa opcional).
          </p>

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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="vehiculo" className="block text-sm font-semibold text-gray-300 mb-1">
                  Vehículo (opcional)
                </label>
                <input
                  type="text"
                  id="vehiculo"
                  placeholder="Ej: Chevrolet Sail"
                  value={vehiculo}
                  onChange={(e) => setVehiculo(e.target.value)}
                  className="w-full bg-[oklch(0.24_0.05_255)] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[oklch(0.7_0.2_40)] focus:border-transparent"
                />
              </div>
              <div>
                <label htmlFor="ano" className="block text-sm font-semibold text-gray-300 mb-1">
                  Año (opcional)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  id="ano"
                  placeholder="2018"
                  value={ano}
                  onChange={(e) => setAno(e.target.value)}
                  className="w-full bg-[oklch(0.24_0.05_255)] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[oklch(0.7_0.2_40)] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="version" className="block text-sm font-semibold text-gray-300 mb-1">
                Versión (opcional)
              </label>
              <input
                type="text"
                id="version"
                placeholder="Ej: LS / LT / 1.4 / 1.6"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
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
            <p className="text-xs text-gray-500 text-center">
              Cada pieza tiene garantía por defecto de fabricación. Si algo falla, lo resolvemos.
            </p>
          </form>
        </div>
      </section>

      <section id="pagos" className="px-4 py-12 md:py-16 bg-[oklch(0.16_0.04_248)] scroll-mt-20">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-black/20 px-6 py-6">
          <p className="text-sm font-semibold text-white">Pagos y garantía</p>
          <ul className="mt-3 text-sm text-gray-400 space-y-2 leading-relaxed">
            <li>
              - Los precios son por unidad.
            </li>
            <li>- Para confirmar tu pedido: necesitamos el 50% de anticipo.</li>
            <li>- Si eres taller validado: tu pedido se despacha contra entrega.</li>
            <li>- Métodos: Nequi, Daviplata, transferencia o efectivo contra entrega.</li>
            <li>
              - El anticipo se pide solo cuando el despacho está confirmado por nosotros. Si no
              podemos cumplir, te avisamos y se devuelve sin rodeos.
            </li>
            <li>
              - Garantía: cubre defectos de fabricación. Si algo falla, lo revisamos contigo y lo
              resolvemos por WhatsApp (con evidencia/fotos) lo más rápido posible.
            </li>
          </ul>
        </div>
      </section>

      <section className="px-4 pb-4 md:pb-6 bg-[oklch(0.16_0.04_248)]">
        <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-black/20 px-6 py-6 text-center">
          <p className="text-base font-bold text-white">¿Ya sabes lo que necesitas?</p>
          <a
            href={enlaceWhatsApp("Hola, quiero cotizar un repuesto. ¿Me pueden ayudar?")}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center justify-center gap-3 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-bold text-lg px-8 py-5 rounded-lg shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            Cotizar ahora por WhatsApp →
          </a>
          <p className="mt-3 text-xs text-gray-500">
            Respuesta en minutos. Sin llamadas, sin esperas.
          </p>
        </div>
      </section>

      <footer className="border-t border-gray-800 px-4 py-10">
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <p className="text-sm font-semibold text-white tracking-tight">
            &copy; {new Date().getFullYear()} Apex Suspensión
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Repuestos de suspensión y dirección (KTC, Corven, Nakata, MOOG, SABO y otras marcas de
            trayectoria) con entrega en tu dirección en la Sabana.
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

        <StudioFooterSignature nested />
      </footer>
    </div>
  );
}
