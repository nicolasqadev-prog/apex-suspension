import { Check } from "lucide-react";

import {
  FLUJO_ESTADOS_TALLER,
  etiquetaEstadoTaller,
  indiceFlujoEstado,
} from "@/lib/pedidos-estado-taller";

type Props = {
  estadoActual: string;
  compacto?: boolean;
};

const PASOS = FLUJO_ESTADOS_TALLER.map((e) => ({
  clave: e,
  etiqueta: etiquetaEstadoTaller(e),
}));

export default function PedidoEstadoTimeline({ estadoActual, compacto }: Props) {
  if (estadoActual === "cancelado") {
    return (
      <p className="text-sm text-red-300/90 rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2">
        Pedido cancelado. Escríbenos por WhatsApp si necesitas ayuda.
      </p>
    );
  }

  const activo = indiceFlujoEstado(estadoActual);

  return (
    <ol className={compacto ? "space-y-2" : "space-y-3"}>
      {PASOS.map((paso, i) => {
        const hecho = i < activo;
        const actual = i === activo;
        return (
          <li key={paso.clave} className="flex items-center gap-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                hecho
                  ? "border-emerald-500 bg-emerald-600 text-white"
                  : actual
                    ? "border-emerald-400 bg-emerald-950 text-emerald-300"
                    : "border-gray-700 bg-black/20 text-gray-600"
              }`}
            >
              {hecho ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={`text-sm ${actual ? "text-white font-semibold" : hecho ? "text-gray-400" : "text-gray-600"}`}
            >
              {paso.etiqueta}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
