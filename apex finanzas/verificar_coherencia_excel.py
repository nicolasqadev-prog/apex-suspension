"""Verifica cobertura y coherencia del inventario vivo (solo lectura)."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from excel_precios_formulas import (
    calcular_precios_venta,
    costo_real_desde_catalogo,
    es_referencia_producto,
)
from inventario_config import INVENTARIO_VIVO, SHEET_INVENTARIO

BASE = Path(__file__).parent
ARCHIVO = INVENTARIO_VIVO


def main() -> None:
    if not ARCHIVO.exists():
        raise FileNotFoundError(f"No existe {ARCHIVO}")

    df = pd.read_excel(ARCHIVO, sheet_name=SHEET_INVENTARIO)
    col_pub = next(c for c in df.columns if "blico" in c and "pieza" in c)

    productos = []
    for _, row in df.iterrows():
        ref = row.get("REFERENCIA")
        if pd.isna(ref):
            continue
        ref_s = str(ref).strip()
        if not es_referencia_producto(ref_s):
            continue
        productos.append(row)

    print(f"Archivo: {ARCHIVO.name}")
    print(f"Referencias producto: {len(productos)}")

    sin_base = []
    sin_precio = []
    errores = 0

    for row in productos:
        ref = str(row["REFERENCIA"]).strip()
        cat = float(row.get("Catálogo / pieza") or 0)
        fact = float(row.get("Facturado / pieza") or 0)
        if cat <= 0 and fact <= 0:
            sin_base.append(ref)
            continue

        pt = row.get("Precio Taller / pieza")
        if pd.isna(pt) or float(pt) <= 0:
            sin_precio.append(ref)
            continue

        _, _, cr_calc = costo_real_desde_catalogo(cat, fact)
        pt_calc, pp_calc = calcular_precios_venta(cat, fact)
        stock = int(row["STOCK (piezas)"] or 0)
        pt_i = int(pt)
        pp_i = int(row[col_pub])
        cr = int(row.get("Costo real / pieza") or 0)

        if abs(cr - cr_calc) > 1:
            print(f"ERR {ref}: costo real / pieza ({cr} vs {cr_calc})")
            errores += 1
        if abs(pt_i - pt_calc) > 1:
            print(f"ERR {ref}: precio taller ({pt_i} vs {pt_calc})")
            errores += 1
        if abs(pp_i - pp_calc) > 1:
            print(f"ERR {ref}: precio publico ({pp_i} vs {pp_calc})")
            errores += 1
        if pt_i < cr_calc:
            print(f"ERR {ref}: taller bajo costo real")
            errores += 1

    ok = len(productos) - len(sin_base) - len(sin_precio) - errores
    print(f"Con metodo completo aplicado: {ok}/{len(productos)}")
    if sin_base:
        print(f"Sin catalogo/facturado ({len(sin_base)}): {', '.join(sin_base)}")
    if sin_precio:
        print(f"Sin precio taller ({len(sin_precio)}): {', '.join(sin_precio)}")
    print(f"Errores matematicos: {errores}")
    if errores == 0 and not sin_precio:
        print("OK - precios cuadran con formula (base catalogo)")


if __name__ == "__main__":
    main()
