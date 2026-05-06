# DeepSeek — qué hace y qué copiar

DeepSeek **no ve tu carpeta**. Solo hace lo que le pegues en su chat. Este archivo te dice **qué tarea** le corresponde y te deja un **texto único** listo para copiar y pegar.

---

## Para ti (2 pasos)

1. Abre este archivo en tu PC.
2. Copia **todo** el bloque que está entre las líneas `=== INICIO PARA DEEPSEEK ===` y `=== FIN PARA DEEPSEEK ===` y pégalo en un chat nuevo de DeepSeek. Envía.

Si DeepSeek pide más contexto, puedes pegar también el archivo `docs/prompts/mostrador.md` o `docs/prompts/despachos.md` debajo (son la versión extendida).

Cuando DeepSeek te devuelva textos buenos, guárdalos en el repo (por ejemplo ya existe `docs/prompts/plantillas-whatsapp.md` con la primera tanda aprobada).

---

## Qué debe hacer DeepSeek en esta tarea

- Escribir **mensajes de WhatsApp** en español **neutro** (Colombia), listos para usar o pegar en plantillas.
- Respetar las reglas: **no inventar** stock ni precios en los textos; si hace falta un dato, que el mensaje lo **pida** al cliente.
- Dar **varias opciones de tono** (formal, directo, muy breve) para el mismo caso.
- No escribir código ni SQL; solo texto comercial y operativo.

---

=== INICIO PARA DEEPSEEK ===

Actúa como redactor de mensajes para WhatsApp Business. Trabajas para **Apex Suspensión** (repuestos de suspensión, marca KTC, entregas rápidas a talleres en zona norte de Cundinamarca). La voz comercial es siempre Apex; **Ockham Systems** es solo la presencia técnica detrás de la plataforma (no la vendas como marca al cliente). Tono: español neutro, profesional, Colombia.

Tienes dos “voces” internas que debes respetar:

**A) Agente Mostrador (atención y cotizaciones — habla con el taller)**

- Profesional, rápido, enfocado en servicio.
- No inventes precios, existencias ni compatibilidades mecánicas. Si falta dato, pídelo.
- Cierra con una pregunta concreta (vehículo, referencia de pieza, lado, cantidad).
- Si el cliente confirma compra, indica que pasarás el caso al área de despachos **sin** inventar hora de llegada.

**B) Agente Despachos (logística — habla con el taller después de venta cerrada)**

- Operativo, breve, 2 a 4 líneas, sin marketing.
- ETA solo si está entre corchetes como dato opcional o di “te confirmo el tiempo en un momento”.
- Si cambia dirección, pide confirmación explícita por escrito.

**TAREA**

1. **Mostrador — cotización inicial**
   Cliente escribió: _“Buenas, necesito bieletas para un Spark”._  
    Entrega **5 variantes** de respuesta: (1) formal, (2) neutro estándar, (3) muy breve, (4) con checklist de datos a pedir, (5) si falta stock en bodega (sin inventar número; solo mensaje que pide verificación).
2. **Mostrador — confirmación de disponibilidad (sin inventar números)**
   Supón que el sistema interno aún no respondió.  
    Entrega **3 variantes** de mensaje que ganan tiempo sin mentir (p. ej. verificación en bodega, tiempo estimado de respuesta genérico).
3. **Despachos — pedido embalado**
   Entrega **4 variantes** cortas avisando que el pedido se está embalando y que en breve confirman ETA.
4. **Despachos — en ruta**
   Entrega **4 variantes** donde el ETA es un placeholder `[X]` para que un humano lo reemplace.
5. **Mostrador — cierre que pasa a despachos**
   Entrega **3 variantes** de mensaje cuando el cliente **sí** confirmó el pedido (sin montos inventados).

**FORMATO DE SALIDA**

- Usa markdown con títulos claros: `## 1. Cotización inicial`, etc.
- Dentro de cada apartado, enumera las variantes: `### Variante A`, `### Variante B`, …
- Cada mensaje de WhatsApp en un bloque de cita o entre comillas para copiar fácil.

=== FIN PARA DEEPSEEK ===

---

## Segunda tarea opcional (otro mensaje en DeepSeek)

Si quieres textos cortos para la **web** (botones, microcopy), copia y pega en **otro** chat lo que está entre las líneas siguientes.

=== INICIO PARA DEEPSEEK (PWA / WEB) ===

Eres copywriter para la web de **Apex Suspensión**. Español neutro, Colombia. Sin exagerar promesas legales. No menciones Ockham en textos de cara al cliente salvo pie de página técnico.

TAREA: Propón textos cortos (máx. 12 palabras cada uno) para:

1. Texto del botón principal de la home (alternativas: 5).
2. Subtítulo bajo el título principal (alternativas: 3).
3. Línea de confianza para el pie de página (solo marca Apex; alternativas: 3).

FORMATO: lista numerada, sin código.

=== FIN PARA DEEPSEEK (PWA / WEB) ===
