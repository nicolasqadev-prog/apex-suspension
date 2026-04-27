import { useState, useEffect } from "react";
import {
  Clock,
  AlertTriangle,
  Truck,
  Package,
  Search,
  CheckCircle2,
  Wrench,
  Send,
  ArrowRight,
  ChevronDown,
  Bike,
  Timer,
  MapPin,
  PackageOpen,
  User,
  ShieldCheck,
} from "lucide-react";
import apexIcon from "@/assets/apex-icon.png";

function CountdownTimer({ initialMinutes = 5 }: { initialMinutes?: number }) {
  const [timeLeft, setTimeLeft] = useState(Math.floor(initialMinutes * 60));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return <span className="font-mono font-bold text-[oklch(0.7_0.2_40)]">{formatted} min restantes</span>;
}

function ActiveRouteBanner() {
  return (
    <div className="sticky top-0 z-50 w-full bg-[oklch(0.7_0.2_40)] border-b-2 border-[oklch(0.18_0.04_250)] flex items-center justify-between px-4 py-3 shadow-lg">
      <div className="flex items-center gap-3 max-w-4xl mx-auto w-full">
        <div className="flex-shrink-0 bg-[oklch(0.18_0.04_250)] rounded-full p-2">
          <Bike className="w-6 h-6 text-[oklch(0.7_0.2_40)] animate-pulse" />
        </div>
        <p className="text-sm sm:text-base font-bold text-[oklch(0.18_0.04_250)] leading-tight flex-1">
          🔔 Ruta Activa hacia <span className="underline">Zona Norte / Tocancipá</span>: Haz tu pedido en los próximos{" "}
          <CountdownTimer initialMinutes={10} /> y súmate a este despacho flash sin costo adicional de envío.
        </p>
      </div>
    </div>
  );
}

function AdminDispatchPanel() {
  const routes = [
    {
      id: 1,
      driver: "Motorizado 1",
      zone: "Zona Norte (Cajicá - Chía)",
      activeOrders: [
        { shop: "Taller El Turbo", part: "Amortiguador delantero derecho" },
        { shop: "Servicentro Motorfix", part: "Rótula de dirección" },
        { shop: "Autosprint", part: "Buje de barra estabilizadora" },
      ],
      windowMinutes: 4.5,
    },
    {
      id: 2,
      driver: "Motorizado 2",
      zone: "Tocancipá Norte",
      activeOrders: [{ shop: "Taller Hermanos Gómez", part: "Bieleta de suspensión" }],
      windowMinutes: 7.2,
    },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-extrabold uppercase text-white flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[oklch(0.7_0.2_40)]" />
        Panel de Despacho en Ruta
      </h3>

      {routes.map((route) => (
        <div
          key={route.id}
          className="bg-[oklch(0.18_0.04_250)] border border-gray-800 rounded-xl p-5 shadow-xl hover:border-[oklch(0.7_0.2_40)]/40 transition-colors"
        >
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <User className="w-6 h-6 text-gray-400" />
              <div>
                <p className="text-white font-bold">{route.driver}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[oklch(0.7_0.2_40)]" /> {route.zone}
                </p>
              </div>
            </div>
            <div className="bg-[oklch(0.24_0.05_255)] rounded-lg px-4 py-2 text-sm flex items-center gap-2">
              <Timer className="w-4 h-4 text-[oklch(0.7_0.2_40)]" />
              <span className="text-gray-300 font-medium">
                Ventana de agrupación: <CountdownTimer initialMinutes={route.windowMinutes} />
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              Pedidos agrupados ({route.activeOrders.length})
            </p>
            {route.activeOrders.map((order, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-[oklch(0.24_0.05_255)] rounded-lg px-3 py-2">
                <PackageOpen className="w-4 h-4 text-[oklch(0.7_0.2_40)]" />
                <div>
                  <p className="text-sm font-medium text-gray-200">{order.part}</p>
                  <p className="text-xs text-gray-500">{order.shop}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ApexLandingPage() {
  const [showAdmin, setShowAdmin] = useState(false);

  return (
    <div className="min-h-screen bg-[oklch(0.18_0.04_250)] font-sans text-gray-200 antialiased">
      <ActiveRouteBanner />

      <header className="border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 group">
            <img
              src={apexIcon}
              alt=""
              aria-hidden="true"
              className="h-8 w-auto transition-transform group-hover:scale-105"
            />
            <div className="flex flex-col leading-none">
              <span className="text-base font-extrabold tracking-tight text-white">
                APEX <span className="text-[oklch(0.7_0.2_40)]">/</span> Suspensión
              </span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-gray-500 mt-1">
                Logística de precisión
              </span>
            </div>
          </a>
          <a
            href="#despacho"
            className="text-xs sm:text-sm font-semibold text-gray-300 hover:text-[oklch(0.7_0.2_40)] transition-colors"
          >
            Despacho urgente →
          </a>
        </div>
      </header>

      <section className="relative flex flex-col items-center justify-center px-4 py-20 md:py-32 text-center overflow-hidden">
        <img
          src={apexIcon}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 top-1/2 -translate-y-1/2 h-[520px] w-auto opacity-[0.05] hidden md:block"
        />
        <div className="max-w-3xl mx-auto relative">
          <p className="text-xs uppercase tracking-[0.3em] text-[oklch(0.7_0.2_40)] font-bold mb-4">
            Apex Suspensión · KTC
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold uppercase tracking-tight text-white leading-tight">
            El impulso exacto <br className="hidden sm:block" /> para no detenerte.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
            Suspensión a tiempo, trabajo terminado. Entregas flash de repuestos KTC directamente en tu taller en menos de 45 minutos.
          </p>

          <button className="mt-10 inline-flex items-center gap-3 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-bold text-lg px-8 py-5 rounded-lg shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400">
            <Search className="w-6 h-6" />
            Buscar Repuesto Urgente
            <ArrowRight className="w-5 h-5 ml-1" />
          </button>
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-[oklch(0.7_0.2_40)]/30 rounded-full mt-12 hidden md:block"></div>
      </section>

      <section className="px-4 py-16 md:py-24 bg-[oklch(0.14_0.04_250)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold uppercase text-white mb-12 tracking-wide">
            Lo que frena tu taller no es la pericia, es la espera
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { Icon: AlertTriangle, title: "Elevador Ocupado", text: "Un vehículo esperando repuestos es dinero perdido para tu taller. Cada minuto sin rotación reduce tu facturación diaria." },
              { Icon: Truck, title: "Proveedores Lentos", text: "Olvida las horas perdidas esperando a que llegue el mensajero. La improductividad no es un costo que puedas seguir cargando." },
              { Icon: Package, title: "Falta de Stock", text: "Nuestro enfoque especializado garantiza hiper‑rotación en piezas clave. Deja de rechazar trabajos por falta de componentes." },
            ].map(({ Icon, title, text }) => (
              <div key={title} className="bg-[oklch(0.18_0.04_250)] border border-gray-800 rounded-xl p-6 flex flex-col items-start transition-transform hover:scale-[1.02]">
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
              { Icon: Search, title: "Busca en el catálogo PWA", text: "Encuentra el repuesto exacto con referencia o descripción. Búsqueda optimizada para grasa en los dedos." },
              { Icon: CheckCircle2, title: "Confirma tu pedido y taller", text: "Sin registros engorrosos. Solo tu nombre y WhatsApp para coordinar la entrega." },
              { Icon: Clock, title: "Recibe en Chía en < 45 min", text: "Nuestro último entregador sale con tu repuesto antes de que termines de desmontar el anterior." },
            ].map(({ Icon, title, text }, i, arr) => (
              <div key={title} className="contents">
                <div className="flex flex-col items-center max-w-xs">
                  <div className="w-16 h-16 bg-[oklch(0.7_0.2_40)] rounded-full flex items-center justify-center text-white font-extrabold text-2xl shadow-lg mb-4">
                    <Icon className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-bold text-gray-300 uppercase tracking-wider">{title}</p>
                  <p className="text-xs text-gray-500 mt-1">{text}</p>
                </div>
                {i < arr.length - 1 && <div className="hidden md:block w-12 h-px bg-gray-700 self-center"></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:py-24 bg-[oklch(0.14_0.04_250)]">
        <div className="max-w-2xl mx-auto bg-[oklch(0.18_0.04_250)] border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl sm:text-2xl font-extrabold uppercase text-white mb-2 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-[oklch(0.7_0.2_40)]" />
            Despacho inmediato
          </h2>
          <p className="text-gray-400 mb-8">
            Completa los datos y en menos de un minuto estarás con el repuesto en camino.
          </p>
          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label htmlFor="taller" className="block text-sm font-semibold text-gray-300 mb-1">
                Nombre del Taller
              </label>
              <input
                type="text"
                id="taller"
                placeholder="Ej. Taller El Rápido"
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
                className="w-full bg-[oklch(0.24_0.05_255)] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[oklch(0.7_0.2_40)] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">Solo para enviar la ruta de entrega y confirmación.</p>
            </div>
            <div className="relative">
              <label htmlFor="requerimiento" className="block text-sm font-semibold text-gray-300 mb-1">
                Requerimiento urgente de suspensión:
              </label>
              <div className="relative">
                <select
                  id="requerimiento"
                  defaultValue=""
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
              className="w-full flex items-center justify-center gap-3 bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-bold text-lg px-6 py-4 rounded-lg shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <Send className="w-5 h-5" />
              Solicitar Despacho Inmediato
            </button>
            <p className="text-center text-xs text-gray-500 mt-4 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[oklch(0.7_0.2_40)]" />
              Solo distribuimos marcas de alta calidad como KTC. Respuestas en tiempo real.
            </p>
          </form>
        </div>
      </section>

      <div className="flex justify-center pb-8 pt-8">
        <button
          onClick={() => setShowAdmin(!showAdmin)}
          className="text-sm text-gray-500 hover:text-[oklch(0.7_0.2_40)] flex items-center gap-2 border border-gray-700 px-4 py-2 rounded-full transition-colors"
        >
          <ShieldCheck className="w-4 h-4" />
          {showAdmin ? "Ocultar Panel de Despachos" : "Ver Panel de Despachos (Admin)"}
        </button>
      </div>

      {showAdmin && (
        <section className="px-4 py-8 bg-[oklch(0.14_0.04_250)] border-t border-gray-800">
          <div className="max-w-4xl mx-auto">
            <AdminDispatchPanel />
          </div>
        </section>
      )}

      <footer className="text-center py-6 border-t border-gray-800">
        <p className="text-xs text-gray-600">
          &copy; {new Date().getFullYear()} Apex Suspensión – Logística de precisión para el taller moderno.
        </p>
      </footer>
    </div>
  );
}
