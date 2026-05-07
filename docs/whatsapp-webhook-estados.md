# WhatsApp webhook → estados del pedido

**Negocio:** Apex Suspensión · **Presencia técnica:** Ockham Systems  
**Fuente de verdad del flujo:** `docs/mvp-flujo.md`  
**API de referencia:** WhatsApp Business Cloud API (Meta)

---

## Flujo de estados

```
borrador → cotizado → confirmado → empacando → en_ruta → entregado
    ↑                      ↓
    └──────────────── cancelado (cualquier estado pre-empacando)
```

---

## Tabla de eventos

| #   | Evento webhook                                                                                              | Campo JSON clave                                                           | Acción sobre `pedidos`                                                       | Modo agente                              |
| --- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- |
| 1   | `messages` · `type: text` — primer mensaje del taller                                                       | `entry[].changes[].value.messages[0].from` (número nuevo)                  | Crea pedido con `estado = 'borrador'`                                        | **Mostrador**                            |
| 2   | `messages` · `type: text` — responde con datos del vehículo/pieza                                           | mismo hilo, pedido en `borrador`                                           | Sigue en `borrador`; acumula info para cotización                            | **Mostrador**                            |
| 3   | _(evento saliente)_ — el Worker envía cotización al taller                                                  | N/A — acción interna del backend                                           | `borrador → cotizado`                                                        | **Mostrador**                            |
| 4   | `messages` · `type: text` — cliente responde "confirmo", "ok", "listo", "lo llevo"                          | `messages[0].body` contiene keyword de confirmación                        | `cotizado → confirmado`                                                      | **Mostrador** → traspasa a **Despachos** |
| 5   | `messages` · `type: interactive` · `interactive.type: button_reply` · `button_reply.id: "confirmar_pedido"` | `messages[0].interactive.button_reply.id`                                  | `cotizado → confirmado`                                                      | **Mostrador** → traspasa a **Despachos** |
| 6   | `messages` · `type: text` — cliente escribe "cancelar", "no gracias", "dejalo"                              | `messages[0].body` contiene keyword de cancelación; estado pre-`empacando` | `* → cancelado`                                                              | **Mostrador**                            |
| 7   | _(evento saliente)_ — Worker envía aviso de embalaje al taller                                              | N/A — acción interna; backend actualiza estado                             | `confirmado → empacando`                                                     | **Despachos**                            |
| 8   | _(evento saliente)_ — Worker envía aviso "en camino" con ETA                                                | N/A — acción interna                                                       | `empacando → en_ruta`                                                        | **Despachos**                            |
| 9   | `messages` · `type: text` — taller confirma recepción ("llegó", "recibido", "ok gracias")                   | `messages[0].body`; pedido en `en_ruta`                                    | `en_ruta → entregado`                                                        | **Despachos**                            |
| 10  | `statuses` · `status: "sent"`                                                                               | `entry[].changes[].value.statuses[0].status`                               | Sin cambio de estado — registrar en log                                      | N/A interno                              |
| 11  | `statuses` · `status: "delivered"`                                                                          | ídem                                                                       | Sin cambio de estado — registrar en log                                      | N/A interno                              |
| 12  | `statuses` · `status: "read"`                                                                               | ídem                                                                       | Sin cambio de estado — registrar en log                                      | N/A interno                              |
| 13  | `statuses` · `status: "failed"`                                                                             | `statuses[0].errors[0].code`                                               | Sin cambio automático — alerta interna; revisar si el pedido queda bloqueado | **Compras** / operador humano            |

> **TODO verificar con documentación Meta:** los `button_reply.id` exactos dependen de cómo configures las plantillas interactivas aprobadas. Los keywords de texto ("confirmo", "cancelar") requieren lógica NLP o lista de sinónimos en el Worker; no es nativo del webhook.

---

## Regla de talleres fidelizados (precios / contra entrega)

Al inicio de cada conversación, el orquestador debe consultar `talleres_fidelizados` por número de WhatsApp.

- Si existe y `activo = true`: inyecta un objeto `{{taller}}` al prompt del agente con
  `descuentoPorcentaje` y `contraEntregaHabilitada`.
- El agente cotiza con el precio correcto (descuento aplicado) y confirma el flujo de pago como
  **contra entrega** cuando esté habilitado, **sin mencionar** "descuento", "programa" o "membresía".

## Estructura mínima del payload de entrada (referencia)

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "573001234567",
                "type": "text",
                "text": { "body": "Buenas, necesito bieletas para un Spark" }
              }
            ],
            "statuses": [],
            "contacts": [{ "profile": { "name": "Taller El Rápido" } }]
          }
        }
      ]
    }
  ]
}
```

---

## Quién decide el modo de agente

El orquestador (Worker) lee el `estado` actual del pedido desde Supabase
y selecciona el system prompt correspondiente:

| Estado del pedido                    | Prompt que usa el Worker    |
| ------------------------------------ | --------------------------- |
| `borrador`, `cotizado`               | `docs/prompts/mostrador.md` |
| `confirmado`, `empacando`, `en_ruta` | `docs/prompts/despachos.md` |
| Stock bajo detectado (cron interno)  | `docs/prompts/compras.md`   |
| `entregado`, `cancelado`             | Sin prompt — solo log       |
