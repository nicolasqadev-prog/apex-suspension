-- =============================================================
-- Apex Suspensión — Setup PRODUCCIÓN talleres fidelizados
-- Pegar TODO en Supabase → SQL Editor → Run (una sola vez)
-- Es idempotente: puedes ejecutarlo de nuevo sin romper nada.
-- =============================================================

-- 1) Tabla base (por si el proyecto es nuevo)
create table if not exists talleres_fidelizados (
  id                    uuid         primary key default gen_random_uuid(),
  whatsapp              text         not null unique,
  nombre_taller         text         not null,
  descuento_porcentaje  numeric(5,2) not null default 16.67,
  contra_entrega_habilitada boolean  not null default true,
  activo                boolean      not null default true,
  created_at            timestamptz  not null default now()
);

alter table talleres_fidelizados enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'talleres_fidelizados'
      and policyname = 'sin_acceso_publico_talleres_fidelizados'
  ) then
    create policy "sin_acceso_publico_talleres_fidelizados"
      on talleres_fidelizados for all
      to anon, authenticated
      using (false);
  end if;
end $$;

-- 2) Borrador vs aliado certificado (OBLIGATORIO para producción)
alter table talleres_fidelizados
  add column if not exists publicado boolean not null default true;

comment on column talleres_fidelizados.publicado is
  'false = borrador (solo pruebas admin); true = aliado certificado, puede entrar en /taller/acceso';

update talleres_fidelizados set publicado = true where publicado is not true;

-- 3) Entrega por taller (municipio + dirección en cada pedido)
alter table talleres_fidelizados
  add column if not exists municipio text,
  add column if not exists direccion_entrega text;

comment on column talleres_fidelizados.municipio is
  'Municipio de entrega habitual del taller aliado';
comment on column talleres_fidelizados.direccion_entrega is
  'Dirección / punto de entrega habitual del taller aliado';

-- 4) Pedidos de prueba (modo preparación admin)
alter table pedidos
  add column if not exists es_prueba boolean not null default false;

create index if not exists idx_pedidos_es_prueba on pedidos (es_prueba, created_at desc);

-- 5) Verificación: columnas listas
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'talleres_fidelizados'
order by ordinal_position;
