# MVP Apex Suspensión — flujo realista

**Negocio (cara al cliente):** Apex Suspensión (KTC y logística)  
**Plataforma y presencia técnica:** Ockham Systems

## Qué incluye el MVP actual (en repo)

1. **Landing** (`/`) — mensaje comercial y enlace a despacho.
2. **Catálogo** (`/catalogo`) — lista desde `data/inventario.ejemplo.json` con búsqueda en cliente.
3. **Detalle** (`/repuesto/$slug`) — ficha, stock y precio de lista; botón **Pedir por WhatsApp** con mensaje prellenado.

La venta **no** se cierra sola en la web: el cierre sigue siendo humano por WhatsApp (coherente con un taller real).

## Tres “agentes” (diseño ajustado a la realidad)

No son tres IAs independientes en tres números. Es **un solo canal WhatsApp** y, cuando conectes automatización, **tres modos** según el **estado del pedido** y el **tipo de mensaje**:

| Modo          | Audiencia        | Objetivo                                                                       |
| ------------- | ---------------- | ------------------------------------------------------------------------------ |
| **Mostrador** | Cliente (taller) | Cotizar, confirmar datos del vehículo/pieza, **solo** con datos de inventario. |
| **Despachos** | Cliente          | Avisos cortos: embalado, ETA, repartidor en camino.                            |
| **Compras**   | Solo interno     | Alertas de stock bajo, sugerencia de compra, **sin** hablar con el cliente.    |

## Estados mínimos del pedido (para cuando exista backend)

1. `borrador` — conversación sin compromiso.
2. `cotizado` — precio/cantidad propuestos al cliente.
3. `confirmado` — cliente aceptó; se pasa a despacho.
4. `empacando` / `en_ruta` / `entregado` — operación.

El orquestador (código + reglas) decide qué prompt usar según estado + intención.

## Próximo salto técnico (cuando decidas)

- Persistir pedidos y stock en **Supabase** (o similar).
- Webhook **WhatsApp Business API** → tu Worker → lectura de inventario → respuesta con prompt de mostrador/despacho.

Hasta entonces, la PWA + WhatsApp manual ya valida el negocio.
