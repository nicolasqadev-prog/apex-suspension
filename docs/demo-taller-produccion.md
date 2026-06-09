# Demo taller en producción (entorno real)

## Qué valida la demo

1. **/taller/acceso** — el taller ingresa su WhatsApp (10 dígitos o con 57).
2. **/catalogo** — catálogo completo con **precio taller** (descuento en servidor) y **stock** desde Supabase.
3. **Agregar al pedido** → **/taller/pedido** → registro en `pedidos` + mensaje WhatsApp para confirmar.

## Checklist antes de mostrar a un taller

### Supabase (SQL Editor)

1. Migraciones aplicadas: `20260504120000_init_apex.sql`, `20260507125700_talleres_fidelizados.sql`, `20260520120000_borrador_operacion.sql` (si usas borrador/publicado).
2. Taller de demo o real:

```sql
-- Ver supabase/seed-taller-ejemplo.sql (cambia el WhatsApp)
```

3. Productos con stock en `productos` / `stock_movimientos` (ver abajo).

### Cloudflare / deploy

- Secretos: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PIN`.
- Sin Supabase configurado, el catálogo cae al JSON local (`data/inventario.ejemplo.json`).

### Panel admin

- **Modo preparación APAGADO** si quieres que el taller entre por `/taller/acceso` sin trucos de admin.
- Taller con **publicado = true** y **activo = true**.

## Cargar inventario y stock en la base

```bash
npm run sync:inventory
```

Usa `data/inventario.ejemplo.json` (o pasa otra ruta). Crea productos nuevos y carga stock inicial vía `stock_movimientos`. Para ajustar stock después, inserta movimientos (no edites `stock_actual` a mano).

## Flujo recomendado en la reunión

1. Abrir **https://apex-suspension.com.co/taller/acceso**
2. Número registrado (ej. `3001234567` → se guarda como `573001234567`)
3. Catálogo: buscar referencia, ver **Precio taller** y stock
4. Agregar líneas → Pedido → enviar por WhatsApp
