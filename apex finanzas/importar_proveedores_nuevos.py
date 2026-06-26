"""
Importa catálogo bajo pedido desde proveedores nuevos (Excel en Escritorio).

- Yokomitsu.xlsx → marcaProducto Yokomitsu
- Lista APEX - 22 junio.xlsx (Universal) → marcaProducto según columna Linea (CTR, Toyama…)

Precio lista del proveedor → catálogo × 1.19 + márgenes Apex (igual que KTC).
Stock = 0 (bajo pedido).
"""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from catalogo_clasificacion import (
    grupo_categoria,
    inferir_linea_vehiculo,
    marca_vehiculo_desde_texto,
    normalizar_categoria_raw,
    normalizar_marca_producto_export,
    titulo_marca,
)
from excel_precios_formulas import calcular_precios_venta
from generar_lista_precios_pedido import slug_desde_referencia

YOKOMITSU_XLSX = Path(r"c:\Users\Usuario\OneDrive\Escritorio\YOKOMITSU.xlsx")
UNIVERSAL_XLSX = Path(r"c:\Users\Usuario\OneDrive\Escritorio\Lista APEX - 22 junio.xlsx")


def _col(df: pd.DataFrame, *names: str) -> str | None:
    cols = {str(c).strip().upper(): c for c in df.columns}
    for n in names:
        key = n.strip().upper()
        if key in cols:
            return cols[key]
    return None


def calcular_precios_desde_catalogo(precio_catalogo: float) -> tuple[int, int]:
    base = float(precio_catalogo)
    if base <= 0:
        return 0, 0
    return calcular_precios_venta(base)


def _marca_vehiculo_yokomitsu(marca: str, modelo: str, desc: str) -> str:
    m = str(marca or "").strip()
    if m:
        upper = m.upper()
        if upper == "HYUNDAI-KIA" or upper == "HYUNDAI/KIA":
            return "Hyundai/Kia"
        desde = marca_vehiculo_desde_texto(f"{m} {modelo} {desc}")
        if desde:
            return desde
        return titulo_marca(m)
    return marca_vehiculo_desde_texto(f"{modelo} {desc}") or "Varios"


def _marca_vehiculo_universal(marca: str, desc: str) -> str:
    m = str(marca or "").strip()
    if not m:
        return marca_vehiculo_desde_texto(desc) or "Varios"
    upper = m.upper()
    if "HYUNDAI" in upper and "KIA" in upper:
        return "Hyundai/Kia"
    return marca_vehiculo_desde_texto(f"{m} {desc}") or titulo_marca(m)


def _categoria_yokomitsu(grupo: str, linea: str, desc: str) -> str:
    blob = f"{grupo} {linea} {desc}".upper()
    if "AMORT" in blob:
        return "Amortiguadores"
    if "TIJERA" in blob or "BRAZO" in blob:
        return "Tijeras y brazos"
    if "ROTUL" in blob or "TERMINAL" in blob or "AXIAL" in blob:
        return "Terminales y rótulas"
    if "BUJE" in blob or "BIELETA" in blob or "ESTAB" in blob:
        return "Bujes y bieletas"
    if "PORTAMANGUETA" in blob or "MANGUETA" in blob:
        return "Tijeras y brazos"
    if "CAJA DIRECCION" in blob or "DIRECCION" in blob:
        return "Dirección"
    if "BARRA ESTAB" in blob or "ESTABILIZADORA" in blob:
        return "Bujes y bieletas"
    g = str(grupo or linea or "Suspensión").strip()
    return normalizar_categoria_raw(g)


def _marca_producto_universal(linea: str) -> str:
    """Columna Linea del Excel Universal: CTR, TOYAMA, STP, HYUNDAI MOBIS…"""
    l = str(linea or "").strip()
    if not l or l.lower() == "nan":
        return "CTR"
    upper = l.upper()
    if "CTR" in upper:
        return "CTR"
    if "STP" in upper:
        return "STP"
    if "TOYAMA" in upper:
        return "Toyama"
    if "MOBIS" in upper:
        return "Mobis"
    if "WURTEX" in upper:
        return "Wurtex"
    return normalizar_marca_producto_export(titulo_marca(l))


def _categoria_universal(desc: str) -> str:
    d = str(desc or "").upper()
    if "AMORT" in d:
        return "Amortiguadores"
    if "ROTUL" in d or "TERMINAL" in d or "AXIAL" in d:
        return "Terminales y rótulas"
    if "BUJE" in d or "BIELETA" in d:
        return "Bujes y bieletas"
    if "BASE AMORT" in d:
        return "Amortiguadores"
    return "Suspensión"


def _pieza_base(
    *,
    referencia: str,
    nombre: str,
    aplicacion: str,
    categoria: str,
    marca_veh: str,
    marca_producto: str,
    precio_catalogo: float,
) -> dict | None:
    ref = str(referencia).strip().upper()
    if not ref or ref in ("NAN", "NONE"):
        return None
    taller, publico = calcular_precios_desde_catalogo(precio_catalogo)
    if publico <= 0:
        return None
    cat = normalizar_categoria_raw(categoria)
    return {
        "slug": slug_desde_referencia(ref),
        "referencia": ref,
        "nombre": nombre[:80],
        "aplicacion": aplicacion,
        "categoria": cat,
        "categoriaGrupo": grupo_categoria(cat),
        "precioLista": publico,
        "precioTaller": taller,
        "precioBase": int(round(precio_catalogo)),
        "stock": 0,
        "marca": marca_veh,
        "marcaProducto": marca_producto,
        "lineaVehiculo": inferir_linea_vehiculo(
            marca_producto=marca_producto,
            nombre=nombre,
            aplicacion=aplicacion,
            categoria=cat,
            marca_vehiculo=marca_veh,
        ),
        "enBodega": False,
    }


def importar_yokomitsu(path: Path = YOKOMITSU_XLSX) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"No existe {path}")
    df = pd.read_excel(path)
    c_cod = _col(df, "CODIGO")
    c_grupo = _col(df, "GRUPO")
    c_linea = _col(df, "LINEA")
    c_desc = _col(df, "DESCRIPCION")
    c_marca = _col(df, "MARCA")
    c_modelo = _col(df, "MODELO")
    c_anio = _col(df, "AÑO", "ANO", "AO")
    c_precio = _col(df, "PRECIO")
    if not all([c_cod, c_desc, c_precio]):
        raise ValueError("YOKOMITSU.xlsx: faltan columnas CODIGO, DESCRIPCION o PRECIO")

    vistos: set[str] = set()
    piezas: list[dict] = []
    for _, row in df.iterrows():
        ref = str(row[c_cod]).strip()
        if not ref or ref.lower() == "nan":
            continue
        ref_up = ref.upper()
        if ref_up in vistos:
            continue
        vistos.add(ref_up)

        desc = str(row[c_desc]).strip()
        marca = str(row[c_marca]).strip() if c_marca else ""
        modelo = str(row[c_modelo]).strip() if c_modelo else ""
        anio = str(row[c_anio]).strip() if c_anio and pd.notna(row[c_anio]) else ""
        grupo = str(row[c_grupo]).strip() if c_grupo else ""
        linea = str(row[c_linea]).strip() if c_linea else ""
        precio = pd.to_numeric(row[c_precio], errors="coerce")
        if pd.isna(precio) or float(precio) <= 0:
            continue

        marca_veh = _marca_vehiculo_yokomitsu(marca, modelo, desc)
        categoria = _categoria_yokomitsu(grupo, linea, desc)
        partes = [desc]
        if marca or modelo:
            partes.append(f"· {marca} {modelo}".strip())
        if anio and anio.lower() != "nan":
            partes.append(anio)
        aplicacion = " ".join(partes).strip()

        item = _pieza_base(
            referencia=ref_up,
            nombre=desc,
            aplicacion=aplicacion,
            categoria=categoria,
            marca_veh=marca_veh,
            marca_producto="Yokomitsu",
            precio_catalogo=float(precio),
        )
        if item:
            piezas.append(item)
    return piezas


def importar_universal(path: Path = UNIVERSAL_XLSX) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"No existe {path}")
    df = pd.read_excel(path)
    c_cod = _col(df, "COD_UR", "Cod_UR")
    c_ref_oe = _col(df, "REFERENCIA", "Referencia")
    c_eq = _col(df, "EQUIVALENCIA", "Equivalencia")
    c_desc = _col(df, "DESCRIPCION", "Descripcion")
    c_marca = _col(df, "MARCA", "Marca")
    c_linea = _col(df, "LINEA", "Linea")
    c_precio = _col(df, "PRECIO", "Precio")
    if not all([c_cod, c_desc, c_precio]):
        raise ValueError("Lista APEX: faltan columnas Cod_UR, Descripcion o Precio")

    vistos: set[str] = set()
    piezas: list[dict] = []
    for _, row in df.iterrows():
        ref = str(row[c_cod]).strip().upper()
        if not ref or ref.lower() == "nan":
            continue
        if ref in vistos:
            continue
        vistos.add(ref)

        desc = str(row[c_desc]).strip()
        precio = pd.to_numeric(row[c_precio], errors="coerce")
        if pd.isna(precio) or float(precio) <= 0:
            continue

        oe = ""
        if c_ref_oe and pd.notna(row[c_ref_oe]):
            oe = str(row[c_ref_oe]).strip()
        eq = ""
        if c_eq and pd.notna(row[c_eq]):
            eq = str(row[c_eq]).strip()
        linea_prov = str(row[c_linea]).strip() if c_linea and pd.notna(row[c_linea]) else ""
        marca_prod = _marca_producto_universal(linea_prov)
        marca = str(row[c_marca]).strip() if c_marca and pd.notna(row[c_marca]) else ""

        marca_veh = _marca_vehiculo_universal(marca, desc)
        categoria = _categoria_universal(desc)
        partes = [desc]
        if oe and oe.lower() != "nan":
            partes.append(f"· OE {oe}")
        if linea_prov:
            partes.append(f"· {linea_prov}")
        if eq and eq.lower() != "nan" and eq.upper() != ref:
            partes.append(f"· Eq. {eq}")
        aplicacion = " ".join(partes).strip()

        item = _pieza_base(
            referencia=ref,
            nombre=desc,
            aplicacion=aplicacion,
            categoria=categoria,
            marca_veh=marca_veh,
            marca_producto=marca_prod,
            precio_catalogo=float(precio),
        )
        if item:
            piezas.append(item)
    return piezas


def importar_proveedores_nuevos() -> list[dict]:
    yoko = importar_yokomitsu()
    uni = importar_universal()
    return yoko + uni


def es_districamiones(marca_producto: str) -> bool:
    return "districam" in str(marca_producto or "").lower()


if __name__ == "__main__":
    y = importar_yokomitsu()
    u = importar_universal()
    print(f"Yokomitsu: {len(y)} piezas")
    print(f"Universal: {len(u)} piezas")
    print(f"Total nuevos: {len(y) + len(u)}")
    if y:
        e = y[0]
        print(f"Ej Yokomitsu {e['referencia']}: pub={e['precioLista']:,} taller={e['precioTaller']:,}")
    if u:
        e = u[0]
        print(f"Ej Universal {e['referencia']}: pub={e['precioLista']:,} taller={e['precioTaller']:,}")
