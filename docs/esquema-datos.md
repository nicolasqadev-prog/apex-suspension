# Esquema de datos — inventario y pedidos

## Hoy (MVP en disco)

Archivo: `data/inventario.ejemplo.json`

Cada pieza incluye:

- `slug` — identificador en URL (`/repuesto/:slug`).
- `referencia` — código KTC visible al cliente.
- `nombre`, `aplicacion`, `categoria`, `marca`.
- `precioLista` — COP, referencia comercial.
- `stock` — unidades disponibles (entero).

La app lee esto vía `src/lib/inventario.ts`.

## Mañana (producción recomendada)

### Tablas sugeridas (Supabase / Postgres)

**`productos`**

| Columna      | Tipo    | Notas         |
| ------------ | ------- | ------------- |
| id           | uuid    | PK            |
| slug         | text    | unique        |
| referencia   | text    | unique, index |
| nombre       | text    |               |
| aplicacion   | text    |               |
| categoria    | text    | index         |
| marca        | text    | default KTC   |
| precio_lista | numeric |               |
| activo       | boolean |               |

**`stock_movimientos`** (trazabilidad)

| Columna     | Tipo        |
| ----------- | ----------- |
| id          | uuid        |
| producto_id | uuid FK     |
| delta       | integer     |
| motivo      | text        |
| created_at  | timestamptz |

**`pedidos`**

| Columna       | Tipo        |
| ------------- | ----------- |
| id            | uuid        |
| estado        | text        |
| taller_nombre | text        |
| telefono      | text        |
| direccion     | text        |
| notas         | text        |
| created_at    | timestamptz |

**`pedido_lineas`**

| Columna         | Tipo    |
| --------------- | ------- |
| id              | uuid    |
| pedido_id       | uuid FK |
| producto_id     | uuid FK |
| cantidad        | integer |
| precio_unitario | numeric |

### Reglas

- El **mostrador** (humano o IA) solo confirma existencia después de **leer** `stock` actual o vista materializada.
- Los movimientos de stock registran **entrada** (compra) y **salida** (venta).

Puedes pedirle a **Claude Pro** que convierta este esquema en SQL de Supabase con RLS básica (solo rol `service` para backend).
