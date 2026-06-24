# Conectar WhatsApp Business API (Meta) al agente Mostrador

> **Resumen fijo del proyecto.** Checklist rápido para retomar sin perder el hilo.  
> Regla Cursor: `.cursor/rules/whatsapp-api-setup.mdc`

El agente de IA en **WhatsApp** usa la misma lógica que la PWA (catálogo Supabase + Groq), pero Meta llama a tu servidor cuando un cliente escribe.

**URL del webhook (producción):**

```
https://apex-suspension.com.co/api/whatsapp/webhook
```

---

## 1. Requisitos previos

1. **Meta Business Suite** — [business.facebook.com](https://business.facebook.com) con tu negocio verificado.
2. **Número de WhatsApp** — el de Apex (el mismo que usas hoy con clientes).
3. Cuenta en **Meta for Developers** — [developers.facebook.com](https://developers.facebook.com).

---

## 2. Crear la app en Meta

1. Entrá a [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Crear app**.
2. Tipo: **Otro** → **Empresa** (o “Business”).
3. Nombre ej.: `Apex Suspensión WhatsApp`.
4. En el panel de la app → **Agregar producto** → **WhatsApp** → **Configurar**.

---

## 3. Obtener credenciales

En **WhatsApp → API Setup** (o “Inicio rápido”):

| Dato | Dónde está | Variable en Apex |
|------|------------|------------------|
| **Token de acceso temporal** (luego permanente) | API Setup | `WHATSAPP_ACCESS_TOKEN` |
| **Phone number ID** | API Setup, debajo del número | `WHATSAPP_PHONE_NUMBER_ID` |
| **WhatsApp Business Account ID** | API Setup | (solo referencia en Meta) |

### Token permanente (producción)

El token de 24 h no sirve en producción. Creá uno permanente:

1. **Business Settings** → **Users** → **System users** → Crear.
2. Asignale activos: tu app de WhatsApp + permiso `whatsapp_business_messaging`.
3. **Generate token** → permisos: `whatsapp_business_management`, `whatsapp_business_messaging`.
4. Copiá ese token → `WHATSAPP_ACCESS_TOKEN`.

### Verify token (lo inventás vos)

Es una contraseña que **vos elegís** para que Meta verifique el webhook. Ejemplo:

```
apex-wa-verify-2026-secreto-largo
```

→ `WHATSAPP_VERIFY_TOKEN`

---

## 4. Configurar el webhook en Meta

1. En la app → **WhatsApp** → **Configuration** (Configuración).
2. **Webhook** → **Edit**.
3. **Callback URL:**

   ```
   https://apex-suspension.com.co/api/whatsapp/webhook
   ```

4. **Verify token:** el mismo que pusiste en `WHATSAPP_VERIFY_TOKEN`.
5. Guardá. Meta hace un GET de prueba; el Worker debe responder con `hub.challenge`.
6. **Subscribe to fields:** marcá al menos **`messages`**.

> Antes de esto tenés que haber hecho **deploy** con los secretos cargados en Cloudflare.

---

## 5. Secretos en GitHub / Cloudflare

Agregá en **GitHub → Settings → Secrets → Actions**:

| Secret | Descripción |
|--------|-------------|
| `WHATSAPP_ACCESS_TOKEN` | Token permanente de Meta |
| `WHATSAPP_PHONE_NUMBER_ID` | ID numérico del número (no el teléfono) |
| `WHATSAPP_VERIFY_TOKEN` | La frase secreta que elegiste |
| `GROQ_API_KEY` | IA del mostrador (ya deberías tenerla) |

Opcional: `GROQ_MODEL=llama-3.3-70b-versatile`

Después de agregar los secretos, hacé **push a `main`** o corré el workflow **Deploy Cloudflare** manualmente.

### Local (`.env.local`)

```env
WHATSAPP_ACCESS_TOKEN=EAAxxxxx...
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_VERIFY_TOKEN=apex-wa-verify-2026-secreto-largo
GROQ_API_KEY=gsk_...
```

Luego: `npm run build` y `node scripts/sync-cloudflare-secrets.mjs` (o deploy por GitHub).

---

## 6. Conectar tu número real

En **API Setup**:

1. Si usás el número de prueba de Meta, solo podés escribir a números que agregues en “To”.
2. Para producción: **Add phone number** → verificá el número de Apex por SMS/voz.
3. Completá el **perfil del negocio** (nombre, categoría, descripción) — Meta lo exige para escalar.

---

## 7. Probar

1. Desde tu celular, escribile al **número de WhatsApp de Apex**:
   > `Hola, necesito rótula para Chevrolet Sail 2018`
2. Deberías recibir cotización con precio del catálogo en segundos.
3. Si te cotizó una línea, respondé: **`CONFIRMO`** → se registra pedido en Supabase.

---

## 8. Qué hace el agente por WhatsApp

| Paso | Comportamiento |
|------|----------------|
| Cliente escribe | Meta → webhook → busca en Supabase → IA responde |
| Hay stock | Precio + “en bodega” |
| Sin stock | Precio + “bajo pedido” |
| Marca que no venden | Declina con respeto |
| Cliente escribe `CONFIRMO` | Crea pedido en Apex (como portal taller) |

---

## 9. Costos y límites

- **Meta:** conversaciones gratuitas limitadas al inicio; luego cobro por conversación (ver precios WhatsApp Business en Colombia).
- **Groq:** por tokens de IA.
- **Cloudflare Worker:** incluido en tu plan actual.

---

## 10. Si el webhook no verifica

- Confirmá que `WHATSAPP_VERIFY_TOKEN` en Cloudflare = el mismo en Meta.
- Probá en el navegador (debe dar 403, no 404):

  ```
  https://apex-suspension.com.co/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TU_TOKEN&hub.challenge=12345
  ```

  Debe responder `12345` en texto plano.

- Si da **404**: falta deploy de la ruta `/api/whatsapp/webhook`.

---

## Documentación relacionada

- Flujo de estados de pedido: `docs/whatsapp-webhook-estados.md`
- Prompt del agente: `docs/prompts/mostrador.md`
