-- Sesiones del agente WhatsApp (historial + última cotización).
create table if not exists public.whatsapp_sesiones (
  whatsapp text primary key,
  history jsonb not null default '[]'::jsonb,
  last_cotizacion jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  agent_state jsonb not null default '{}'::jsonb
);

create index if not exists whatsapp_sesiones_updated_at_idx
  on public.whatsapp_sesiones (updated_at desc);

alter table public.whatsapp_sesiones enable row level security;
