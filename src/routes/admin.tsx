import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import AdminCatalogoStatus from "@/components/AdminCatalogoStatus";
import AdminDispatchPanel, { ActiveRouteBanner } from "@/components/AdminDispatchPanel";
import AdminInventarioPanel from "@/components/AdminInventarioPanel";
import AdminPushPanel from "@/components/AdminPushPanel";
import AdminSoportePwaPanel from "@/components/AdminSoportePwaPanel";
import AdminTalleresPanel from "@/components/AdminTalleresPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_PREPARACION_EVENT, isModoPreparacion } from "@/lib/admin-preparacion";
import { listarPedidosRecientes } from "@/lib/pedidos.functions";
import { canSuggestNotifications, subscribeAndRegisterPush } from "@/lib/pwa-engagement";

type Pedido = {
  id: string;
  estado: string;
  taller_nombre: string;
  telefono: string;
  direccion: string | null;
  notas: string | null;
  created_at: string;
  es_prueba?: boolean;
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

type AdminTab = "talleres" | "inventario" | "operacion" | "soporte";

function AdminAuthed({ onLogout }: { onLogout: () => void }) {
  const adminPin =
    typeof window !== "undefined" ? (window.sessionStorage.getItem(PIN_STORAGE_KEY) ?? "") : "";
  const [tab, setTab] = useState<AdminTab>("talleres");
  const [minutes] = useState(120);
  const [modoPreparacion, setModoPreparacion] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const pedidosConocidosRef = useRef<Set<string>>(new Set());
  const primeraCargaPedidosRef = useRef(true);

  useEffect(() => {
    setModoPreparacion(isModoPreparacion());
    const onChange = () => setModoPreparacion(isModoPreparacion());
    window.addEventListener(ADMIN_PREPARACION_EVENT, onChange);
    return () => window.removeEventListener(ADMIN_PREPARACION_EVENT, onChange);
  }, []);

  async function refresh(silent = false) {
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const res = await listarPedidosRecientes({
        data: {
          minutes,
          soloPrueba: modoPreparacion,
          soloProduccion: !modoPreparacion,
        },
      });
      if (!res.ok) {
        if (!silent) {
          setError(res.reason);
          setPedidos([]);
        }
        return;
      }
      const lista = res.pedidos as Pedido[];
      const nuevos = lista.filter((p) => !pedidosConocidosRef.current.has(p.id));
      if (!primeraCargaPedidosRef.current && nuevos.length > 0) {
        const primero = nuevos[0];
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Nuevo pedido portal · Apex", {
            body: `${primero.taller_nombre} — revisa en Operación y pedidos`,
            tag: `apex-pedido-${primero.id}`,
          });
        }
      }
      for (const p of lista) pedidosConocidosRef.current.add(p.id);
      primeraCargaPedidosRef.current = false;
      setPedidos(lista);
      if (!silent) setSelected({});
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "No se pudo cargar pedidos");
        setPedidos([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    pedidosConocidosRef.current = new Set();
    primeraCargaPedidosRef.current = true;
    void refresh();
    const interval = window.setInterval(() => void refresh(true), 45_000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoPreparacion]);

  const selectedPedidos = pedidos.filter((p) => selected[p.id]);
  const routeUrl = googleMapsRouteUrl(
    selectedPedidos.map((p) => p.direccion ?? "").filter(Boolean),
  );
  const pedidosEnRuta = pedidos.filter((p) => p.estado === "en_ruta").length;
  const pedidosPendientes = pedidos.filter((p) => p.estado === "borrador").length;

  function abrirRutaMaps() {
    if (!routeUrl) return;
    window.open(routeUrl, "_blank", "noopener,noreferrer");
  }

  async function activarNotificacionesAdmin() {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    const telOperador = (import.meta.env.VITE_WHATSAPP_APEX as string | undefined)?.trim();
    await subscribeAndRegisterPush(telOperador ? { telefono: telOperador } : undefined);
  }

  return (
    <div className="min-h-screen bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <ActiveRouteBanner pedidosEnRuta={pedidosEnRuta} />
      <header className="border-b border-white/10 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Administración</h1>
            <p className="text-xs text-gray-500 mt-1">
              Uso interno (despachos, rutas y operación). Ventana actual: {minutes} min.
            </p>
            <AdminCatalogoStatus adminPin={adminPin} />
          </div>
          <div className="flex items-center gap-2">
            {canSuggestNotifications() && (
              <Button
                variant="outline"
                onClick={() => void activarNotificacionesAdmin()}
                className="border-emerald-600/50 text-emerald-200"
                title="Para recibir push cuando entra un pedido nuevo"
              >
                <Bell className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Avisos pedidos</span>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => void refresh()}
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
        <nav className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-3">
          {(
            [
              ["talleres", "Talleres"],
              ["inventario", "Inventario"],
              ["operacion", "Operación y pedidos"],
              ["soporte", "Soporte PWA"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`text-xs sm:text-sm font-semibold px-3 py-2 rounded-md transition-colors ${
                tab === id
                  ? "bg-[oklch(0.7_0.2_40)] text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {modoPreparacion && (
          <p className="mb-4 text-xs text-amber-200/90 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2">
            Modo preparación activo: talleres nuevos en borrador, pedidos de prueba separados.
            Publica desde la pestaña Soporte PWA cuando vayas a operación real.
          </p>
        )}

        {tab === "talleres" && (
          <AdminTalleresPanel adminPin={adminPin} modoPreparacion={modoPreparacion} />
        )}

        {tab === "inventario" && <AdminInventarioPanel adminPin={adminPin} />}

        {tab === "soporte" && (
          <AdminSoportePwaPanel
            adminPin={adminPin}
            onPreparacionChange={() => setModoPreparacion(isModoPreparacion())}
          />
        )}

        {tab === "operacion" && (
          <>
            {pedidosPendientes > 0 && (
              <p className="mb-4 text-sm text-emerald-100 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-3">
                <strong className="text-emerald-300">{pedidosPendientes}</strong>{" "}
                {pedidosPendientes === 1 ? "pedido nuevo" : "pedidos nuevos"} sin revisar (estado
                enviado). Actualización automática cada 45 s.
              </p>
            )}
            <AdminPushPanel adminPin={adminPin} pedidos={pedidos} onPedidosChange={() => void refresh()} />

            <div className="rounded-xl border border-gray-800 bg-[oklch(0.14_0.04_250)] p-5 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Pedidos recientes</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {modoPreparacion
                      ? "Solo pedidos de prueba (simulacros). No uses para rutas reales."
                      : "Pedidos reales. Selecciona para ruta en Google Maps."}
                  </p>
                </div>
                <Button
                  type="button"
                  className="bg-[oklch(0.7_0.2_40)] hover:bg-orange-600 text-white font-semibold disabled:opacity-40"
                  disabled={!routeUrl}
                  onClick={abrirRutaMaps}
                >
                  Abrir ruta (Maps)
                </Button>
              </div>

              {!routeUrl && pedidos.length > 0 && (
                <p className="mt-3 text-xs text-amber-300/90">
                  Marca uno o más pedidos con dirección para abrir la ruta en Google Maps.
                </p>
              )}

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
                          <p className="text-sm font-semibold text-white">
                            {p.taller_nombre}
                            {p.es_prueba && (
                              <span className="ml-2 text-[10px] font-normal text-amber-400">
                                prueba
                              </span>
                            )}
                          </p>
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

            <AdminDispatchPanel pedidos={pedidos} />
          </>
        )}
      </main>
    </div>
  );
}
