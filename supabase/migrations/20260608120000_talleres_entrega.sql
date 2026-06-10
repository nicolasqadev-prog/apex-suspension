-- Datos de entrega por taller (capturados en alta admin, usados en cada pedido)

alter table talleres_fidelizados
  add column if not exists municipio text,
  add column if not exists direccion_entrega text;

comment on column talleres_fidelizados.municipio is
  'Municipio de entrega habitual del taller aliado';
comment on column talleres_fidelizados.direccion_entrega is
  'Dirección / punto de entrega habitual del taller aliado';
