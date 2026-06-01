import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import AdminDispatchPanel, { ActiveRouteBanner } from "@/components/AdminDispatchPanel";
import AdminPushPanel from "@/components/AdminPushPanel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listarPedidosRecientes } from "@/lib/pedidos.functions";

type Pedido = {
  id: string;
  estado: string;
  taller_nombre: string;
  telefono: string;
  direccion: string | null;
  notas: string | null;
  created_at: string;
};

const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX_FAILS = 5;
const rateFailsByIp = new Map<string, { count: number; firstAt: number }>();

function getIpFromHeaders(headers: Headers): string {
  const cf = headers.get("CF-Connecting-IP");
  if (cf) return cf.trim();
  const xff = headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

const verifyAdminPin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Datos inválidos");
    const pin = (data as { pin?: unknown }).pin;
    if (typeof pin !== "string") throw new Error("PIN inválido");
    return { pin };
  })
  .handler(async (ctx) => {
    const data = (ctx as { data: { pin: string } }).data;
    const request = (ctx as { request?: Request }).request;
    const ip = request ? getIpFromHeaders(request.headers) : "unknown";
    const now = Date.now();
    const slot = rateFailsByIp.get(ip);
    if (slot && now - slot.firstAt <= RATE_WINDOW_MS && slot.count >= RATE_MAX_FAILS) {
      return { ok: false, reason: "bloqueado" } as const;
    }

    // En desarrollo, PIN de prueba si no hay variable (cambiar en producción vía ADMIN_PIN).
    const expected = process.env.ADMIN_PIN ?? (import.meta.env.DEV ? "Panel1234" : undefined);
    if (!expected) {
      return { ok: false, reason: "ADMIN_PIN no configurado en el servidor" } as const;
    }
    const ok = data.pin === expected;
    if (!ok) {
      if (!slot || now - slot.firstAt > RATE_WINDOW_MS) {
        rateFailsByIp.set(ip, { count: 1, firstAt: now });
      } else {
        rateFailsByIp.set(ip, { count: slot.count + 1, firstAt: slot.firstAt });
      }
    } else {
      rateFailsByIp.delete(ip);
    }
    return { ok } as const;
  });

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [{ title: "Admin | Apex Suspensión" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

const STORAGE_KEY = "apex_admin_session";
const PIN_STORAGE_KEY = "apex_admin_pin";

function AdminPage() {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "denied" | "allowed">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const hasSession = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  }, []);

  useEffect(() => {
    if (hasSession) setStatus("allowed");
  }, [hasSession]);

  async function onLogin() {
    setStatus("checking");
    setMessage(null);
    try {
      const res = await verifyAdminPin({ data: { pin } });
      if (res.ok) {
        window.sessionStorage.setItem(STORAGE_KEY, "1");
        window.sessionStorage.setItem(PIN_STORAGE_KEY, pin);
        setStatus("allowed");
        return;
      }
      setStatus("denied");
      setMessage(res.reason ?? "PIN incorrecto");
    } catch (err) {
      setStatus("denied");
      setMessage(err instanceof Error ? err.message : "No se pudo validar el PIN");
    }
  }

  function onLogout() {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(PIN_STORAGE_KEY);
    setStatus("idle");
    setPin("");
    setMessage(null);
  }

  if (status !== "allowed") {
    return (
      <div className="min-h-screen bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
        <header className="border-b border-white/10 px-4 py-4">
          <div className="max-w-lg mx-auto">
            <h1 className="text-xl font-bold text-white tracking-tight">Panel administrativo</h1>
            <p className="text-xs text-gray-500 mt-1">
              Acceso restringido. Este panel no está diseñado para clientes.
            </p>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-10">
          <div className="rounded-xl border border-gray-800 bg-[oklch(0.14_0.04_250)] p-5 space-y-4">
            <label className="block text-sm font-semibold text-gray-300">PIN</label>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              type="password"
              className="bg-[oklch(0.18_0.04_250)] border-gray-700 text-white placeholder:text-gray-500"
            />
            {message && <p className="text-xs text-red-300">{message}</p>}
            <Button
              onClick={onLogin}
              disabled={!pin || status === "checking"}
              className="w-full bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-semibold"
            >
              {status === "checking" ? "Validando…" : "Entrar"}
            </Button>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Configura <code className="font-mono">ADMIN_PIN</code> como secreto del servidor
              (Cloudflare/Wrangler). Nunca lo pongas como <code className="font-mono">VITE_*</code>.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return <AdminAuthed onLogout={onLogout} />;
}

function googleMapsRouteUrl(addresses: string[]) {
  const cleaned = addresses.map((a) => a.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  const destination = cleaned[cleaned.length - 1];
  const waypoints = cleaned.slice(0, -1);
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", destination);
  // sin origin → Google Maps usa “tu ubicación”
  if (waypoints.length) url.searchParams.set("waypoints", waypoints.join("|"));
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

function AdminAuthed({ onLogout }: { onLogout: () => void }) {
  const adminPin =
    typeof window !== "undefined" ? (window.sessionStorage.getItem(PIN_STORAGE_KEY) ?? "") : "";
  const [minutes] = useState(120);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await listarPedidosRecientes({ data: { minutes } });
      if (!res.ok) {
        setError(res.reason);
        setPedidos([]);
        return;
      }
      setPedidos(res.pedidos as Pedido[]);
      setSelected({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar pedidos");
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedPedidos = pedidos.filter((p) => selected[p.id]);
  const routeUrl = googleMapsRouteUrl(
    selectedPedidos.map((p) => p.direccion ?? "").filter(Boolean),
  );

  return (
    <div className="min-h-screen bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <ActiveRouteBanner />
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Administración</h1>
            <p className="text-xs text-gray-500 mt-1">
              Uso interno (despachos, rutas y operación). Ventana actual: {minutes} min.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={refresh}
              className="border-gray-600 text-gray-300"
              disabled={loading}
            >
              {loading ? "Actualizando…" : "Actualizar"}
            </Button>
            <Button variant="outline" onClick={onLogout} className="border-gray-600 text-gray-300">
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <AdminPushPanel adminPin={adminPin} pedidos={pedidos} onPedidosChange={refresh} />

        <div className="rounded-xl border border-gray-800 bg-[oklch(0.14_0.04_250)] p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Pedidos recientes</p>
              <p className="text-xs text-gray-500 mt-1">
                Selecciona pedidos para crear una ruta en Google Maps (origen: tu ubicación actual).
              </p>
            </div>
            <Button
              asChild
              className="bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-semibold"
              disabled={!routeUrl}
            >
              <a href={routeUrl ?? "#"} target="_blank" rel="noreferrer">
                Abrir ruta (Maps)
              </a>
            </Button>
          </div>

          {error && (
            <p className="mt-4 text-xs text-red-300">
              {error}. Configura `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como secretos del
              servidor para ver pedidos aquí.
            </p>
          )}

          <div className="mt-4 divide-y divide-white/5">
            {pedidos.map((p) => (
              <label key={p.id} className="flex gap-3 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!selected[p.id]}
                  onChange={(e) => setSelected((s) => ({ ...s, [p.id]: e.target.checked }))}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{p.taller_nombre}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.direccion ?? "Sin dirección"}
                      </p>
                      {p.notas && <p className="text-[11px] text-gray-500 mt-1">{p.notas}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-gray-500">{p.estado}</p>
                      <p className="text-[11px] text-gray-500">
                        {new Date(p.created_at).toLocaleTimeString("es-CO", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </label>
            ))}
            {!error && !loading && pedidos.length === 0 && (
              <p className="text-xs text-gray-500 py-6 text-center">
                No hay pedidos recientes en los últimos {minutes} minutos.
              </p>
            )}
          </div>
        </div>

        <OperacionConversionPlaybook />
        <AdminDispatchPanel />
      </main>
    </div>
  );
}

function OperacionConversionPlaybook() {
  return (
    <section className="rounded-xl border border-gray-800 bg-[oklch(0.14_0.04_250)] p-5 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">Compendio operativo y conversión</p>
          <p className="text-xs text-gray-500 mt-1">
            Uso interno. Esto no se comparte con clientes.
          </p>
        </div>
      </div>

      <Accordion type="multiple" className="mt-4">
        <AccordionItem value="principio">
          <AccordionTrigger className="text-gray-200">
            Principio que gobierna todo
          </AccordionTrigger>
          <AccordionContent className="text-xs text-gray-400 leading-relaxed">
            <p>
              El cliente decide por emoción y lo justifica con razones. Apex no vende repuestos:
              vende certeza. Certeza de que la pieza es correcta, de que llega, de que el precio es
              justo y de que si algo falla, alguien responde.
            </p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="fase1">
          <AccordionTrigger className="text-gray-200">Fase 1 — Antes del primer cliente</AccordionTrigger>
          <AccordionContent className="text-xs text-gray-400 leading-relaxed space-y-3">
            <div>
              <p className="text-gray-200 font-semibold">Google Business Profile (prioridad)</p>
              <ul className="mt-2 space-y-1">
                <li>- Nombre: Apex Suspensión</li>
                <li>- Categoría: tienda de repuestos para automóviles</li>
                <li>- Municipios de cobertura en descripción</li>
                <li>- Horario real</li>
                <li>- Enlace a la PWA</li>
                <li>- Fotos reales: piezas, empaque, proceso</li>
              </ul>
            </div>
            <div>
              <p className="text-gray-200 font-semibold">SEO local mínimo (cuando haya señales reales)</p>
              <p className="mt-1">
                Una página por municipio con cobertura (Chía, Cajicá, Zipaquirá, Tocancipá) con
                texto simple: qué venden, cobertura y referencias de alta rotación.
              </p>
            </div>
            <div>
              <p className="text-gray-200 font-semibold">Simulacros</p>
              <p className="mt-1">
                Hacer pedidos internos para encontrar huecos operativos antes de atender clientes.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="fase2">
          <AccordionTrigger className="text-gray-200">Fase 2 — Primer contacto (WhatsApp)</AccordionTrigger>
          <AccordionContent className="text-xs text-gray-400 leading-relaxed space-y-3">
            <div>
              <p className="text-gray-200 font-semibold">Regla</p>
              <p className="mt-1">
                Nunca responder solo “hola”. Responder demostrando competencia y pidiendo el dato
                mínimo para confirmar referencia.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-gray-200 font-semibold">Ejemplo (cliente ya sabe la pieza)</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-gray-300">
Buenos días. Para confirmar la referencia exacta: ¿qué año es el Sail y qué versión, LS o LT? Con eso te confirmo disponibilidad y precio.
              </pre>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-gray-200 font-semibold">Respuestas rápidas (atajos)</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-gray-300">
/confirmar → Para confirmar tu pedido necesito: pieza, vehículo, año, versión y tu dirección de entrega.
/stock → Revisamos disponibilidad y te confirmamos en minutos.
/precio → Los precios están en el catálogo. Dime la referencia y te confirmo disponibilidad.
/entrega → Coordinamos entrega el mismo día cuando hay stock y cupo en ruta. El ETA exacto te lo confirmamos antes de salir.
/garantia → Cada pieza tiene garantía por defecto de fabricación. Si algo falla, lo resolvemos sin rodeos.
              </pre>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-gray-200 font-semibold">Mensaje automático (bienvenida/ausencia)</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-gray-300">
Hola, gracias por escribirnos. Somos Apex Suspensión — repuestos de suspensión y dirección con entrega el mismo día en la Sabana de Bogotá. Te respondemos en minutos. Mientras tanto puedes ver el catálogo aquí: [enlace PWA]
              </pre>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="fase3">
          <AccordionTrigger className="text-gray-200">Fase 3 — Cuando algo falla</AccordionTrigger>
          <AccordionContent className="text-xs text-gray-400 leading-relaxed space-y-3">
            <p className="text-gray-200 font-semibold">
              Avisar antes de que pregunten. Resolver antes de que exijan. Reconocer antes de que
              escale.
            </p>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-gray-200 font-semibold">Referencia equivocada</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-gray-300">
Revisando tu pedido encontramos que la referencia no corresponde a tu vehículo. Te confirmamos la correcta antes de salir para que no tengas que hacer una devolución.
              </pre>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-gray-200 font-semibold">Sin stock</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-gray-300">
La referencia que necesitas no la tenemos en este momento. Podemos conseguirla o revisar una marca equivalente con el mismo estándar. ¿Cuál prefieres?
              </pre>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-gray-200 font-semibold">Domicilio tarde</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-gray-300">
Te escribimos para avisarte que el domicilio va con un retraso aproximado de [tiempo real]. Ya está en camino. Te confirmamos cuando llegue.
              </pre>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-gray-200 font-semibold">Pieza incorrecta entregada</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-gray-300">
Entendemos lo que pasó y lo resolvemos hoy. Te enviamos la correcta y coordinamos la devolución sin costo para ti.
              </pre>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-gray-200 font-semibold">Pieza falla después de instalada</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-gray-300">
Si la pieza falló por defecto de fabricación la reponemos. Cuéntanos qué pasó.
Si hay duda: ¿tu mecánico puede confirmarnos cómo quedó montada? Eso nos ayuda a separar fabricación vs instalación.
              </pre>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="fase4">
          <AccordionTrigger className="text-gray-200">Fase 4 — Después de la primera venta</AccordionTrigger>
          <AccordionContent className="text-xs text-gray-400 leading-relaxed space-y-3">
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-gray-200 font-semibold">Pedir reseña (momento exacto)</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-gray-300">
¿Llegó todo bien? Si el servicio estuvo bien y quieres dejarnos una reseña en Google nos ayudas un montón. [enlace]
              </pre>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-gray-200 font-semibold">Guardar el número / lista de difusión</p>
              <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-gray-300">
Guarda este número para futuras cotizaciones. Cuando llegue stock nuevo de referencias de alta rotación te avisamos.
              </pre>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="fase5">
          <AccordionTrigger className="text-gray-200">Fase 5 — Crecimiento (hitos)</AccordionTrigger>
          <AccordionContent className="text-xs text-gray-400 leading-relaxed space-y-2">
            <ul className="space-y-1">
              <li>- Primeras 5 reseñas reales en Google</li>
              <li>- Lista de difusión con 20 contactos activos</li>
              <li>- Agente IA (Mes 2): sugerencia con disclaimer + handoff a WhatsApp</li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
