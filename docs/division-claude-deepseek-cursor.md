# Quién hace qué (Claude Pro · DeepSeek · Cursor)

Todo lo **versionado** debe terminar en este repo (tu PC + GitHub). Los otros modelos ayudan a pensar y redactar; **Cursor** pasa eso a archivos y código.

## Claude Pro (pensamiento largo)

Pídele entregables **copiables a archivos**:

- SQL o diseño de tablas Supabase a partir de `docs/esquema-datos.md`.
- Política de RLS mínima y flujo de webhooks WhatsApp.
- Mejora de los tres prompts en `docs/prompts/*.md`.
- Matriz de estados del pedido y reglas del orquestador (texto + diagrama en Mermaid).

**Formato sugerido:** secciones claras, listas numeradas, bloques separados por archivo destino.

## DeepSeek (rápido y barato)

- Variantes de mensajes de WhatsApp (tono formal / corto).
- Revisión de claridad: “¿qué falta en este flujo?”
- Traducciones o microcopy en la PWA.

**Salida:** viñetas cortas. Luego Cursor integra al código o a `docs/`.

## Cursor (este entorno)

- Implementa rutas, UI, `data/`, `src/lib/`, integración futura Worker + Supabase.
- Ejecuta `npm run check` y deja commits listos.
- Mantiene README y CI alineados con el producto.

## Orden práctico de una semana tipo

1. Claude: refina esquema Supabase + prompts.
2. DeepSeek: pulir textos de cliente.
3. Cursor: conectar datos reales y despliegue.
