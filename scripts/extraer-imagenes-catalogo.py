#!/usr/bin/env python3
"""
Extrae fotos de referencia desde PDFs proveedor y las vincula al stock en bodega (KTC + DMB).

Requisitos: pip install pymupdf pillow

Uso:
  python scripts/extraer-imagenes-catalogo.py
  python scripts/extraer-imagenes-catalogo.py --ktc-pdf "C:/ruta/04-Suspension.pdf" --dmb-pdf "C:/ruta/LISTA DMB JUNIO 1.pdf"
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from io import BytesIO
from pathlib import Path

try:
    import fitz  # PyMuPDF
    from PIL import Image
except ImportError:
    print("Instala dependencias: pip install pymupdf pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
VIVO_JSON = ROOT / "data" / "inventario-vivo.json"
CATALOGO_JSON = ROOT / "data" / "inventario-catalogo-completo.json"
OUT_DIR = ROOT / "public" / "catalogo"
MANIFEST = ROOT / "data" / "catalogo-imagenes.json"

DEFAULT_KTC = Path(r"c:\Users\Usuario\Downloads\04-Suspension.pdf")
DEFAULT_DMB = Path(r"c:\Users\Usuario\Downloads\LISTA DMB JUNIO 1.pdf")

PROVEEDORES_OK = {"KTC", "DMB"}


def norm_ref(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def load_bodega_ktc_dmb() -> list[dict]:
    vivo = json.loads(VIVO_JSON.read_text(encoding="utf-8"))
    catalogo = json.loads(CATALOGO_JSON.read_text(encoding="utf-8"))
    by_ref = {p["referencia"].upper(): p for p in catalogo["piezas"]}

    items: list[dict] = []
    for pieza in vivo["piezas"]:
        if int(pieza.get("stock") or 0) <= 0:
            continue
        cat = by_ref.get(pieza["referencia"].upper())
        if not cat:
            continue
        proveedor = (cat.get("marcaProducto") or "").strip().upper()
        if proveedor not in PROVEEDORES_OK:
            continue
        items.append(
            {
                "slug": cat["slug"],
                "referencia": cat["referencia"],
                "referencia_norm": norm_ref(cat["referencia"]),
                "nombre": cat.get("nombre") or pieza.get("nombre") or "",
                "proveedor": proveedor,
            }
        )
    return items


def index_page_refs(page: fitz.Page) -> dict[str, tuple[float, float, float, float]]:
    """Mapa referencia_normalizada -> bbox (primera aparición en la página)."""
    found: dict[str, tuple[float, float, float, float]] = {}
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            txt = "".join(span["text"] for span in line["spans"])
            compact = norm_ref(txt)
            if len(compact) < 4:
                continue
            if compact not in found:
                found[compact] = line["bbox"]
            # Subcadenas útiles (ej. LH:545011697R dentro de línea larga)
            for token in re.findall(r"(?:RH|LH)?[:\s]*[A-Z0-9][A-Z0-9\-]{3,}", txt.upper()):
                tn = norm_ref(token)
                if len(tn) >= 4 and tn not in found:
                    found[tn] = line["bbox"]
            # Parejas RH/LH en la misma línea
            for side, code in re.findall(r"(RH|LH)\s*:\s*([A-Z0-9\-]+)", txt.upper()):
                tn = norm_ref(code)
                if len(tn) >= 4:
                    found[tn] = line["bbox"]
                    found[norm_ref(f"{side}{code}")] = line["bbox"]
    return found


def cache_page_images(page: fitz.Page) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    seen: set[tuple[float, float, float, float]] = set()
    for img in page.get_images():
        for rect in page.get_image_rects(img[0]):
            key = (rect.x0, rect.y0, rect.x1, rect.y1)
            if key in seen:
                continue
            seen.add(key)
            rects.append(rect)
    return rects


def pick_ktc_image(
    ref_bbox: tuple[float, float, float, float], image_rects: list[fitz.Rect]
) -> fitz.Rect | None:
    rx0, ry0, rx1, ry1 = ref_bbox
    rcx = (rx0 + rx1) / 2
    col = 0 if rcx < 200 else (1 if rcx < 420 else 2)
    col_ranges = [(0, 210), (210, 420), (420, 800)]
    xlo, xhi = col_ranges[col]

    cands: list[tuple[float, fitz.Rect]] = []
    for rect in image_rects:
        if rect.width < 45 or rect.height < 45:
            continue
        if rect.width > 130 or rect.height > 130:
            continue
        icx = (rect.x0 + rect.x1) / 2
        if not (xlo <= icx < xhi):
            continue

        inside = rect.y0 <= ry0 <= rect.y1
        gap_below = ry0 - rect.y1
        if inside or (-12 <= gap_below <= 28):
            cands.append((0 if inside else abs(gap_below), rect))
            continue

        if rect.y1 <= ry0 + 12:
            dist = ry0 - rect.y1
            if dist <= 130:
                cands.append((dist + 5, rect))

    if not cands:
        return None
    cands.sort(key=lambda item: item[0])
    return cands[0][1]


def pick_dmb_image(
    ref_bbox: tuple[float, float, float, float], image_rects: list[fitz.Rect]
) -> fitz.Rect | None:
    rx0, ry0, rx1, ry1 = ref_bbox
    rcx = (rx0 + rx1) / 2

    cands: list[tuple[float, fitz.Rect]] = []
    for rect in image_rects:
        if rect.width < 40 or rect.height < 40:
            continue
        if rect.width > 200 or rect.height > 200:
            continue
        icx = (rect.x0 + rect.x1) / 2
        if abs(icx - rcx) > 140:
            continue

        inside = rect.y0 <= ry0 <= rect.y1
        gap_below = ry0 - rect.y1
        if inside or (-15 <= gap_below <= 35):
            cands.append((0 if inside else abs(gap_below), rect))
            continue

        if rect.y1 <= ry0 + 15:
            dist = ry0 - rect.y1
            if dist <= 220:
                cands.append((dist + 5, rect))

    if not cands:
        return None
    cands.sort(key=lambda item: item[0])
    return cands[0][1]


def build_pdf_index(doc: fitz.Document, modo: str) -> tuple[dict[str, tuple[int, tuple[float, float, float, float]]], list[list[fitz.Rect]]]:
    """Índice global ref_norm -> (página, bbox) + rects de imagen por página."""
    ref_index: dict[str, tuple[int, tuple[float, float, float, float]]] = {}
    page_images: list[list[fitz.Rect]] = []
    for pno in range(len(doc)):
        page = doc[pno]
        page_images.append(cache_page_images(page))
        for compact, bbox in index_page_refs(page).items():
            if compact not in ref_index:
                ref_index[compact] = (pno, bbox)
    return ref_index, page_images


DMB_ALIASES: dict[str, str] = {
    # Inventario Apex → código tal como aparece en LISTA DMB
    "96535081": "99535081",
    "545001138R": "545000138R",
    "54500A269R": "545004269R",
    "54500A268R": "545004268R",
    "2595128": "25995128",
}


def locate_in_index(
    referencia_norm: str,
    modo: str,
    ref_index: dict[str, tuple[int, tuple[float, float, float, float]]],
    page_images: list[list[fitz.Rect]],
) -> tuple[int, fitz.Rect] | None:
    picker = pick_ktc_image if modo == "KTC" else pick_dmb_image
    lookup = referencia_norm
    if modo == "DMB" and lookup in DMB_ALIASES:
        lookup = DMB_ALIASES[lookup]

    hit = ref_index.get(lookup)
    if not hit:
        for key, val in ref_index.items():
            if lookup in key or key in lookup:
                if len(key) >= 5:
                    hit = val
                    break
    if not hit:
        return None
    pno, bbox = hit
    rect = picker(bbox, page_images[pno])
    if not rect:
        return None
    return pno, rect


def extract_embedded_image(
    doc: fitz.Document, page: fitz.Page, rect: fitz.Rect
) -> Image.Image | None:
    """Preferir bitmap embebido (KTC ~600px) en lugar de recorte rasterizado pequeño."""
    best: tuple[float, int] | None = None
    for img in page.get_images():
        xref = img[0]
        for r in page.get_image_rects(xref):
            if r.width < 35 or r.height < 35 or r.width > 260:
                continue
            overlap_x = min(rect.x1, r.x1) - max(rect.x0, r.x0)
            overlap_y = min(rect.y1, r.y1) - max(rect.y0, r.y0)
            if overlap_x <= 0 or overlap_y <= 0:
                continue
            score = overlap_x * overlap_y
            if best is None or score > best[0]:
                best = (score, xref)

    if not best:
        return None

    info = doc.extract_image(best[1])
    im = Image.open(BytesIO(info["image"]))
    if im.mode == "RGBA":
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[3])
        return bg
    if im.mode == "P" and "transparency" in im.info:
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[3])
        return bg
    if im.mode != "RGB":
        im = im.convert("RGB")
    return im


def render_crop(doc: fitz.Document, page: fitz.Page, rect: fitz.Rect, padding: float = 6) -> Image.Image:
    embedded = extract_embedded_image(doc, page, rect)
    if embedded is not None:
        return embedded

    clip = fitz.Rect(
        max(0, rect.x0 - padding),
        max(0, rect.y0 - padding),
        min(page.rect.width, rect.x1 + padding),
        min(page.rect.height, rect.y1 + padding),
    )
    pix = page.get_pixmap(matrix=fitz.Matrix(4, 4), clip=clip, alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def guardar_webp(im: Image.Image, out_path: Path, *, max_lado: int = 720) -> None:
    img = im.copy()
    if max(img.size) > max_lado:
        img.thumbnail((max_lado, max_lado), Image.Resampling.LANCZOS)
    img.save(out_path, format="WEBP", quality=92, method=4)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ktc-pdf", type=Path, default=DEFAULT_KTC)
    parser.add_argument("--dmb-pdf", type=Path, default=DEFAULT_DMB)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not VIVO_JSON.exists() or not CATALOGO_JSON.exists():
        print("Faltan inventario-vivo.json o inventario-catalogo-completo.json", file=sys.stderr)
        return 1

    items = load_bodega_ktc_dmb()
    print(f"Stock bodega KTC+DMB: {len(items)} referencias")

    if not args.ktc_pdf.exists():
        print(f"No existe PDF KTC: {args.ktc_pdf}", file=sys.stderr)
        return 1
    if not args.dmb_pdf.exists():
        print(f"No existe PDF DMB: {args.dmb_pdf}", file=sys.stderr)
        return 1

    ktc_doc = fitz.open(args.ktc_pdf)
    dmb_doc = fitz.open(args.dmb_pdf)
    print("Indexando PDF KTC…")
    ktc_index, ktc_images = build_pdf_index(ktc_doc, "KTC")
    print("Indexando PDF DMB…")
    dmb_index, dmb_images = build_pdf_index(dmb_doc, "DMB")

    if not args.dry_run:
        OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest_imagenes: dict[str, str] = {}
    ok: list[str] = []
    fail: list[dict] = []

    for item in items:
        modo = item["proveedor"]
        if modo == "KTC":
            hit = locate_in_index(item["referencia_norm"], modo, ktc_index, ktc_images)
            doc = ktc_doc
        else:
            hit = locate_in_index(item["referencia_norm"], modo, dmb_index, dmb_images)
            doc = dmb_doc

        if not hit:
            fail.append(item)
            continue

        pno, rect = hit
        page = doc[pno]
        rel_url = f"/catalogo/{item['slug']}.webp"

        if args.dry_run:
            ok.append(item["referencia"])
            manifest_imagenes[item["slug"]] = rel_url
            continue

        img = render_crop(doc, page, rect)
        out_path = OUT_DIR / f"{item['slug']}.webp"
        guardar_webp(img, out_path)
        manifest_imagenes[item["slug"]] = rel_url
        ok.append(item["referencia"])

    manifest = {
        "meta": {
            "generado": date.today().isoformat(),
            "alcance": "stock_bodega_ktc_dmb",
            "total_objetivo": len(items),
            "extraidas": len(ok),
            "sin_imagen": len(fail),
            "ktc_pdf": str(args.ktc_pdf),
            "dmb_pdf": str(args.dmb_pdf),
        },
        "imagenes": manifest_imagenes,
    }

    if not args.dry_run:
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Extraídas: {len(ok)} / {len(items)}")
    if fail:
        print("Sin imagen en PDF:")
        for f in fail:
            print(f"  - {f['referencia']} ({f['proveedor']}) {f['nombre'][:50]}")

    ktc_doc.close()
    dmb_doc.close()
    return 0 if len(ok) >= len(items) * 0.85 else 1


if __name__ == "__main__":
    raise SystemExit(main())
