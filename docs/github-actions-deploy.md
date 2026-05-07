# Deploy solo con secretos (GitHub Actions)

Con esto no hace falta tocar el panel de Cloudflare para cada clave: **las cargás una vez en GitHub** y cada `push` a `main` hace `npm ci`, `npm run build`, `wrangler deploy` y actualiza los secretos del Worker.

## 1. Secretos en GitHub

En el repo: **Settings → Secrets and variables → Actions → New repository secret**.

| Nombre                      | Qué es                                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`      | Token con permiso de editar Workers (y lectura de cuenta si hace falta). [Crear token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) (plantilla “Edit Cloudflare Workers” o equivalente). |
| `CLOUDFLARE_ACCOUNT_ID`     | En Cloudflare: **Overview** de tu cuenta, columna derecha, **Account ID**.                                                                                                                                                |
| `VITE_WHATSAPP_APEX`        | Mismo valor que en `.env.example` (número WhatsApp; se inyecta en el **build**).                                                                                                                                          |
| `SUPABASE_URL`              | URL del proyecto Supabase (podés normalizarla como en local).                                                                                                                                                             |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role de Supabase (solo servidor).                                                                                                                                                                                 |
| `ADMIN_PIN`                 | PIN fuerte para `/admin` en producción.                                                                                                                                                                                   |

Los nombres tienen que coincidir **exactamente** con la tabla (mayúsculas incluidas).

## 2. Evitar dos deploys a la vez

Si en **Cloudflare → Workers & Pages → apex-suspension** tenés el repo de GitHub conectado y builds automáticos, **desconectá ese build** (o desactivá el disparo por Git). Si no, cada push puede disparar **Cloudflare Builds y GitHub Actions** a la vez.

Este flujo asume que **el deploy lo hace solo GitHub Actions**.

## 3. Primer deploy

1. Creá los 6 secretos.
2. Hacé `push` a `main` (o en GitHub: **Actions → Deploy Cloudflare → Run workflow**).
3. En Cloudflare, abrí el Worker **`apex-suspension`** (nombre de `wrangler.jsonc`) y comprobá la URL `*.workers.dev` o el dominio que asignes después.

## 4. Local

Seguís usando `.env.local` como hasta ahora; GitHub Actions **no** lee ese archivo.
