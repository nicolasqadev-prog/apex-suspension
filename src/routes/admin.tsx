import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import AdminDispatchPanel, { ActiveRouteBanner } from "@/components/AdminDispatchPanel";
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

const verifyAdminPin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    if (!data || typeof data !== "object") throw new Error("Datos inválidos");
    const pin = (data as { pin?: unknown }).pin;
    if (typeof pin !== "string") throw new Error("PIN inválido");
    return { pin };
  })
  .handler(async ({ data }) => {
    // En desarrollo, PIN de prueba si no hay variable (cambiar en producción vía ADMIN_PIN).
    const expected = process.env.ADMIN_PIN ?? (import.meta.env.DEV ? "Panel1234" : undefined);
    if (!expected) {
      return { ok: false, reason: "ADMIN_PIN no configurado en el servidor" } as const;
    }
    const ok = data.pin === expected;
    return { ok } as const;
  });

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [{ title: "Admin | Apex Suspensión" }],
  }),
});

const STORAGE_KEY = "apex_admin_session";

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
  const [minutes] = useState(30);
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

        <AdminDispatchPanel />
      </main>
    </div>
  );
}
