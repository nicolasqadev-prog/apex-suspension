# Seguridad operativa Apex

Documento interno: cómo está protegida la PWA en la práctica de Apex (no auditoría externa).

## Secretos

| Secreto | Dónde vive | Notas |
|---------|------------|-------|
| `ADMIN_PIN` | GitHub Secrets → Cloudflare Wrangler | No va al navegador. Sesión admin = cookie HttpOnly firmada en servidor. |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Secrets + `.env.local` en tu PC | Solo servidor. Nunca `VITE_*`. |
| `.env.local` | Tu máquina, gitignored | Herramienta de desarrollo; no es superficie pública. |

Si alguien roba el service role, tiene acceso total a la BD. Mitigación: no commitear, no poner en variables `VITE_`, rotar si hubo fuga.

## Portal taller (WhatsApp)

- Cada taller entra con el **WhatsApp del encargado** registrado por ustedes en admin.
- No hay OTP: quien conozca el número puede entrar. En Apex eso es aceptable porque:
  - Los números son de encargados conocidos.
  - No se promociona “prueba con cualquier número”.
  - El dispositivo del taller suele quedar con la sesión guardada.

## Admin

- PIN se valida en servidor.
- Tras login correcto: cookie `apex_admin_sess` (HttpOnly, 8 h).
- El PIN **no** se guarda en `sessionStorage` ni se envía en cada petición.

## Catálogo público

- El JSON del catálogo público **no incluye** `precioTallerRef`.
- Precio de aliado solo en endpoints de taller autenticado por WhatsApp registrado.

## Push

- Registrar notificaciones con teléfono solo si el número es **taller activo** u **operador Apex** (`APEX_ADMIN_WHATSAPP`).
- Límite de intentos por IP.

## Consulta taller (mostrador)

- `consultarTallerFidelizado` tiene rate limit (12 / 10 min por IP).

## Qué revisar antes de visitas / producción

1. `ADMIN_PIN` en secretos de Cloudflare (no el de desarrollo).
2. Modo demostración **apagado** fuera de demos.
3. `npm run qa:audit` → APROBADO.
4. Checklist admin en verde.

## Mejora futura (opcional)

- OTP por WhatsApp al login taller, si abren el portal a muchos talleres sin relación directa.
