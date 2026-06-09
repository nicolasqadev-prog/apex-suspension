-- Datos maestros catálogo (punto 4): proveedor, línea vehículo, precio taller, categoría agrupada.

alter table productos
  add column if not exists marca_producto text,
  add column if not exists linea_vehiculo text not null default 'liviano',
  add column if not exists precio_taller numeric(12,2) check (precio_taller is null or precio_taller >= 0),
  add column if not exists categoria_grupo text;

create index if not exists idx_productos_marca_producto on productos (marca_producto);
create index if not exists idx_productos_linea_vehiculo on productos (linea_vehiculo);
create index if not exists idx_productos_categoria_grupo on productos (categoria_grupo);

comment on column productos.marca is 'Marca del vehículo (Chevrolet, Renault…)';
comment on column productos.marca_producto is 'Marca proveedor del repuesto (KTC, Districamiones, Wurtex…)';
comment on column productos.linea_vehiculo is 'liviano | camion | utilitario';
comment on column productos.precio_taller is 'Precio taller de referencia (fórmula CR÷0,78 o descuento PWA en bodega)';
comment on column productos.categoria_grupo is 'Categoría normalizada para filtros UI';
