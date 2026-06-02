import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  desactivarTallerAdmin,
  eliminarTallerAdmin,
  guardarTallerAdmin,
  listarTalleresAdmin,
  reactivarTallerAdmin,
} from "@/lib/admin-talleres.functions";
import type { TallerFidelizadoAdmin } from "@/lib/talleres-admin.server";

type Props = {
  adminPin: string;
};

const emptyForm = {
  whatsapp: "",
  nombreTaller: "",
  descuentoPorcentaje: "10",
  contraEntregaHabilitada: true,
};

export default function AdminTalleresPanel({ adminPin }: Props) {
  const [talleres, setTalleres] = useState<TallerFidelizadoAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingWhatsapp, setEditingWhatsapp] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!adminPin) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await listarTalleresAdmin({ data: { adminPin } });
      if (!res.ok) {
        setMessage(res.reason);
        setTalleres([]);
        return;
      }
      setTalleres(res.talleres);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error al cargar talleres");
    } finally {
      setLoading(false);
    }
  }, [adminPin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onGuardar(e: React.FormEvent) {
    e.preventDefault();
    if (!adminPin) return;
    setMessage(null);
    const res = await guardarTallerAdmin({
      data: {
        adminPin,
        whatsapp: form.whatsapp,
        nombreTaller: form.nombreTaller,
        descuentoPorcentaje: Number(form.descuentoPorcentaje) || 0,
        contraEntregaHabilitada: form.contraEntregaHabilitada,
        activo: true,
      },
    });
    if (!res.ok) {
      setMessage(res.reason);
      return;
    }
    setMessage(
      editingWhatsapp
        ? `Taller actualizado: ${res.taller.nombreTaller}`
        : `Taller registrado: ${res.taller.nombreTaller}. Ya puede entrar con ese WhatsApp.`,
    );
    setForm(emptyForm);
    setEditingWhatsapp(null);
    void refresh();
  }

  function onEditar(t: TallerFidelizadoAdmin) {
    setEditingWhatsapp(t.whatsapp);
    setForm({
      whatsapp: t.whatsapp,
      nombreTaller: t.nombreTaller,
      descuentoPorcentaje: String(t.descuentoPorcentaje),
      contraEntregaHabilitada: t.contraEntregaHabilitada,
    });
  }

  async function onDesactivar(whatsapp: string) {
    if (!adminPin) return;
    const res = await desactivarTallerAdmin({ data: { adminPin, whatsapp } });
    if (!res.ok) {
      setMessage(res.reason);
      return;
    }
    setMessage("Taller desactivado. Ya no verá precios de taller.");
    void refresh();
  }

  async function onReactivar(whatsapp: string) {
    if (!adminPin) return;
    const res = await reactivarTallerAdmin({ data: { adminPin, whatsapp } });
    if (!res.ok) {
      setMessage(res.reason);
      return;
    }
    setMessage("Taller reactivado.");
    void refresh();
  }

  async function onEliminar(whatsapp: string, nombre: string) {
    if (!adminPin) return;
    if (
      !window.confirm(
        `¿Eliminar permanentemente "${nombre}"? No se puede deshacer. Si solo quieres cortar acceso, usa Desactivar.`,
      )
    ) {
      return;
    }
    const res = await eliminarTallerAdmin({ data: { adminPin, whatsapp } });
    if (!res.ok) {
      setMessage(res.reason);
      return;
    }
    setMessage("Taller eliminado de la base de datos.");
    void refresh();
  }

  function abrirCatalogoComo(t: TallerFidelizadoAdmin) {
    try {
      localStorage.setItem("apex.taller.whatsapp", JSON.stringify(t.whatsapp));
    } catch {
      // ignore
    }
    window.open("/catalogo", "_blank", "noreferrer");
  }

  return (
    <section className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-5 mb-6">
      <div className="flex items-start gap-2 mb-4">
        <Wrench className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">Talleres fidelizados</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Alta y baja en tiempo real. Al guardar, el taller entra con su WhatsApp en{" "}
            <strong className="text-gray-300">/taller/acceso</strong> y ve el catálogo con su
            descuento.
          </p>
        </div>
      </div>

      <form onSubmit={onGuardar} className="grid gap-3 sm:grid-cols-2 mb-6">
        <label className="text-xs text-gray-400 block sm:col-span-2">
          WhatsApp (solo dígitos, ej. 573001234567)
          <Input
            value={form.whatsapp}
            onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
            disabled={!!editingWhatsapp}
            className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
            required
          />
        </label>
        <label className="text-xs text-gray-400 block sm:col-span-2">
          Nombre del taller
          <Input
            value={form.nombreTaller}
            onChange={(e) => setForm((f) => ({ ...f, nombreTaller: e.target.value }))}
            className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
            required
          />
        </label>
        <label className="text-xs text-gray-400 block">
          Descuento %
          <Input
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={form.descuentoPorcentaje}
            onChange={(e) => setForm((f) => ({ ...f, descuentoPorcentaje: e.target.value }))}
            className="mt-1 bg-[oklch(0.14_0.04_250)] border-gray-700 text-white"
          />
        </label>
        <label className="text-xs text-gray-400 flex items-end gap-2 pb-2">
          <input
            type="checkbox"
            checked={form.contraEntregaHabilitada}
            onChange={(e) =>
              setForm((f) => ({ ...f, contraEntregaHabilitada: e.target.checked }))
            }
          />
          Contra entrega habilitada
        </label>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
            disabled={loading}
          >
            <Plus className="h-4 w-4 mr-1" />
            {editingWhatsapp ? "Actualizar taller" : "Registrar taller"}
          </Button>
          {editingWhatsapp && (
            <Button
              type="button"
              variant="outline"
              className="border-gray-600 text-gray-300"
              onClick={() => {
                setEditingWhatsapp(null);
                setForm(emptyForm);
              }}
            >
              Cancelar edición
            </Button>
          )}
        </div>
      </form>

      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-semibold text-gray-300">
          Registrados ({talleres.length}) · {loading ? "actualizando…" : "en vivo"}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-gray-600 text-gray-300 text-xs"
          onClick={() => void refresh()}
          disabled={loading}
        >
          Actualizar lista
        </Button>
      </div>

      <ul className="space-y-2 max-h-80 overflow-y-auto">
        {talleres.map((t) => (
          <li
            key={t.id}
            className={`rounded-lg border p-3 text-sm ${
              t.activo ? "border-white/10 bg-black/20" : "border-red-900/40 bg-red-950/20 opacity-80"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
              <div>
                <p className="font-semibold text-white">{t.nombreTaller}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{t.whatsapp}</p>
                <p className="text-xs text-emerald-300/90 mt-1">
                  {t.descuentoPorcentaje}% desc. · CE: {t.contraEntregaHabilitada ? "sí" : "no"} ·{" "}
                  {t.activo ? "activo" : "inactivo"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs border-gray-600 h-8"
                  onClick={() => onEditar(t)}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs border-emerald-700 text-emerald-200 h-8"
                  onClick={() => abrirCatalogoComo(t)}
                >
                  Ver catálogo
                </Button>
                {t.activo ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs border-amber-700 text-amber-200 h-8"
                    onClick={() => void onDesactivar(t.whatsapp)}
                  >
                    Desactivar
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs border-emerald-700 h-8"
                    onClick={() => void onReactivar(t.whatsapp)}
                  >
                    Reactivar
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs border-red-800 text-red-300 h-8 px-2"
                  onClick={() => void onEliminar(t.whatsapp, t.nombreTaller)}
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </li>
        ))}
        {!loading && talleres.length === 0 && (
          <p className="text-xs text-gray-500 py-4 text-center">No hay talleres registrados aún.</p>
        )}
      </ul>

      {message && (
        <p className="mt-4 text-xs text-gray-300 leading-relaxed" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
