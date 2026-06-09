"""
Sube el catálogo completo a Supabase en lotes pequeños (paso a paso).

  py -3 sync_catalogo_paso.py           # un lote (300 piezas)
  py -3 sync_catalogo_paso.py --estado  # ver progreso sin subir
  py -3 sync_catalogo_paso.py --reset   # empezar desde 0

Repite hasta que completado=true.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).parent
ROOT = BASE.parent
JSON_PATH = ROOT / "data" / "inventario-catalogo-completo.json"
ESTADO_PATH = BASE / ".sync_catalogo_estado.json"
LOTE = 300


def cargar_estado() -> dict:
    if ESTADO_PATH.exists():
        return json.loads(ESTADO_PATH.read_text(encoding="utf-8"))
    return {"siguiente_desde": 0, "total": 0, "completado": False}


def guardar_estado(estado: dict) -> None:
    ESTADO_PATH.write_text(json.dumps(estado, ensure_ascii=False, indent=2), encoding="utf-8")


def total_piezas() -> int:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    return len(data.get("piezas", []))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--estado", action="store_true", help="Solo mostrar progreso")
    parser.add_argument("--reset", action="store_true", help="Reiniciar desde 0")
    parser.add_argument("--lote", type=int, default=LOTE, help=f"Piezas por paso (default {LOTE})")
    args = parser.parse_args()

    if not JSON_PATH.exists():
        raise SystemExit(f"No existe {JSON_PATH}. Ejecuta: py -3 generar_catalogo_completo.py")

    total = total_piezas()
    estado = cargar_estado()

    if args.reset:
        estado = {"siguiente_desde": 0, "total": total, "completado": False}
        guardar_estado(estado)
        print("Estado reiniciado.")
        return

    if args.estado:
        print(f"Total catálogo: {total}")
        print(f"Siguiente desde: {estado.get('siguiente_desde', 0)}")
        print(f"Completado: {estado.get('completado', False)}")
        if estado.get("ultimo_lote"):
            print("Ultimo lote:", json.dumps(estado["ultimo_lote"], ensure_ascii=False))
        return

    if estado.get("completado"):
        print("Catálogo ya subido por completo. Usa --reset para repetir.")
        return

    desde = int(estado.get("siguiente_desde", 0))
    if desde >= total:
        estado["completado"] = True
        guardar_estado(estado)
        print("Nada pendiente. Completado.")
        return

    rel_json = "data/inventario-catalogo-completo.json"
    cmd = [
        "npm",
        "run",
        "sync:inventory",
        "--",
        rel_json,
        f"--desde={desde}",
        f"--cantidad={args.lote}",
    ]
    print(f"Paso: subiendo {desde} .. {min(desde + args.lote, total) - 1} de {total}")
    proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, shell=True)

    if proc.returncode != 0:
        print(proc.stderr or proc.stdout)
        raise SystemExit(f"Error en sync (codigo {proc.returncode})")

    combined = (proc.stdout or "") + "\n" + (proc.stderr or "")
    resultado = None
    start = combined.rfind('{\n  "archivo"')
    if start >= 0:
        depth = 0
        for i in range(start, len(combined)):
            if combined[i] == "{":
                depth += 1
            elif combined[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        resultado = json.loads(combined[start : i + 1])
                    except json.JSONDecodeError:
                        pass
                    break
    if not resultado:
        print(proc.stdout)
        print(proc.stderr)
        raise SystemExit("Sin respuesta JSON del sync")
    estado["total"] = total
    estado["ultimo_lote"] = resultado
    estado["siguiente_desde"] = resultado.get("siguiente_desde", total)
    estado["completado"] = bool(resultado.get("completado"))
    guardar_estado(estado)

    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    if estado["completado"]:
        print("LISTO: catálogo completo en Supabase.")
    else:
        print(f"Siguiente paso: py -3 sync_catalogo_paso.py  (quedan {total - estado['siguiente_desde']})")


if __name__ == "__main__":
    main()
