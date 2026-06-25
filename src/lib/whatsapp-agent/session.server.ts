import {
  freshAgentState,
  freshWaSession,
  type WaAgentState,
  type WaSession,
} from "./types";
import { normalizeSupabaseUrl } from "../supabase-env";
import { normalizeWhatsapp } from "../talleres.server";
import type { MostradorCotizacionLinea } from "../mostrador";

const SESSION_TTL_MS = 2 * 60 * 60_000;
const memory = new Map<string, WaSession>();

function supabaseCfg() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !key) return null;
  return { base: normalizeSupabaseUrl(rawUrl), key };
}

function parseAgentState(raw: unknown): WaAgentState {
  if (!raw || typeof raw !== "object") return freshAgentState();
  const o = raw as Partial<WaAgentState>;
  const phase = o.phase ?? "idle";
  const validPhases = [
    "idle",
    "esperando_aclaracion",
    "cotizado",
    "esperando_confirmacion",
    "pedido_creado",
  ];
  return {
    phase: validPhases.includes(phase) ? phase : "idle",
    borrador: o.borrador ?? null,
    greeted: Boolean(o.greeted),
    aclaracionPendiente: o.aclaracionPendiente ?? null,
    carrito: Array.isArray(o.carrito) ? o.carrito : [],
    confirmacionCarrito: Boolean(o.confirmacionCarrito),
  };
}

function sincronizarSaludo(session: WaSession): void {
  if (
    session.history.some(
      (m) => m.role === "assistant" && /hablas con\s+\*?haku\*?/i.test(m.content),
    )
  ) {
    session.agent.greeted = true;
  }
}

export async function loadWhatsAppSession(phone: string): Promise<WaSession> {
  const key = normalizeWhatsapp(phone);
  const mem = memory.get(key);
  if (mem && Date.now() - mem.updatedAt < SESSION_TTL_MS) {
    sincronizarSaludo(mem);
    return mem;
  }

  const cfg = supabaseCfg();
  if (!cfg) return mem ?? freshWaSession();

  try {
    const url = new URL(`${cfg.base}/rest/v1/whatsapp_sesiones`);
    url.searchParams.set("whatsapp", `eq.${key}`);
    url.searchParams.set("select", "history,last_cotizacion,agent_state,updated_at");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    if (!res.ok) {
      console.error("WhatsApp session load:", res.status, await res.text().catch(() => ""));
      return mem ?? freshWaSession();
    }

    const rows = (await res.json()) as Array<{
      history?: WaSession["history"];
      last_cotizacion?: MostradorCotizacionLinea[];
      agent_state?: unknown;
      updated_at?: string;
    }>;
    const row = rows[0];
    if (!row) {
      console.log("WhatsApp session load: sin fila para", key);
      return mem ?? freshWaSession();
    }

    const updatedAt = row.updated_at ? Date.parse(row.updated_at) : Date.now();
    if (Date.now() - updatedAt > SESSION_TTL_MS) return freshWaSession();

    const session: WaSession = {
      history: Array.isArray(row.history) ? row.history.slice(-20) : [],
      lastCotizacion: Array.isArray(row.last_cotizacion) ? row.last_cotizacion : [],
      agent: parseAgentState(row.agent_state),
      updatedAt,
    };
    sincronizarSaludo(session);
    memory.set(key, session);
    return session;
  } catch (err) {
    console.error("WhatsApp session load error:", err);
    return mem ?? freshWaSession();
  }
}

export async function saveWhatsAppSession(phone: string, session: WaSession): Promise<void> {
  const key = normalizeWhatsapp(phone);
  session.updatedAt = Date.now();
  session.history = session.history.slice(-20);
  sincronizarSaludo(session);
  memory.set(key, session);

  const cfg = supabaseCfg();
  if (!cfg) {
    console.error("WhatsApp session save: sin SUPABASE_URL o SERVICE_ROLE_KEY");
    return;
  }

  const payload = {
    whatsapp: key,
    history: session.history,
    last_cotizacion: session.lastCotizacion,
    agent_state: session.agent,
    updated_at: new Date().toISOString(),
  };

  try {
    // Upsert único: PATCH devolvía 200 aunque no existiera la fila (sesión nunca persistía).
    const res = await fetch(`${cfg.base}/rest/v1/whatsapp_sesiones?on_conflict=whatsapp`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("WhatsApp session save FAILED:", res.status, errText);
      if (errText.includes("agent_state")) {
        console.error(
          "→ Ejecuta en Supabase: supabase/migrations/20260626120000_whatsapp_sesiones_agent_state.sql",
        );
      }
      return;
    }
  } catch (err) {
    console.error("WhatsApp session save error:", err);
  }
}

export type { WaSession } from "./types";
