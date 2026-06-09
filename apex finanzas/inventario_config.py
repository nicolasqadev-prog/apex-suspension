"""Rutas y constantes del sistema de inventario Apex."""

from pathlib import Path

BASE = Path(__file__).parent
PEDIDOS_DIR = BASE / "pedidos"
ESTADO_JSON = BASE / ".inventario_estado.json"

INVENTARIO_VIVO = BASE / "Inventario_Apex_VIVO.xlsx"
INVENTARIO_PLANTILLA = BASE / "Inventario_Apex_PLANTILLA.xlsx"

OUTPUT_PWA_JSON = BASE / "carga-pwa-catalogo.json"
OUTPUT_PWA_JSON_DATA = BASE.parent / "data" / "inventario-vivo.json"
OUTPUT_STOCK_CSV = BASE / "carga-stock-pwa.csv"

SHEET_INVENTARIO = "Inventario"
SHEET_MOVIMIENTOS = "Movimientos"
SHEET_ALERTAS = "Alertas"
SHEET_RESUMEN = "Resumen"
SHEET_GUIA = "Guía producto nuevo"

MOVIMIENTOS_HEADERS = [
    "Fecha",
    "Hora",
    "Referencia",
    "Tipo",
    "Cantidad",
    "Stock anterior",
    "Stock nuevo",
    "Motivo",
    "Usuario",
]

ALERTAS_HEADERS = ["Prioridad", "REFERENCIA", "DESCRIPCIÓN", "STOCK", "Acción sugerida"]

# Columnas editables en Inventario (1-based)
COL_REF = 1
COL_DESC = 2
COL_MARCA = 3
COL_STOCK = 4
COL_CATALOGO = 5
COL_FACTURADO = 7
COL_PRECIO_TALLER = 9
COL_PRECIO_PUBLICO = 10

EDITABLE_COLS = {COL_REF, COL_DESC, COL_MARCA, COL_STOCK, COL_CATALOGO, COL_FACTURADO}
