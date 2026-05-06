# Apex Suspensión

PWA del negocio **Apex Suspensión** (repuestos y logística). En la interfaz, **Ockham Systems** solo figura en el pie como presencia técnica; el resto del producto habla a nombre de Apex.

## Estado de independencia

Este repositorio ya no depende de configuración propietaria de Lovable para compilar.

- Build con Vite + TanStack Start en `vite.config.ts`.
- Código y activos viven en esta carpeta y en GitHub.
- CI en GitHub Actions para validar `lint` y `build`.

## Cómo ejecutarlo en tu PC

```bash
npm install
npm run dev
```

Abre la URL local que imprima la terminal.

Comandos principales:

- `npm run dev`: desarrollo local.
- `npm run lint`: calidad de código.
- `npm run build`: build de producción.
- `npm run preview`: vista previa del build.
- `npm run check`: lint + build.

## Rutas útiles del MVP

- `/` — landing comercial.
- `/catalogo` — listado + búsqueda (lee `data/inventario.ejemplo.json`).
- `/repuesto/$slug` — detalle y botón a WhatsApp.

Configura tu número real copiando `.env.example` a `.env.local` y ajustando `VITE_WHATSAPP_APEX`.

## Documentación de producto y agentes

- `docs/mvp-flujo.md` — flujo realista y estados de pedido.
- `docs/esquema-datos.md` — JSON actual + tablas sugeridas para Supabase.
- `docs/whatsapp-webhook-estados.md` — evento Meta → estado del pedido → modo de agente.
- `supabase/migrations/20260504120000_init_apex.sql` — esquema inicial (ejecutar en Supabase o vía CLI).
- `docs/prompts/` — prompts base (mostrador, despachos, compras) y `plantillas-whatsapp.md` (textos listos para pegar).
- `docs/division-claude-deepseek-cursor.md` — cómo repartir trabajo entre herramientas.

## PWA (base lista)

Se añadieron estos archivos para instalación y funcionamiento offline básico:

- `public/manifest.webmanifest`
- `public/sw.js`
- `public/icon.svg`
- `public/icon-maskable.svg`

La app registra el service worker desde `src/routes/__root.tsx`.

## Dónde empezar a leer el código

1. `src/routes/index.tsx` → entrada de la ruta `/`.
2. `src/components/ApexLandingPage.tsx` → contenido principal de la landing.
3. `src/routes/__root.tsx` → layout global, metadatos, manifest y service worker.
4. `src/router.tsx` → configuración de router y errores.
5. `src/styles.css` → estilos globales.

## Mapa rápido de carpetas

```text
src/
  routes/         rutas de la aplicación
  components/     componentes de negocio + UI
  assets/         imágenes
  hooks/          lógica reutilizable
  lib/            utilidades
  router.tsx      creación del router
  routeTree.gen.ts (generado)
  styles.css
```

## Flujo recomendado de trabajo

1. Crear rama por tarea: `git checkout -b feat/nombre-corto`.
2. Implementar cambio pequeño.
3. Validar: `npm run check`.
4. Commit claro.
5. Push y pull request.

## Repositorio oficial

- URL: `https://github.com/nicolasqadev-prog/apex-suspension.git`
- Organización/marca de negocio: **Ockham Systems**
