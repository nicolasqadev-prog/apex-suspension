# Blindaje de producción (PWA Apex)

Objetivo: **detectar caídas antes que un taller en campo**, bloquear regresiones tipo Worker 1102 y degradar con gracia si algo falla.

## Capas de protección

| Capa | Qué hace | Cuándo corre |
|------|----------|--------------|
| **Guardrails CI** | Impide volver a escanear ~10k piezas para filtros; mide presupuesto CPU del catálogo | Cada push/PR a `main` |
| **Smoke post-deploy** | Verifica `/`, `/catalogo`, `/api/health` en producción | Tras cada deploy |
| **Uptime cron** | Mismo smoke cada 15 min | Siempre, aunque no haya deploy |
| **Health API** | Ping liviano Worker + Supabase (1 fila) | Monitores externos |
| **Error boundary catálogo** | Pantalla de reintento + WhatsApp si el catálogo revienta | En el navegador del usuario |

## Comandos locales

```bash
npm run qa:catalogo-guards      # anti-regresión CPU / filtros
npm run qa:catalogo-busqueda    # búsqueda coloquial
npm run qa:produccion           # smoke contra producción
SITE_URL=https://apex-suspension.com.co npm run qa:produccion
```

## Alertas al celular (recomendado)

### Opción A — ntfy.sh (gratis, 2 minutos)

1. Instala la app **ntfy** en el teléfono ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) / [iOS](https://apps.apple.com/app/ntfy/id1625396347)).
2. Suscríbete a un topic privado, por ejemplo: `apex-suspension-alertas-TU_CLAVE_SECRETA`.
3. En GitHub → repo → **Settings → Secrets → Actions**, crea:
   - `NTFY_TOPIC` = el topic exacto (incluye la clave secreta en el nombre).
4. Si falla el uptime o el smoke post-deploy, GitHub envía push al teléfono.

### Opción B — UptimeRobot / Better Stack

Monitorea cada 5 min:

- `https://apex-suspension.com.co/api/health` → debe devolver `{"ok":true}`
- `https://apex-suspension.com.co/catalogo` → HTTP 200, sin texto "Algo salió mal"

Alertas: email + SMS (según plan).

### Opción C — Cloudflare Notifications

En el dashboard de Cloudflare → Notifications → Workers:

- Worker errors / exceeded CPU
- Email o webhook a tu canal preferido

## Qué NO hacer en el catálogo (evita Worker 1102)

- No iterar las ~9.700 piezas en SSR para armar dropdowns (usar lista estática por marca).
- No añadir `useMemo` que escanee todo el inventario en cada carga sin medir presupuesto CPU.
- Antes de deploy: `npm run qa:catalogo-guards`.

## Si el catálogo cae en campo

El usuario verá **"Catálogo temporalmente no disponible"** con:

- Reintentar
- Ir al inicio
- WhatsApp directo a Apex

La home y el bot de cotización siguen disponibles si solo falla el catálogo.

## Checklist antes de salir a ruta / feria

```bash
npm run qa:catalogo-guards
npm run qa:produccion
```

Ambos deben terminar en OK. Revisa en GitHub Actions que **Uptime producción** esté en verde.
