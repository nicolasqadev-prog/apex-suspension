"""
Genera el catálogo general PWA desde lista_persona (1).xlsx.

- Precio base (sin IVA) -> fórmula oficial Apex:
    CR = base * 1.19 + 10_000
    Precio taller  = CR / 0.78
    Precio público = CR / 0.65  -> precioLista en PWA
- Stock = 0 (catálogo general). Si existe inventario-vivo.json, fusiona stock real.

Uso:
  py -3 generar_catalogo_completo.py
  npm run sync:inventory -- data/inventario-catalogo-completo.json
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pandas as pd

from generar_lista_precios_pedido import (
    COSTO_OCULTO,
    DESCUENTO_TALLER_PWA_PCT,
    IVA,
    MARGEN_PUBLICO,
    MARGEN_TALLER,
    slug_desde_referencia,
)

BASE = Path(__file__).parent
LISTA_PERSONA_XLSX = Path(r"c:\Users\Usuario\Downloads\lista_persona (1).xlsx")
OUTPUT_JSON = BASE.parent / "data" / "inventario-catalogo-completo.json"
OUTPUT_PWA_LOCAL = BASE / "carga-pwa-catalogo.json"
VIVO_JSON = BASE.parent / "data" / "inventario-vivo.json"

MARCAS_VEHICULO = [
    "MERCEDES BENZ",
    "MERCEDES-BENZ",
    "CHEVROLET",
    "VOLKSWAGEN",
    "MITSUBISHI",
    "CHRYSLER",
    "DAEWOO",
    "RENAULT",
    "HYUNDAI",
    "TOYOTA",
    "NISSAN",
    "MAZDA",
    "DODGE",
    "HONDA",
    "FORD",
    "SUZUKI",
    "BMW",
    "KIA",
]


def calcular_precios(precio_base: float) -> tuple[float, float, float]:
    cr = precio_base * (1 + IVA) + COSTO_OCULTO
    return cr / MARGEN_TALLER, cr / MARGEN_PUBLICO, cr


def normalizar_categoria(cat: str) -> str:
    c = str(cat or "").strip()
    if not c:
        return "Suspensión"
    return c[:1].upper() + c[1:].lower() if c.isupper() else c


def marca_desde_nombre(nombre: str) -> str:
    upper = nombre.upper()
    for marca in MARCAS_VEHICULO:
        if marca in upper:
            if marca.startswith("MERCEDES"):
                return "Mercedes Benz"
            return marca.title()
    return "Varios"


def cargar_lista_persona() -> pd.DataFrame:
    df = pd.read_excel(LISTA_PERSONA_XLSX, sheet_name="Persona")
    df = df.dropna(subset=["REFERENCIA/MODELO", "PRECIO BASE (COP)"])
    df["REFERENCIA/MODELO"] = df["REFERENCIA/MODELO"].astype(str).str.strip().str.upper()
    df["PRECIO BASE (COP)"] = pd.to_numeric(df["PRECIO BASE (COP)"], errors="coerce")
    df = df[df["PRECIO BASE (COP)"] > 0]
    df = df.drop_duplicates(subset=["REFERENCIA/MODELO"], keep="first")
    return df


def cargar_overlay_vivo() -> dict[str, dict]:
    if not VIVO_JSON.exists():
        return {}
    data = json.loads(VIVO_JSON.read_text(encoding="utf-8"))
    return {
        str(p["referencia"]).strip().upper(): p
        for p in data.get("piezas", [])
        if p.get("referencia")
    }


def construir_piezas(df: pd.DataFrame, overlay: dict[str, dict]) -> list[dict]:
    piezas: list[dict] = []
    for _, row in df.iterrows():
        ref = row["REFERENCIA/MODELO"]
        nombre = str(row["NOMBRE PRODUCTO"]).strip()
        categoria = normalizar_categoria(row.get("CATEGORÍA", ""))
        base = float(row["PRECIO BASE (COP)"])
        taller, publico, _ = calcular_precios(base)

        item = {
            "slug": slug_desde_referencia(ref),
            "referencia": ref,
            "nombre": nombre[:80],
            "aplicacion": nombre,
            "categoria": categoria,
            "precioLista": int(round(publico)),
            "precioTaller": int(round(taller)),
            "precioBase": int(round(base)),
            "stock": 0,
            "marca": marca_desde_nombre(nombre),
            "marcaProducto": str(row.get("MARCA PRODUCTO", "KTC")).strip() or "KTC",
            "enBodega": False,
        }

        if ref in overlay:
            v = overlay[ref]
            item["stock"] = int(v.get("stock", 0))
            item["enBodega"] = item["stock"] > 0
            if v.get("precioLista"):
                item["precioLista"] = int(v["precioLista"])
                item["precioTaller"] = int(round(item["precioLista"] * (1 - DESCUENTO_TALLER_PWA_PCT / 100)))
            if v.get("marca"):
                item["marca"] = v["marca"]
            if v.get("categoria"):
                item["categoria"] = v["categoria"]
            if v.get("nombre"):
                item["nombre"] = str(v["nombre"])[:80]
            if v.get("aplicacion"):
                item["aplicacion"] = v["aplicacion"]

        piezas.append(item)

    # Productos solo en bodega (DMB, etc.) que no están en lista persona
    refs_en_catalogo = {p["referencia"] for p in piezas}
    for ref, v in overlay.items():
        if ref in refs_en_catalogo:
            continue
        piezas.append(
            {
                "slug": slug_desde_referencia(ref),
                "referencia": ref,
                "nombre": str(v.get("nombre", ref))[:80],
                "aplicacion": v.get("aplicacion") or v.get("nombre", ref),
                "categoria": v.get("categoria") or "Suspensión",
                "precioLista": int(v.get("precioLista", 0)),
                "precioTaller": int(
                    round(int(v.get("precioLista", 0)) * (1 - DESCUENTO_TALLER_PWA_PCT / 100))
                ),
                "precioBase": 0,
                "stock": int(v.get("stock", 0)),
                "marca": v.get("marca") or "Varios",
                "marcaProducto": v.get("marca") or "DMB",
                "enBodega": int(v.get("stock", 0)) > 0,
            }
        )

    piezas.sort(key=lambda p: p["nombre"])
    return piezas


def payload_pwa(piezas: list[dict]) -> dict:
    export = []
    for p in piezas:
        export.append(
            {
                "slug": p["slug"],
                "referencia": p["referencia"],
                "nombre": p["nombre"],
                "aplicacion": p["aplicacion"],
                "categoria": p["categoria"],
                "precioLista": p["precioLista"],
                "stock": p["stock"],
                "marca": p["marca"],
            }
        )
    con_stock = sum(1 for p in piezas if p["stock"] > 0)
    return {
        "meta": {
            "fuente": "lista-persona-catalogo-completo",
            "actualizado": date.today().isoformat(),
            "moneda": "COP",
            "nota": (
                "Catálogo general KTC (~5900 refs). precioLista = precio PÚBLICO "
                f"(base×1.19+{COSTO_OCULTO:,} ÷ 0.65). Taller en PWA: "
                f"{DESCUENTO_TALLER_PWA_PCT}% desc. sobre precioLista. "
                "stock=0 salvo fusion con inventario-vivo.json."
            ),
            "descuentoTallerRecomendadoPct": DESCUENTO_TALLER_PWA_PCT,
            "totalPiezas": len(piezas),
            "conStockBodega": con_stock,
        },
        "piezas": export,
    }


def main() -> None:
    if not LISTA_PERSONA_XLSX.exists():
        raise SystemExit(f"No existe: {LISTA_PERSONA_XLSX}")

    df = cargar_lista_persona()
    overlay = cargar_overlay_vivo()
    piezas = construir_piezas(df, overlay)
    data = payload_pwa(piezas)

    text = json.dumps(data, ensure_ascii=False, indent=2)
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(text, encoding="utf-8")
    OUTPUT_PWA_LOCAL.write_text(text, encoding="utf-8")

    con_stock = data["meta"]["conStockBodega"]
    print(f"Catálogo generado: {len(piezas)} piezas")
    print(f"  Con stock bodega: {con_stock}")
    print(f"  Sin stock (catálogo): {len(piezas) - con_stock}")
    print(f"JSON: {OUTPUT_JSON}")
    print(f"Local: {OUTPUT_PWA_LOCAL}")
    print()
    print("Subir a Supabase:")
    print("  npm run sync:inventory -- data/inventario-catalogo-completo.json")

    # Muestra ejemplo
    ej = next((p for p in piezas if p["referencia"] == "KTR-4015"), piezas[0])
    print()
    print(
        f"Ejemplo {ej['referencia']}: público={ej['precioLista']:,} "
        f"taller={ej['precioTaller']:,} stock={ej['stock']}"
    )


if __name__ == "__main__":
    main()
