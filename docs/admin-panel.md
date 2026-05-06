# Panel administrativo (`/admin`)

Este panel es **solo interno** (operación y despachos). No se muestra al cliente.

## Acceso

La ruta es: `/admin`

El acceso requiere un PIN validado **en servidor** con una variable de entorno:

- `ADMIN_PIN` (NO usar `VITE_*`)

## Desarrollo local

PIN de prueba por defecto (solo mientras `import.meta.env.DEV` es true y **no** definís `ADMIN_PIN`): **`Panel1234`**. En producción hay que definir siempre `ADMIN_PIN` en el Worker.

Si usas Wrangler para simular el entorno del Worker, crea `.dev.vars` desde el ejemplo:

- Copia `.dev.vars.example` → `.dev.vars`
- Ajustá `ADMIN_PIN` cuando dejes de usar el PIN de prueba

> Nota: `npm run dev` (Vite) no siempre expone envs de servidor igual que Wrangler.
> Para despliegue real, configura `ADMIN_PIN` como secreto/variable en Cloudflare.

## Producción (Cloudflare)

Configura `ADMIN_PIN` como variable/secreto del Worker (nunca en el frontend).

Luego entra desde el teléfono a:

- `https://TU-DOMINIO/admin`
