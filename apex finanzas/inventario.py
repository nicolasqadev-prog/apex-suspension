"""
Inventario Apex — comando principal.

  py -3 inventario.py inicializar     Crea Inventario_Apex_VIVO.xlsx desde pedido
  py -3 inventario.py plantilla       Crea plantilla vacía
  py -3 inventario.py sincronizar     Exporta PWA + detecta cambios de stock
  py -3 inventario.py validar         Revisa errores en el inventario vivo
  py -3 inventario.py precios REF     Calcula precio taller/público desde catálogo
"""

from __future__ import annotations

import argparse
import shutil
from datetime import datetime
from pathlib import Path

from inventario_config import INVENTARIO_PLANTILLA, INVENTARIO_VIVO, PEDIDOS_DIR
from inventario_core import (
    auto_calc_precios_referencia,
    crear_plantilla,
    inicializar_desde_pedido,
    sincronizar,
    validar_filas_inventario,
)
from openpyxl import load_workbook


def cmd_inicializar(forzar: bool) -> None:
    if INVENTARIO_VIVO.exists():
        if not forzar:
            print(f"Ya existe {INVENTARIO_VIVO.name}. Usa --forzar para respaldar y recrear.")
            return
        backup = INVENTARIO_VIVO.with_name(
            f"Inventario_Apex_VIVO_backup_{datetime.now():%Y%m%d_%H%M}.xlsx"
        )
        shutil.copy2(INVENTARIO_VIVO, backup)
        print(f"Respaldo: {backup.name}")
        INVENTARIO_VIVO.unlink()

    path = inicializar_desde_pedido(INVENTARIO_VIVO)
    print(f"Inventario vivo creado: {path}")
    print("Hojas: Inventario | Movimientos | Alertas | Resumen | Guía producto nuevo")


def cmd_plantilla() -> None:
    path = crear_plantilla(INVENTARIO_PLANTILLA)
    print(f"Plantilla creada: {path}")


def cmd_sincronizar() -> None:
    res = sincronizar(INVENTARIO_VIVO)
    print(f"Sincronizado: {res['piezas_pwa']} piezas -> PWA")
    print(f"JSON: {res['json']}")
    print(f"Cambios de stock registrados: {res['cambios_registrados']}")
    print(f"Alertas stock bajo (<=1): {res['alertas_stock_bajo']}")
    print(f"Supabase: {res.get('supabase', 'n/a')}")


def cmd_validar() -> None:
    wb = load_workbook(INVENTARIO_VIVO)
    errores = validar_filas_inventario(wb)
    if errores:
        print("Errores encontrados:")
        for e in errores:
            print(f"  - {e}")
    else:
        print("Inventario válido. Sin errores.")


def cmd_precios(referencia: str) -> None:
    auto_calc_precios_referencia(INVENTARIO_VIVO, referencia)
    print(f"Precios actualizados para {referencia.upper()}")


def main() -> None:
    PEDIDOS_DIR.mkdir(parents=True, exist_ok=True)
    parser = argparse.ArgumentParser(description="Sistema de inventario Apex")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_init = sub.add_parser("inicializar", help="Crear inventario vivo desde pedido")
    p_init.add_argument("--forzar", action="store_true", help="Respaldar y recrear si ya existe")

    sub.add_parser("plantilla", help="Crear plantilla vacía")
    sub.add_parser("sincronizar", help="Sincronizar con PWA")
    sub.add_parser("validar", help="Validar datos del inventario")

    p_precios = sub.add_parser("precios", help="Calcular precios taller/público")
    p_precios.add_argument("referencia", help="Ej: KTR-4015")

    args = parser.parse_args()
    if args.cmd == "inicializar":
        cmd_inicializar(args.forzar)
    elif args.cmd == "plantilla":
        cmd_plantilla()
    elif args.cmd == "sincronizar":
        cmd_sincronizar()
    elif args.cmd == "validar":
        cmd_validar()
    elif args.cmd == "precios":
        cmd_precios(args.referencia)


if __name__ == "__main__":
    main()
