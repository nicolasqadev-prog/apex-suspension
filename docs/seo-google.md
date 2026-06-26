# Aparecer en Google — Apex Suspensión

## Por qué hoy no sale en “apex suspension colombia”

1. **Marca ambigua:** Google mezcla APEX europeo, WP APEX (KTM) e Informacolombia (“Apex Suspension Sas”).
2. **Dominio nuevo:** `apex-suspension.com.co` tarda semanas en indexarse si no lo registrás en Search Console.
3. **robots.txt sin sitemap (corregido):** el archivo estático en `public/` tapaba la versión dinámica; Google no veía `Sitemap: …/sitemap.xml`.

## Checklist (orden recomendado)

### 1. Verificar que el sitio responde bien

Abrí en el navegador:

- https://apex-suspension.com.co/
- https://apex-suspension.com.co/robots.txt → debe incluir `Sitemap: https://apex-suspension.com.co/sitemap.xml`
- https://apex-suspension.com.co/sitemap.xml → índice con miles de URLs de repuestos

### 2. Google Search Console (obligatorio)

1. Entrá a [Google Search Console](https://search.google.com/search-console).
2. **Agregar propiedad** → URL del prefijo: `https://apex-suspension.com.co`
3. Verificación: **Registro DNS** en Cloudflare (TXT que te da Google) o archivo HTML.
4. Menú **Sitemaps** → enviar: `https://apex-suspension.com.co/sitemap.xml`
5. **Inspección de URLs** → pegá la home → **Solicitar indexación**.

Repetí “Solicitar indexación” para `/catalogo` y `/taller`.

### 3. Google Business Profile

Perfil de negocio con:

- Nombre: **Apex Suspensión**
- Categoría: tienda de repuestos automotrices
- Zona: Sabana de Bogotá (Chía, Cajicá, etc.)
- Sitio web: `https://apex-suspension.com.co`
- WhatsApp y horario real

Es clave para búsquedas locales (“repuestos suspensión chía”).

### 4. Secretos de deploy

En GitHub → Secrets → `VITE_SITE_URL` = `https://apex-suspension.com.co` (sin barra final).

Sin esto, el canonical y Open Graph pueden quedar incompletos en algunos entornos.

### 5. Tiempo y búsquedas de prueba

- Primera indexación: **3–14 días** tras Search Console.
- Probá: `site:apex-suspension.com.co` en Google.
- Búsqueda de marca: `apex suspensión sabana` o `apex-suspension.com.co`.

### 6. Señales externas (aceleran)

- Enlace desde Instagram / WhatsApp Business al dominio.
- Mención en directorios locales **con la URL correcta** (no solo Informacolombia).
- Pedir a 2–3 talleres aliados que guarden el enlace del catálogo.

## Qué ya tiene la PWA

- `sitemap.xml` con catálogo completo (chunks de productos)
- Canonical en páginas principales
- JSON-LD `AutoPartsStore` en el inicio
- `robots.txt` dinámico con sitemap (tras deploy sin `public/robots.txt` estático)

## Qué NO esperar de inmediato

- Posición #1 en “apex suspension colombia” (compite con marcas globales y directorios viejos).
- Aparecer antes de registrar Search Console y pedir indexación.
