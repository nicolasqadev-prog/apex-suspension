-- Suscripciones Web Push (clientes PWA). Acceso solo vía service_role.

create table push_subscriptions (
  id           uuid        primary key default gen_random_uuid(),
  endpoint     text        not null unique,
  keys_p256dh  text        not null,
  keys_auth    text        not null,
  telefono     text,
  user_agent   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_push_subscriptions_telefono on push_subscriptions (telefono);
create index idx_push_subscriptions_updated on push_subscriptions (updated_at desc);

create trigger trg_push_subscriptions_updated_at
  before update on push_subscriptions
  for each row
  execute function fn_set_updated_at();

alter table push_subscriptions enable row level security;

create policy "sin_acceso_publico_push_subscriptions"
  on push_subscriptions for all
  to anon, authenticated
  using (false);
