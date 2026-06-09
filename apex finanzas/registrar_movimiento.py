"""
Registra entrada/salida de stock y guarda historial en hoja Movimientos.

Ejemplos:
  py -3 registrar_movimiento.py KTR-4015 -1 --tipo Venta --motivo "Venta taller Bogotá"
  py -3 registrar_movimiento.py KSA-CH042 5 --tipo Entrada --motivo "Llegada pedido marzo"
"""

from __future__ import annotations

import argparse

from inventario_core import registrar_movimiento


def main() -> None:
    parser = argparse.ArgumentParser(description="Registrar movimiento de inventario")
    parser.add_argument("referencia", help="Código del producto")
    parser.add_argument("cantidad", type=int, help="Positivo=entrada, negativo=salida")
    parser.add_argument(
        "--tipo",
        default="Ajuste",
        choices=["Entrada", "Salida", "Venta", "Compra", "Ajuste"],
        help="Tipo de movimiento",
    )
    parser.add_argument("--motivo", default="Ajuste manual", help="Descripción del movimiento")
    parser.add_argument("--usuario", default="operador", help="Quién registra el movimiento")
    args = parser.parse_args()

    if args.cantidad == 0:
        raise SystemExit("La cantidad no puede ser 0.")

    tipo = args.tipo
    if args.cantidad > 0 and tipo == "Ajuste":
        tipo = "Entrada"
    if args.cantidad < 0 and tipo == "Ajuste":
        tipo = "Salida"

    mov = registrar_movimiento(
        referencia=args.referencia,
        cantidad=args.cantidad,
        tipo=tipo,
        motivo=args.motivo,
        usuario=args.usuario,
    )
    print(
        f"OK {mov['Referencia']}: {mov['Stock anterior']} -> {mov['Stock nuevo']} "
        f"({mov['Tipo']}: {mov['Cantidad']:+d})"
    )
    print("Ejecuta: py -3 inventario.py sincronizar  para actualizar la PWA")


if __name__ == "__main__":
    main()
