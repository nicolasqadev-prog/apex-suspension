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
  const validPhases = ["idle", "cotizado", "esperando_confirmacion", "pedido_creado"];
  return {
    phase: validPhases.includes(phase) ? phase : "idle",
    borrador: o.borrador ?? null,
    greeted: Boolean(o.greeted),
  };
}

export async function loadWhatsAppSession(phone: string): Promise<WaSession> {
  const key = normalizeWhatsapp(phone);
  const mem = memory.get(key);
  if (mem && Date.now() - mem.updatedAt < SESSION_TTL_MS) return mem;

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
    if (!res.ok) return mem ?? freshWaSession();

    const rows = (await res.json()) as Array<{
      history?: WaSession["history"];
      last_cotizacion?: MostradorCotizacionLinea[];
      agent_state?: unknown;
      updated_at?: string;
    }>;
    const row = rows[0];
    if (!row) return mem ?? freshWaSession();

    const updatedAt = row.updated_at ? Date.parse(row.updated_at) : Date.now();
    if (Date.now() - updatedAt > SESSION_TTL_MS) return freshWaSession();

    const session: WaSession = {
      history: Array.isArray(row.history) ? row.history.slice(-20) : [],
      lastCotizacion: Array.isArray(row.last_cotizacion) ? row.last_cotizacion : [],
      agent: parseAgentState(row.agent_state),
      updatedAt,
    };
    memory.set(key, session);
    return session;
  } catch {
    return mem ?? freshWaSession();
  }
}

export async function saveWhatsAppSession(phone: string, session: WaSession): Promise<void> {
  const key = normalizeWhatsapp(phone);
  session.updatedAt = Date.now();
  session.history = session.history.slice(-20);
  memory.set(key, session);

  const cfg = supabaseCfg();
  if (!cfg) return;

  try {
    await fetch(`${cfg.base}/rest/v1/whatsapp_sesiones`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        whatsapp: key,
        history: session.history,
        last_cotizacion: session.lastCotizacion,
        agent_state: session.agent,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Memoria local del isolate sigue válida.
  }
}

export type { WaSession } from "./types";
