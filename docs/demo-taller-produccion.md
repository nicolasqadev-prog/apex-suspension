# Demo taller en producción (entorno real)

## Qué valida la demo

1. **/taller/acceso** — el taller ingresa su WhatsApp (10 dígitos o con 57).
2. **/catalogo** — catálogo completo con **precio taller** (16,67% sobre lista) y **stock** desde Supabase.
3. **Agregar al pedido** → **/taller/pedido** → registro en `pedidos` + mensaje WhatsApp para confirmar.

## Fuente de datos en producción

| Qué | Archivo / destino |
|-----|-------------------|
| Catálogo KTC (~5910 refs) | `data/inventario-catalogo-completo.json` → Supabase |
| Stock bodega (124 refs) | `data/inventario-vivo.json` → sync aparte |
| Fallback sin Supabase | `data/inventario.ejemplo.json` (solo 10 demos locales) |

La PWA **lee Supabase** en servidor. Los JSON grandes no se importan en runtime.

## Checklist antes de mostrar a un taller

### Supabase

1. Migraciones aplicadas.
2. Taller con **descuento 16,67%** (equivale a precio taller del Excel).
3. Productos demo desactivados: `node scripts/sanear-demo-productos.mjs`

### Cloudflare / deploy

- Secretos: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PIN`.

### Panel admin

- **Modo preparación APAGADO** para acceso real por `/taller/acceso`.
- Taller con **publicado = true** y **activo = true**.

## Sincronizar inventario

```bash
# Catálogo completo (precios/nombres; NO pisa stock en existentes)
npm run sync:inventory -- data/inventario-catalogo-completo.json

# Solo stock bodega (124 piezas)
npm run sync:inventory -- data/inventario-vivo.json
```

Por lotes (Python):

```bash
cd "apex finanzas"
py -3 generar_catalogo_completo.py
py -3 sync_catalogo_paso.py
```

## Flujo recomendado en la reunión

1. Abrir **/taller/acceso**
2. Número registrado (ej. `3001234567` → `573001234567`)
3. Catálogo: buscar referencia, ver **Precio taller** y stock
4. Filtro **con stock** = piezas en bodega
5. Agregar líneas → Pedido → WhatsApp
