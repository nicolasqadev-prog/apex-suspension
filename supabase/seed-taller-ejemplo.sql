-- Ejemplo: taller fidelizado de prueba (ejecutar manualmente en Supabase SQL Editor).
-- Reemplaza el WhatsApp por el número real del taller (solo dígitos, ej. 573001234567).

insert into talleres_fidelizados (
  whatsapp,
  nombre_taller,
  descuento_porcentaje,
  contra_entrega_habilitada,
  activo,
  publicado
) values (
  '573001234567',
  'Taller Demo Apex',
  16.67,
  false,
  true,
  true
)
on conflict (whatsapp) do update set
  nombre_taller = excluded.nombre_taller,
  descuento_porcentaje = excluded.descuento_porcentaje,
  contra_entrega_habilitada = excluded.contra_entrega_habilitada,
  activo = excluded.activo,
  publicado = true;
