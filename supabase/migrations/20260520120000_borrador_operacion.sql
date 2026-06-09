-- Borrador vs operación en vivo (talleres y pedidos de prueba)

alter table talleres_fidelizados
  add column if not exists publicado boolean not null default true;

comment on column talleres_fidelizados.publicado is
  'false = solo pruebas admin; true = taller puede entrar en producción';

-- Talleres ya existentes quedan publicados en operación.
update talleres_fidelizados set publicado = true where publicado is not true;

alter table pedidos
  add column if not exists es_prueba boolean not null default false;

create index if not exists idx_pedidos_es_prueba on pedidos (es_prueba, created_at desc);
