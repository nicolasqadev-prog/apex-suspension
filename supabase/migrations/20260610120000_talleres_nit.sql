-- NIT de la empresa del taller (facturación / datos fiscales)
alter table talleres_fidelizados
  add column if not exists nit text;

comment on column talleres_fidelizados.nit is 'NIT de la empresa del taller aliado';
