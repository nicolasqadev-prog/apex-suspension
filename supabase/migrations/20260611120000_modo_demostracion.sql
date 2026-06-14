-- Modo demostración en campo: pedidos de prueba sin descontar stock real
create table if not exists apex_operacion_config (
  id int primary key default 1 check (id = 1),
  modo_demostracion boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into apex_operacion_config (id, modo_demostracion)
values (1, false)
on conflict (id) do nothing;

alter table apex_operacion_config enable row level security;

create policy "sin_acceso_publico_apex_operacion_config"
  on apex_operacion_config for all
  to anon, authenticated
  using (false);

comment on table apex_operacion_config is 'Flags operativos Apex (solo service_role)';
