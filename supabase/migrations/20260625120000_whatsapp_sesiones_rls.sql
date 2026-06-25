-- Sesiones WhatsApp: solo servidor (service role). RLS bloqueaba upsert sin política.
alter table public.whatsapp_sesiones disable row level security;

grant select, insert, update, delete on public.whatsapp_sesiones to service_role;
