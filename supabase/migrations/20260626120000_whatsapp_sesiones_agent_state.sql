-- Si creaste whatsapp_sesiones a mano, puede faltar agent_state (fase, aclaración, saludo).
alter table public.whatsapp_sesiones
  add column if not exists agent_state jsonb not null default '{}'::jsonb;

alter table public.whatsapp_sesiones disable row level security;

grant select, insert, update, delete on public.whatsapp_sesiones to service_role;
