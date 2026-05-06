-- =============================================================
-- Apex Suspensión — Migración inicial
-- Negocio: Apex Suspensión · Presencia técnica: Ockham Systems
-- Moneda: COP (Colombia)
-- =============================================================
-- INVARIANTE DE STOCK:
--   productos.stock_actual es siempre igual a:
--     SUM(delta) de stock_movimientos para ese producto_id.
--   Nunca modifiques stock_actual directamente. Solo insertar en
--   stock_movimientos (delta positivo = entrada, negativo = salida).
--   El trigger trg_sync_stock mantiene la columna sincronizada.
-- =============================================================

-- -------------------------------------------------------------
-- TIPOS ENUMERADOS
-- -------------------------------------------------------------

-- Estados del pedido según docs/mvp-flujo.md.
-- Se agrega "cancelado": coherente con cualquier flujo real de
-- ventas; permite que Mostrador o un humano aborte sin borrar el
-- registro histórico.
create type estado_pedido as enum (
  'borrador',     -- conversación sin compromiso
  'cotizado',     -- precio/cantidad propuestos al cliente
  'confirmado',   -- cliente aceptó; pasa a operación
  'empacando',    -- bodega preparando el despacho
  'en_ruta',      -- repartidor en camino
  'entregado',    -- recibido en el taller
  'cancelado'     -- abortado antes de despachar (agregado: necesario para trazabilidad)
);


-- -------------------------------------------------------------
-- TABLA: productos
-- Columnas exactas según docs/esquema-datos.md.
-- Se agrega stock_actual (entero) mantenido por trigger; es
-- redundante con SUM(delta) pero evita un full-scan en cada
-- consulta de disponibilidad.
-- -------------------------------------------------------------
create table productos (
  id           uuid        primary key default gen_random_uuid(),
  slug         text        not null unique,       -- clave de URL (/repuesto/:slug)
  referencia   text        not null unique,       -- código KTC visible al cliente
  nombre       text        not null,
  aplicacion   text,                              -- ej. "Chevrolet Spark GT 2011-2016"
  categoria    text,
  marca        text        not null default 'KTC',
  precio_lista numeric(12,2) not null check (precio_lista >= 0),
  activo       boolean     not null default true,
  -- stock_actual: columna desnormalizada, NO en esquema-datos.md original
  -- pero necesaria para lecturas rápidas sin agregar movimientos.
  stock_actual integer     not null default 0 check (stock_actual >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_productos_referencia on productos (referencia);
create index idx_productos_categoria  on productos (categoria);
create index idx_productos_activo     on productos (activo);


-- -------------------------------------------------------------
-- TABLA: stock_movimientos
-- delta > 0 = entrada (compra/devolución)
-- delta < 0 = salida  (venta/pérdida)
-- No existe campo "tipo"; el signo de delta lo determina.
-- -------------------------------------------------------------
create table stock_movimientos (
  id          uuid        primary key default gen_random_uuid(),
  producto_id uuid        not null references productos(id) on delete restrict,
  delta       integer     not null,   -- positivo: entrada / negativo: salida
  motivo      text,                   -- ej. "venta pedido X", "compra proveedor"
  created_at  timestamptz not null default now()
);

create index idx_stock_mov_producto  on stock_movimientos (producto_id);
create index idx_stock_mov_created   on stock_movimientos (created_at desc);

-- Trigger: mantiene productos.stock_actual consistente con movimientos.
-- SOLO se dispara en INSERT (los movimientos son inmutables; para
-- corregir errores se inserta un movimiento de ajuste con motivo claro).
create or replace function fn_sync_stock_actual()
returns trigger
language plpgsql
security definer
as $$
begin
  update productos
  set
    stock_actual = stock_actual + new.delta,
    updated_at   = now()
  where id = new.producto_id;
  return new;
end;
$$;

create trigger trg_sync_stock
  after insert on stock_movimientos
  for each row
  execute function fn_sync_stock_actual();


-- -------------------------------------------------------------
-- TABLA: pedidos
-- Columnas según docs/esquema-datos.md.
-- Se agregan: updated_at, wa_thread_id (para correlacionar hilo WA).
-- -------------------------------------------------------------
create table pedidos (
  id            uuid          primary key default gen_random_uuid(),
  estado        estado_pedido not null default 'borrador',
  taller_nombre text          not null,
  telefono      text          not null,   -- E.164, ej. "+573001234567"
  direccion     text,
  notas         text,
  -- wa_thread_id: no estaba en esquema-datos.md; se agrega para
  -- correlacionar el hilo de WhatsApp con el pedido sin buscar por teléfono.
  wa_thread_id  text,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

create index idx_pedidos_estado    on pedidos (estado);
create index idx_pedidos_telefono  on pedidos (telefono);
create index idx_pedidos_created   on pedidos (created_at desc);

-- Trigger: updated_at automático en cada UPDATE.
create or replace function fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_pedidos_updated_at
  before update on pedidos
  for each row
  execute function fn_set_updated_at();


-- -------------------------------------------------------------
-- TABLA: pedido_lineas
-- Columnas exactas según docs/esquema-datos.md.
-- -------------------------------------------------------------
create table pedido_lineas (
  id              uuid     primary key default gen_random_uuid(),
  pedido_id       uuid     not null references pedidos(id)   on delete cascade,
  producto_id     uuid     not null references productos(id) on delete restrict,
  cantidad        integer  not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  -- subtotal: columna generada para consultas rápidas
  subtotal        numeric(12,2) generated always as (cantidad * precio_unitario) stored
);

create index idx_lineas_pedido   on pedido_lineas (pedido_id);
create index idx_lineas_producto on pedido_lineas (producto_id);


-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
-- Acceso de aplicación: SOLO mediante service_role key del lado
-- del servidor (Worker de Cloudflare u otro backend).
-- ⚠️  NUNCA exponer la service_role key en el cliente,
--     en el repo público ni en variables de entorno del frontend.
-- =============================================================

alter table productos         enable row level security;
alter table stock_movimientos enable row level security;
alter table pedidos           enable row level security;
alter table pedido_lineas     enable row level security;

-- Sin policies → RLS vacío = acceso denegado a anon y authenticated.
-- La service_role key bypasea RLS por diseño de Supabase.
-- Las dos policies siguientes son explícitas y documentativas;
-- son redundantes con RLS vacío pero dejan intención clara.

create policy "sin_acceso_publico_productos"
  on productos for all
  to anon, authenticated
  using (false);

create policy "sin_acceso_publico_stock"
  on stock_movimientos for all
  to anon, authenticated
  using (false);

create policy "sin_acceso_publico_pedidos"
  on pedidos for all
  to anon, authenticated
  using (false);

create policy "sin_acceso_publico_lineas"
  on pedido_lineas for all
  to anon, authenticated
  using (false);
