"""Clasificación de catálogo KTC: proveedor, vehículo, línea y categoría agrupada."""

from __future__ import annotations

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
    "JEEP",
    "FIAT",
    "ISUZU",
]

MARCAS_VEHICULO_UPPER = {m.upper() for m in MARCAS_VEHICULO}

PROVEEDORES = {
    "KTC",
    "DISTRICAMIONES",
    "WURTEX",
    "NAVCAR",
    "ZSG",
    "DMB",
    "MOOG",
    "CORVEN",
    "NAKATA",
    "SABO",
}

PROVEEDORES_CAMION = {"DISTRICAMIONES", "ISUZU"}

KEYWORDS_CAMION = (
    "HINO",
    "NPR",
    "NQR",
    "NKR",
    "FOTON",
    "FREIGHT",
    "VOLQU",
    "CAMION",
    "CAMIÓN",
    "MULTIPLICADOR",
    "BUSES",
    "BUS ",
)


def titulo_marca(raw: str) -> str:
    r = raw.strip()
    if not r:
        return "KTC"
    upper = r.upper()
    if upper.startswith("MERCEDES"):
        return "Mercedes Benz"
    if upper == "DISTRICAMIONES":
        return "Districamiones"
    if upper in PROVEEDORES:
        return upper if upper == "KTC" else upper.title()
    return r.title()


def marca_vehiculo_desde_texto(texto: str) -> str | None:
    upper = texto.upper()
    for marca in MARCAS_VEHICULO:
        if marca in upper:
            return titulo_marca(marca)
    return None


def grupo_categoria(categoria: str) -> str:
    c = (categoria or "").strip().lower()
    if not c:
        return "Sin categoría"
    if "amortigu" in c:
        return "Amortiguadores"
    if "rotul" in c or "terminal" in c:
        return "Terminales y rótulas"
    if "bieleta" in c or "buj" in c:
        return "Bujes y bieletas"
    if "reten" in c or "sello" in c:
        return "Sellos y retenes"
    if "tornill" in c or "tuerca" in c or "pasador" in c:
        return "Tornillería y fijación"
    if "rodamiento" in c:
        return "Rodamientos"
    if "cable" in c or "guaya" in c:
        return "Cables y guayas"
    if "soporte" in c or "antivibr" in c:
        return "Soportería y antivibración"
    return categoria.strip()


def normalizar_categoria_raw(cat: str) -> str:
    c = str(cat or "").strip()
    if not c:
        return "Suspensión"
    return c[:1].upper() + c[1:].lower() if c.isupper() else c


def clasificar_marca_producto(raw: str) -> tuple[str, str | None]:
    """Devuelve (marca_producto proveedor, pista marca vehículo opcional)."""
    r = str(raw or "KTC").strip().upper()
    if r in PROVEEDORES:
        return titulo_marca(r), None
    if r in MARCAS_VEHICULO_UPPER:
        return "KTC", titulo_marca(r)
    # Marca desconocida en Excel: tratar como proveedor literal
    return titulo_marca(r), None


def inferir_linea_vehiculo(
    *,
    marca_producto: str,
    nombre: str,
    aplicacion: str,
    categoria: str,
    marca_vehiculo: str,
) -> str:
    mp = marca_producto.upper()
    if mp in PROVEEDORES_CAMION:
        return "camion"
    blob = f"{nombre} {aplicacion} {categoria} {marca_vehiculo}".upper()
    if any(k in blob for k in KEYWORDS_CAMION):
        return "camion"
    cat = categoria.lower()
    if "cabina" in cat and "auto" not in cat:
        return "camion"
    if mp == "DISTRICAMIONES":
        return "camion"
    return "liviano"


def resolver_marca_vehiculo(
    nombre: str,
    marca_producto_raw: str,
    overlay_marca: str | None = None,
) -> str:
    if overlay_marca and overlay_marca.strip():
        return overlay_marca.strip()
    _, pista = clasificar_marca_producto(marca_producto_raw)
    if pista:
        return pista
    desde_nombre = marca_vehiculo_desde_texto(nombre)
    if desde_nombre:
        return desde_nombre
    desde_mp = marca_vehiculo_desde_texto(marca_producto_raw)
    if desde_mp:
        return desde_mp
    return "Varios"
