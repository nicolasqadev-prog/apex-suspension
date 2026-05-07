-- =============================================================
-- Apex Suspensión — Talleres fidelizados (precios / contra entrega)
-- Moneda: COP (Colombia)
-- Acceso: SOLO mediante service_role (RLS deny anon/authenticated)
-- =============================================================

create table talleres_fidelizados (
  id                    uuid         primary key default gen_random_uuid(),
  whatsapp              text         not null unique,
  nombre_taller         text         not null,
  descuento_porcentaje  numeric(5,2) not null default 0,
  contra_entrega_habilitada boolean  not null default true,
  activo                boolean      not null default true,
  created_at            timestamptz  not null default now()
);

alter table talleres_fidelizados enable row level security;

-- Sin policies → RLS vacío = acceso denegado a anon y authenticated.
-- La service_role key bypasea RLS por diseño de Supabase.
create policy "sin_acceso_publico_talleres_fidelizados"
  on talleres_fidelizados for all
  to anon, authenticated
  using (false);

