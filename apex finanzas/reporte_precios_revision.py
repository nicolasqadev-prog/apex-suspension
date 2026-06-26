"""Reporte de revision pre-deploy (solo lectura)."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from excel_precios_formulas import (
    MARGEN_TALLER_ALTO,
    MARGEN_TALLER_BAJO,
    costo_real_desde_catalogo,
)

from inventario_config import INVENTARIO_VIVO, SHEET_INVENTARIO

BASE = Path(__file__).parent
ARCHIVO = INVENTARIO_VIVO


def main() -> None:
    df = pd.read_excel(ARCHIVO, sheet_name="Inventario")
    col_pub = next(c for c in df.columns if "blico" in c and "pieza" in c)
    desc_col = "DESCRIPCIÓN" if "DESCRIPCIÓN" in df.columns else "DESCRIPCION"

    print("REVISION PRE-DEPLOY")
    print(f"Archivo: {ARCHIVO.name}")
    print(f"Taller % peq {MARGEN_TALLER_BAJO:.3f} | gra {MARGEN_TALLER_ALTO:.3f} (base catalogo)")

    for ref in ("KSL-1001", "KBJ-4008", "KSA-CH043", "KSA-HY016"):
        r = df[df["REFERENCIA"] == ref].iloc[0]
        cat = float(r["Catálogo / pieza"])
        fact = float(r.get("Facturado / pieza") or 0)
        iva, fondo, cr = costo_real_desde_catalogo(cat, fact)
        pt = int(r["Precio Taller / pieza"])
        pp = int(r[col_pub])
        desc = str(r[desc_col])
        print(f"\n{ref} | {desc[:50]}")
        print(f"  Stock: {int(r['STOCK (piezas)'])} | Catalogo: ${cat:,.0f} | Facturado: ${fact:,.0f}")
        print(f"  Costo real/pieza: ${cr:,}  (IVA ${iva:,} + moto ${fondo:,})")
        print(f"  Taller: ${pt:,}  |  Publico: ${pp:,}")

    ksa = df[df["REFERENCIA"].astype(str).str.startswith("KSA-")]
    print(f"\nAmortiguadores KSA-: {len(ksa)} refs (precio desde catalogo)")
    print(f"Referencias con precio: {df['Precio Taller / pieza'].notna().sum()}")
    print(f"Taller min-max: ${int(df['Precio Taller / pieza'].min()):,} - ${int(df['Precio Taller / pieza'].max()):,}")
    print(f"Publico min-max: ${int(df[col_pub].min()):,} - ${int(df[col_pub].max()):,}")


if __name__ == "__main__":
    main()
