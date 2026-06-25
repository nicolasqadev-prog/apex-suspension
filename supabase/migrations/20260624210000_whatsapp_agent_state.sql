-- Estado del agente WhatsApp (fases, borrador, saludo).
alter table public.whatsapp_sesiones
  add column if not exists agent_state jsonb not null default '{}'::jsonb;
