import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { allowTallerBorradorEnCliente } from "@/lib/admin-preparacion";
import { iniciarSesionTaller } from "@/lib/taller.portal.functions";
import type { TallerSesion } from "@/lib/taller.types";
import { vaciarCarritoTaller } from "@/lib/taller-carrito";
import {
  TALLER_WHATSAPP_STORAGE_KEY,
  normalizeWhatsappTaller,
} from "@/lib/taller-whatsapp";
import { usePersistentState } from "@/lib/usePersistentState";

export const TALLER_WHATSAPP_KEY = TALLER_WHATSAPP_STORAGE_KEY;

type TallerSessionValue = {
  taller: TallerSesion | null;
  loading: boolean;
  whatsappGuardado: string;
  login: (whatsapp: string) => Promise<{ ok: boolean; reason?: string }>;
  logout: () => void;
};

const TallerSessionContext = createContext<TallerSessionValue | null>(null);

export function TallerSessionProvider({ children }: { children: ReactNode }) {
  const [whatsappGuardado, setWhatsappGuardado] = usePersistentState(TALLER_WHATSAPP_KEY, "");
  const [taller, setTaller] = useState<TallerSesion | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const w = normalizeWhatsappTaller(whatsappGuardado);
    if (!w || w.length < 10) {
      setTaller(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    iniciarSesionTaller({
      data: { whatsapp: w, allowNoPublicado: allowTallerBorradorEnCliente() },
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.taller) {
          setTaller(res.taller);
          if (w !== whatsappGuardado) setWhatsappGuardado(w);
        } else {
          setTaller(null);
          if (res.reason !== "pendiente_certificacion") {
            setWhatsappGuardado("");
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [whatsappGuardado, setWhatsappGuardado]);

  const login = useCallback(
    async (raw: string) => {
      const w = normalizeWhatsappTaller(raw);
      if (w.length < 10) {
        return { ok: false, reason: "whatsapp_invalido" };
      }
      setLoading(true);
      try {
        const res = await iniciarSesionTaller({
          data: { whatsapp: w, allowNoPublicado: allowTallerBorradorEnCliente() },
        });
        if (!res.ok) {
          setTaller(null);
          return { ok: false, reason: res.reason ?? "no_autorizado" };
        }
        setTaller(res.taller);
        setWhatsappGuardado(w);
        return { ok: true };
      } finally {
        setLoading(false);
      }
    },
    [setWhatsappGuardado],
  );

  const logout = useCallback(() => {
    setWhatsappGuardado("");
    setTaller(null);
    vaciarCarritoTaller();
  }, [setWhatsappGuardado]);

  const value = useMemo(
    () => ({
      taller,
      loading,
      whatsappGuardado,
      login,
      logout,
    }),
    [taller, loading, whatsappGuardado, login, logout],
  );

  return <TallerSessionContext.Provider value={value}>{children}</TallerSessionContext.Provider>;
}

export function useTallerSession(): TallerSessionValue {
  const ctx = useContext(TallerSessionContext);
  if (!ctx) {
    throw new Error("useTallerSession debe usarse dentro de TallerSessionProvider");
  }
  return ctx;
}
