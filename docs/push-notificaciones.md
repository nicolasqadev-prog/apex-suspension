# Notificaciones push (PWA Apex)

## 1. Migración Supabase

En el SQL Editor de Supabase, ejecuta:

`supabase/migrations/20260519120000_push_subscriptions.sql`

## 2. Claves VAPID

En la raíz del proyecto:

```bash
npm install
npm run vapid:keys
```

Copia la salida a **GitHub Actions → Secrets** (y a `.dev.vars` en local):

| Secret | Uso |
|--------|-----|
| `VITE_VAPID_PUBLIC_KEY` | Build del frontend (suscribir navegador) |
| `VAPID_PUBLIC_KEY` | Worker (enviar push) |
| `VAPID_PRIVATE_KEY` | Worker (enviar push, **nunca** en el cliente) |
| `VAPID_SUBJECT` | Ej. `mailto:contacto@apex-suspension.com.co` |

Tras el deploy, en `/admin` verás **“Servidor listo para enviar push”**.

## 3. Flujo cliente

1. Instala la PWA y pulsa **Activar notificaciones**.
2. La suscripción se guarda en `push_subscriptions` (con el WhatsApp de `apex.whatsapp` o `apex.taller.whatsapp` si existe).

## 4. Flujo operación (panel admin)

- **Enviar a todos**: difusión (stock, promos).
- **Guardar y notificar** en un pedido: cambia el estado en Supabase y envía push al teléfono del pedido si hay suscripción.

Estados con mensaje automático: `cotizado`, `confirmado`, `empacando`, `en_ruta`, `entregado`, `cancelado`.

## 5. iPhone

Requiere PWA instalada (Agregar a inicio) y iOS 16.4+ para Web Push.
