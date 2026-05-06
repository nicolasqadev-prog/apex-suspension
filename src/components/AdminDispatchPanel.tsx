import { Bike, MapPin, PackageOpen, ShieldCheck, Timer, User } from "lucide-react";
import { useEffect, useState } from "react";

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

  return <span className="font-mono font-bold text-[oklch(0.7_0.2_40)]">{formatted}</span>;
}

export function ActiveRouteBanner() {
  return (
    <div className="sticky top-0 z-50 w-full bg-[oklch(0.7_0.2_40)] border-b-2 border-[oklch(0.18_0.04_250)] flex items-center justify-between px-4 py-3 shadow-lg">
      <div className="flex items-center gap-3 max-w-4xl mx-auto w-full">
        <div className="flex-shrink-0 bg-[oklch(0.18_0.04_250)] rounded-full p-2">
          <Bike className="w-6 h-6 text-[oklch(0.7_0.2_40)] animate-pulse" />
        </div>
        <p className="text-sm sm:text-base font-bold text-[oklch(0.18_0.04_250)] leading-tight flex-1">
          Ruta activa hacia <span className="underline">Zona Norte / Tocancipá</span>: pedidos en{" "}
          <CountdownTimer initialMinutes={10} /> y se agrupan en el siguiente despacho.
        </p>
      </div>
    </div>
  );
}

export default function AdminDispatchPanel() {
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
      <h1 className="text-xl font-extrabold uppercase text-white flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-[oklch(0.7_0.2_40)]" />
        Panel de despachos
      </h1>

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
                Ventana: <CountdownTimer initialMinutes={route.windowMinutes} />
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              Pedidos ({route.activeOrders.length})
            </p>
            {route.activeOrders.map((order, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 bg-[oklch(0.24_0.05_255)] rounded-lg px-3 py-2"
              >
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
