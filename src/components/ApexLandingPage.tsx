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
  ChevronDown,
  Clock,
  ShieldCheck,
  MapPin,
  MessageCircle,
} from "lucide-react";
import ApexHeaderBrand from "@/components/ApexHeaderBrand";
import MarcasSection from "@/components/MarcasSection";
import { crearPedidoDesdeWeb } from "@/lib/pedidos.functions";
import { enlaceWhatsApp } from "@/lib/whatsapp";

export default function ApexLandingPage() {
  const [taller, setTaller] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [direccion, setDireccion] = useState("");
  const [referencia, setReferencia] = useState("");
  const [requerimiento, setRequerimiento] = useState("");
  const [modalidad, setModalidad] = useState<"express" | "programado">("express");
  const [enviando, setEnviando] = useState(false);

  async function onSubmitDespacho(e: FormEvent) {
    e.preventDefault();
    if (!taller.trim() || !whatsapp.trim() || !municipio.trim() || !direccion.trim()) return;

    const isChia =
      municipio.trim().toLowerCase().includes("chía") ||
      municipio.trim().toLowerCase().includes("chia");

    const mensaje = [
      "Hola Apex Suspensión, necesito despacho.",
      `Taller: ${taller}`,
      `WhatsApp: ${whatsapp}`,
      `Municipio: ${municipio}`,
      `Dirección: ${direccion}`,
      referencia.trim() ? `Referencia / pieza: ${referencia.trim()}` : null,
      requerimiento.trim() ? `Categoría: ${requerimiento.trim()}` : null,
      `Modalidad: ${modalidad === "express" ? "Express (anticipo 50%)" : "Programado (contra entrega)"}`,
      isChia ? "Domicilio: Gratis en Chía" : "Domicilio: se confirma por zona",
    ]
      .filter(Boolean)
      .join("\n");

    // 1) Guardar pedido (si backend/Supabase está configurado).
    // 2) Abrir WhatsApp siempre (la venta real pasa por WA).
    setEnviando(true);
    try {
      await crearPedidoDesdeWeb({
        data: {
          tallerNombre: taller.trim(),
          whatsapp: whatsapp.trim(),
          municipio: municipio.trim(),
          direccion: direccion.trim(),
          referencia: referencia.trim() || undefined,
          requerimiento: requerimiento.trim() || undefined,
          notas:
            modalidad === "express"
              ? "Modalidad express (anticipo 50%)."
              : "Modalidad programado (contra entrega).",
        },
      });
    } catch {
      // Si el backend no está listo, igual se abre WhatsApp.
    } finally {
      setEnviando(false);
      window.open(enlaceWhatsApp(mensaje), "_blank", "noreferrer");
    }
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
            Suspensión a tiempo, trabajo terminado. Entregas rápidas a tu taller en la Sabana; en
            Chía y zonas muy cercanas muchas salidas se coordinan en franjas cortas (referencia
            típica &lt; 45 min cuando hay stock y ruta disponible).
          </p>

          <a
            href="#despacho"
            className="mt-10 inline-flex items-center gap-3 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-bold text-lg px-8 py-5 rounded-lg shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <Search className="w-6 h-6" />
            Cotizar ahora — respuesta en minutos
            <ArrowRight className="w-5 h-5 ml-1" />
          </a>

          <div className="mt-4 flex items-center justify-center gap-4 text-sm">
            <Link
              to="/catalogo"
              className="text-gray-300 hover:text-[oklch(0.7_0.2_40)] font-semibold"
            >
              Ver catálogo
            </Link>
            <span className="text-gray-700">|</span>
            <a href="#pagos" className="text-gray-300 hover:text-[oklch(0.7_0.2_40)] font-semibold">
              Ver pagos y garantía
            </a>
          </div>
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-[oklch(0.7_0.2_40)]/30 rounded-full mt-12 hidden md:block">
          {" "}
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
                title: "Anticipo con reglas claras",
                text: "Express con 50% para reservar y priorizar ruta; Programado contra entrega si preferís pagar al recibir. Si no podemos despachar, no te dejamos colgado: te avisamos y el anticipo se gestiona sin rodeos.",
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
                title: "Recibe en Chía en franja corta",
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
            Despacho inmediato
          </h2>
          <p className="text-gray-400 mb-8">
            Completa los datos y abrimos hilo en WhatsApp para cotizar, confirmar stock y coordinar
            la ruta.
          </p>

          <div
            id="pagos"
            className="mb-8 rounded-xl border border-white/10 bg-black/20 px-5 py-4 scroll-mt-20"
          >
            <p className="text-sm font-semibold text-white">Pagos y modalidades</p>
            <ul className="mt-2 text-xs text-gray-400 space-y-1 leading-relaxed">
              <li>
                - <span className="text-gray-200 font-medium">Express (prioritario):</span> anticipo
                del <span className="text-gray-200 font-medium">50%</span> para reservar y salir en
                ruta el mismo día. Saldo contra entrega.
              </li>
              <li>
                - <span className="text-gray-200 font-medium">Programado:</span> pago completo
                contra entrega (según disponibilidad de ruta).
              </li>
              <li>
                - <span className="text-gray-200 font-medium">Transparencia:</span> el anticipo se
                solicita cuando el despacho está confirmado por nuestra parte. Si por disponibilidad
                o ruta no podemos cumplir, te avisamos y el anticipo se devuelve sin rodeos.
              </li>
              <li>
                - <span className="text-gray-200 font-medium">Domicilio:</span> gratis en{" "}
                <span className="text-gray-200 font-medium">Chía</span>. Otras zonas: confirmamos
                costo por WhatsApp antes de salir.
              </li>
              <li>
                - Métodos: <span className="text-gray-200 font-medium">Nequi</span>,{" "}
                <span className="text-gray-200 font-medium">Daviplata</span>,{" "}
                <span className="text-gray-200 font-medium">transferencia</span> o{" "}
                <span className="text-gray-200 font-medium">efectivo</span> contra entrega.
              </li>
            </ul>
          </div>
          <form className="space-y-6" onSubmit={onSubmitDespacho}>
            <div>
              <label htmlFor="taller" className="block text-sm font-semibold text-gray-300 mb-1">
                Nombre del Taller
              </label>
              <input
                type="text"
                id="taller"
                placeholder="Ej. Taller El Rápido"
                value={taller}
                onChange={(e) => setTaller(e.target.value)}
                className="w-full bg-[oklch(0.24_0.05_255)] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[oklch(0.7_0.2_40)] focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="whatsapp" className="block text-sm font-semibold text-gray-300 mb-1">
                WhatsApp del encargado
              </label>
              <input
                type="tel"
                id="whatsapp"
                placeholder="+57 300 123 4567"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="w-full bg-[oklch(0.24_0.05_255)] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[oklch(0.7_0.2_40)] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Solo para enviar la ruta de entrega y confirmación.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="municipio"
                  className="block text-sm font-semibold text-gray-300 mb-1"
                >
                  Municipio / zona
                </label>
                <input
                  type="text"
                  id="municipio"
                  placeholder="Ej. Chía / Cajicá / Tocancipá"
                  value={municipio}
                  onChange={(e) => setMunicipio(e.target.value)}
                  className="w-full bg-[oklch(0.24_0.05_255)] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[oklch(0.7_0.2_40)] focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="direccion"
                  className="block text-sm font-semibold text-gray-300 mb-1"
                >
                  Dirección del taller
                </label>
                <input
                  type="text"
                  id="direccion"
                  placeholder="Ej. Calle 12 # 3-45, barrio X"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="w-full bg-[oklch(0.24_0.05_255)] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[oklch(0.7_0.2_40)] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <p className="block text-sm font-semibold text-gray-300 mb-2">Modalidad</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="rounded-lg border border-gray-700 bg-[oklch(0.24_0.05_255)] px-4 py-3 cursor-pointer hover:border-[oklch(0.7_0.2_40)]/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="modalidad"
                      checked={modalidad === "express"}
                      onChange={() => setModalidad("express")}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-bold text-white">Express (prioritario)</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Requiere anticipo del 50% para reservar y salir en ruta.
                      </p>
                    </div>
                  </div>
                </label>
                <label className="rounded-lg border border-gray-700 bg-[oklch(0.24_0.05_255)] px-4 py-3 cursor-pointer hover:border-[oklch(0.7_0.2_40)]/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="modalidad"
                      checked={modalidad === "programado"}
                      onChange={() => setModalidad("programado")}
                      className="mt-1"
                    />
                    <div>
                      <p className="text-sm font-bold text-white">Programado</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Pago contra entrega y salida por ruta.
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label
                htmlFor="referencia"
                className="block text-sm font-semibold text-gray-300 mb-1"
              >
                Pieza o referencia (opcional)
              </label>
              <input
                type="text"
                id="referencia"
                placeholder="Ej. Bieletas Spark / KTC-..."
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className="w-full bg-[oklch(0.24_0.05_255)] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[oklch(0.7_0.2_40)] focus:border-transparent"
              />
            </div>

            <div className="relative">
              <label
                htmlFor="requerimiento"
                className="block text-sm font-semibold text-gray-300 mb-1"
              >
                Requerimiento urgente de suspensión:
              </label>
              <div className="relative">
                <select
                  id="requerimiento"
                  value={requerimiento}
                  onChange={(e) => setRequerimiento(e.target.value)}
                  className="w-full bg-[oklch(0.24_0.05_255)] border border-gray-700 rounded-lg px-4 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[oklch(0.7_0.2_40)] focus:border-transparent"
                >
                  <option value="" disabled>
                    Selecciona la categoría técnica
                  </option>
                  <option>Amortiguadores (Alta Rotación)</option>
                  <option>Terminales y Rótulas</option>
                  <option>Bujes y Bieletas</option>
                  <option>Consulta Específica</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <button
              type="submit"
              disabled={
                enviando ||
                !taller.trim() ||
                !whatsapp.trim() ||
                !municipio.trim() ||
                !direccion.trim()
              }
              className="w-full flex items-center justify-center gap-3 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-bold text-lg px-6 py-4 rounded-lg shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <Send className="w-5 h-5" />
              {enviando ? "Enviando…" : "Solicitar despacho por WhatsApp"}
            </button>
            <p className="text-center text-xs text-gray-500 mt-4 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[oklch(0.7_0.2_40)]" />
              Confirmación y coordinación final por WhatsApp.
            </p>
          </form>

          <div className="mt-10 grid grid-cols-1 gap-4">
            <div className="rounded-xl border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-sm font-semibold text-white">Cobertura y tiempos</p>
              <ul className="mt-2 text-xs text-gray-400 space-y-1 leading-relaxed">
                <li>
                  - Cobertura activa en la Sabana: Chía, Cajicá, Tocancipá, Zipaquirá y municipios
                  cercanos.
                </li>
                <li>- Horario: lunes a viernes, 8:30 a. m. – 4:30 p. m.</li>
                <li>- Express (con anticipo) tiene prioridad en la ruta del día.</li>
                <li>- Programado se coordina según disponibilidad; confirma tu franja horaria.</li>
                <li>- El equipo de despachos te informa el ETA real antes de salir.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-sm font-semibold text-white">Garantía</p>
              <ul className="mt-2 text-xs text-gray-400 space-y-1 leading-relaxed">
                <li>- Cubre defectos de fabricación comprobados en la pieza entregada.</li>
                <li>- No aplica por mala instalación, uso indebido o modificaciones.</li>
                <li>
                  - Para gestionar la garantía, escríbenos por WhatsApp con foto o video del defecto
                  dentro de los 7 días calendario.
                </li>
                <li>- Evaluamos el caso máximo en 3 días hábiles.</li>
                <li>- Piezas intervenidas o con señales de instalación incorrecta no aplican.</li>
              </ul>
            </div>
          </div>
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

        <div className="max-w-md mx-auto mt-10 pt-8 border-t border-white/10 flex flex-col items-center gap-3 text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-gray-500">
            Plataforma y presencia técnica
          </p>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-6 py-4 backdrop-blur-sm">
            <img
              src="/ockham-systems-marca.png"
              alt="Ockham Systems"
              className="h-12 sm:h-14 w-auto max-w-[min(100%,280px)] object-contain opacity-90"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
