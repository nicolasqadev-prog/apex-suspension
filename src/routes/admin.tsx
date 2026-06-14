import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import AdminCatalogoStatus from "@/components/AdminCatalogoStatus";
import AdminDemoChecklist from "@/components/AdminDemoChecklist";
import AdminDispatchPanel, { ActiveRouteBanner } from "@/components/AdminDispatchPanel";
import AdminHistorialPanel from "@/components/AdminHistorialPanel";
import AdminInventarioPanel from "@/components/AdminInventarioPanel";
import AdminOperadorAvisos, { scrollToAvisosOperadorAdmin } from "@/components/AdminOperadorAvisos";
import AdminPushPanel from "@/components/AdminPushPanel";
import AdminStockAlertas from "@/components/AdminStockAlertas";
import AdminSoportePwaPanel from "@/components/AdminSoportePwaPanel";
import AdminTalleresPanel from "@/components/AdminTalleresPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_REFRESH_MS } from "@/lib/admin-despachos";
import { ADMIN_PREPARACION_EVENT, isModoPreparacion } from "@/lib/admin-preparacion";
import { cerrarSesionAdminFn, iniciarSesionAdmin, sesionAdminActiva } from "@/lib/admin-auth.functions";
import { googleMapsRouteUrl } from "@/lib/maps-ruta";
import { listarPedidosRecientes } from "@/lib/pedidos.functions";
import { vincularPushConTelefonoTaller } from "@/lib/pwa-engagement";

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

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [{ title: "Admin | Apex Suspensión" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

const STORAGE_KEY = "apex_admin_ui";

function AdminPage() {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "denied" | "allowed">("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void sesionAdminActiva().then((res) => {
      if (res.ok) {
        setStatus("allowed");
        try {
          sessionStorage.setItem(STORAGE_KEY, "1");
        } catch {
          // ignore
        }
      } else {
        setStatus("idle");
      }
    });
  }, []);

  async function onLogin() {
    setStatus("checking");
    setMessage(null);
    try {
      const res = await iniciarSesionAdmin({ data: { pin } });
      if (res.ok) {
        try {
          sessionStorage.setItem(STORAGE_KEY, "1");
        } catch {
          // ignore
        }
        setStatus("allowed");
        setPin("");
        const telOp = (import.meta.env.VITE_WHATSAPP_APEX as string | undefined)?.trim();
        if (telOp) void vincularPushConTelefonoTaller(telOp);
        return;
      }
      setStatus("denied");
      setMessage(res.reason ?? "PIN incorrecto");
    } catch (err) {
      setStatus("denied");
      setMessage(err instanceof Error ? err.message : "No se pudo validar el PIN");
    }
  }

  async function onLogout() {
    await cerrarSesionAdminFn();
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setStatus("idle");
    setPin("");
    setMessage(null);
  }

  if (status === "checking" && !message) {
    return (
      <div className="min-h-screen bg-[oklch(0.18_0.04_250)] text-gray-200 flex items-center justify-center">
        <p className="text-sm text-gray-400">Verificando sesión…</p>
      </div>
    );
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

type AdminTab = "talleres" | "inventario" | "operacion" | "historial" | "soporte";

function AdminAuthed({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<AdminTab>("talleres");
  const [modoPreparacion, setModoPreparacion] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidosRefreshKey, setPedidosRefreshKey] = useState(0);
  const [checklistRefreshKey, setChecklistRefreshKey] = useState(0);
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
          ventana: modoPreparacion ? "minutos" : "dia",
          minutes: 120,
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
      setPedidosRefreshKey((k) => k + 1);
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
    const interval = window.setInterval(() => void refresh(true), ADMIN_REFRESH_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoPreparacion]);

  useEffect(() => {
    const tel = (import.meta.env.VITE_WHATSAPP_APEX as string | undefined)?.trim();
    if (!tel) return;
    void vincularPushConTelefonoTaller(tel);
  }, []);

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

  function irAAvisosOperador() {
    scrollToAvisosOperadorAdmin();
  }

  return (
    <div className="min-h-screen bg-[oklch(0.18_0.04_250)] text-gray-200 antialiased">
      <ActiveRouteBanner pedidosEnRuta={pedidosEnRuta} />
      <header className="border-b border-white/10 px-3 sm:px-4 py-3 sm:py-4">
        <div className="max-w-4xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">Administración</h1>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 leading-snug">
              {modoPreparacion
                ? "Modo prueba · 2 h · refresh 15 min"
                : "Pedidos del día · Colombia · refresh 15 min"}
            </p>
            <AdminCatalogoStatus />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={irAAvisosOperador}
              className="border-emerald-600/50 text-emerald-200 min-h-10 px-2.5 sm:px-3 touch-manipulation"
              title="Ir a avisos de pedidos"
            >
              <Bell className="h-4 w-4" />
              <span className="sr-only sm:not-sr-only sm:ml-1 sm:inline text-xs">Avisos</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              className="border-gray-600 text-gray-300 min-h-10 px-2.5 sm:px-3 text-xs touch-manipulation"
              disabled={loading}
            >
              {loading ? "…" : "Actualizar"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="border-gray-600 text-gray-300 min-h-10 px-2.5 sm:px-3 text-xs touch-manipulation"
            >
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <AdminDemoChecklist
          refreshKey={checklistRefreshKey}
          onIrSoporte={() => setTab("soporte")}
        />
        <AdminOperadorAvisos onVinculado={() => setChecklistRefreshKey((k) => k + 1)} />
        <nav className="mb-4 sm:mb-6 border-b border-white/10 pb-2 -mx-3 sm:-mx-4 px-3 sm:px-4 overflow-x-auto overscroll-x-contain">
          <div className="flex gap-1.5 min-w-max pb-1">
          {(
            [
              ["talleres", "Talleres", "Talleres"],
              ["inventario", "Inventario", "Stock"],
              ["operacion", "Operación", "Operación y pedidos"],
              ["historial", "Historial", "Historial"],
              ["soporte", "Soporte", "Soporte PWA"],
            ] as const
          ).map(([id, labelMobile, labelDesktop]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`text-xs font-semibold px-3 py-2 rounded-md transition-colors whitespace-nowrap touch-manipulation ${
                tab === id
                  ? "bg-[oklch(0.7_0.2_40)] text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="sm:hidden">{labelMobile}</span>
              <span className="hidden sm:inline">{labelDesktop}</span>
            </button>
          ))}
          </div>
        </nav>

        {modoPreparacion && (
          <p className="mb-4 text-xs text-amber-200/90 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2">
            Modo preparación activo: talleres nuevos en borrador, pedidos de prueba separados.
            Publica desde la pestaña Soporte PWA cuando vayas a operación real.
          </p>
        )}

        {tab === "talleres" && <AdminTalleresPanel modoPreparacion={modoPreparacion} />}

        {tab === "inventario" && <AdminInventarioPanel />}

        {tab === "historial" && <AdminHistorialPanel modoPreparacion={modoPreparacion} />}

        {tab === "soporte" && (
          <AdminSoportePwaPanel onPreparacionChange={() => setModoPreparacion(isModoPreparacion())} />
        )}

        {tab === "operacion" && (
          <>
            <AdminStockAlertas refreshKey={pedidosRefreshKey} />
            {pedidosPendientes > 0 && (
              <p className="mb-4 text-sm text-emerald-100 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-3">
                <strong className="text-emerald-300">{pedidosPendientes}</strong>{" "}
                {pedidosPendientes === 1 ? "pedido nuevo" : "pedidos nuevos"} sin revisar (estado
                enviado). Actualización automática cada 15 min (o push al instante).
              </p>
            )}
            <AdminPushPanel pedidos={pedidos} onPedidosChange={() => void refresh()} />

            <div className="rounded-xl border border-gray-800 bg-[oklch(0.14_0.04_250)] p-5 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Todos los pedidos de la ventana</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {modoPreparacion
                      ? "Prueba: últimas 2 h. Cambia estados arriba; enruta en el panel de despachos."
                      : "Hoy (Colombia): cambia estados aquí; arma rutas en el panel de despachos abajo."}
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
                    {modoPreparacion
                      ? "No hay pedidos de prueba en las últimas 2 horas."
                      : "No hay pedidos registrados hoy."}
                  </p>
                )}
              </div>
            </div>

            <AdminDispatchPanel pedidos={pedidos} ventanaDia={!modoPreparacion} />
          </>
        )}
      </main>
    </div>
  );
}
