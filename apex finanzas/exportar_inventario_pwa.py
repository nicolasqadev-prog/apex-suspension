"""Exporta data/inventario-vivo.json desde Inventario_Apex_VIVO_Actualizado.xlsx."""

from __future__ import annotations

from pathlib import Path

from openpyxl import load_workbook

from actualizar_precios import OUTPUT_FALLBACK, OUTPUT_XLSX
from inventario_core import export_pwa_from_workbook

BASE = Path(__file__).parent


def main() -> None:
    fuente = OUTPUT_XLSX if OUTPUT_XLSX.exists() else OUTPUT_FALLBACK
    if not fuente.exists():
        raise FileNotFoundError("Ejecuta primero: py -3 actualizar_precios.py")

    wb = load_workbook(fuente, data_only=True)
    n = export_pwa_from_workbook(wb)
    wb.close()
    print(f"Fuente: {fuente.name}")
    print(f"Piezas exportadas: {n}")
    print(f"JSON: {BASE.parent / 'data' / 'inventario-vivo.json'}")
    print("Siguiente: npm run sync:inventory -- data/inventario-vivo.json")


if __name__ == "__main__":
    main()
