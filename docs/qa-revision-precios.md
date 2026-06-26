# Revisión QA — Reestructuración de precios (catálogo completo)

**Fecha:** 2026-06-01 (actualizado tras sync masivo)  
**Alcance:** Excel bodega + lista_persona (~5910) → JSON → Supabase → PWA producción  
**Veredicto global:** **APROBADO**

---

## 1. Resumen ejecutivo

| Capa | Resultado | Detalle |
|------|-----------|---------|
| Excel bodega (124) | ✅ OK | 124/124 refs, 0 errores matemáticos |
| Catálogo completo JSON | ✅ OK | 5910 piezas con nueva fórmula |
| Supabase bodega | ✅ OK | 124/124 JSON vivo ↔ BD |
| Supabase catálogo | ✅ OK | 5910 actualizados, 5910 con `precio_taller` |
| PWA producción | ✅ OK | Precios nuevos visibles (público + taller) |
| `qa:audit` | ✅ APROBADO | Sin fallos |

---

## 2. Fórmula aplicada

**Bodega (facturado real del Excel):**
```
costo_real = Facturado × 1.19 × 1.08
Taller: ÷0.62 / ÷0.72 / ÷0.82 (tramos por facturado)
Público: ÷0.52 / ÷0.62 / ÷0.72
Override mercado: max(fórmula, columna K)
```

**Catálogo general (~5786 refs bajo pedido):**
```
facturado = PRECIO BASE (lista_persona) × 0.75
→ misma fórmula IVA + 8% + márgenes
```

Las 124 refs de bodega toman precios de `inventario-vivo.json` (facturado real + overrides).

---

## 3. Sync ejecutado (2026-06-01)

| Paso | Resultado |
|------|-----------|
| `generar_catalogo_completo.py` | 5910 piezas (124 con stock) |
| Sync Supabase (15 lotes × 400) | **5910 actualizados**, 0 creados, stock sin tocar |
| `npm run qa:precios` | 124/124 bodega OK |
| `npm run qa:precios:catalogo` | 16 muestras OK, 5910 con precio_taller en BD |
| `npm run qa:audit` | APROBADO |

---

## 4. Muestras antes → después (público / taller)

| Ref | Antes (viejo CR÷0.65) | Después (nueva fórmula) |
|-----|----------------------|-------------------------|
| KTR-4015/4016 | $65.731 / $54.774 | **$51.000 / $42.800** |
| KSL-1001 | $48.741 / $40.616 | **$33.800 / $30.000** (override) |
| KSA-HY016 | $131.144 / $109.282 | **$98.300 / $84.600** |
| KSA-RE047 | $252.140 / $210.108 | **$173.100 / $152.000** |

---

## 5. Validación UI producción

| URL | Precio lista | Stock |
|-----|--------------|-------|
| `/repuesto/ktr-4016` | $51.000 | 2 uds |
| `/repuesto/ksl-1001` | $33.800 | 2 uds |
| `/repuesto/ksa-re047` | $173.100 | 1 ud |

Modo taller (3001234567): precios persistidos desde BD (`precio_taller`), no solo −16,67%.

---

## 6. Pipeline repetible

```bash
# Bodega (124 refs con stock real)
cd "apex finanzas"
py -3 actualizar_precios.py
py -3 exportar_inventario_pwa.py
cd ..
npm run sync:inventory -- data/inventario-vivo.json

# Catálogo completo (~5910)
cd "apex finanzas"
py -3 generar_catalogo_completo.py
py -3 sync_catalogo_paso.py --reset
# Repetir hasta completado=true:
py -3 sync_catalogo_paso.py

# Validar
npm run qa:precios
npm run qa:precios:catalogo
npm run qa:audit
```

---

## 7. Comandos QA

| Comando | Qué valida |
|---------|------------|
| `npm run qa:precios` | 124 refs bodega JSON vivo ↔ Supabase |
| `npm run qa:precios:catalogo` | Muestras catálogo completo ↔ Supabase |
| `npm run qa:audit` | Coherencia general PWA ↔ BD |
| `npm run qa:datos` | Datos maestros (marcas, categorías) |

---

*Apex Suspensión — precios unificados en todo el catálogo*
