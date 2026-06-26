"""Solo lectura: tabla de márgenes del Excel actualizado. No modifica inventario."""

from pathlib import Path

import pandas as pd

BASE = Path(__file__).parent
VIVO = BASE / "Inventario_Apex_VIVO.xlsx"
ACT = BASE / "Inventario_Apex_VIVO_Actualizado.xlsx"


def tramo(fact: float) -> str:
    if fact < 30_000:
        return "< 30k"
    if fact <= 70_000:
        return "30k - 70k"
    return "> 70k"


def main() -> None:
    vivo = pd.read_excel(VIVO, sheet_name="Inventario")
    act = pd.read_excel(ACT, sheet_name="Inventario")
    col_pub = next(c for c in act.columns if "blico" in c)

    df = act[
        ["REFERENCIA", "Facturado / pieza", "STOCK (piezas)", "Precio Taller / pieza", col_pub]
    ].copy()
    df = df[df["Facturado / pieza"].notna() & (df["Facturado / pieza"] > 0)]

    df["costo_real"] = df["Facturado / pieza"] * 1.19 * 1.08
    df["ganancia_taller"] = df["Precio Taller / pieza"] - df["costo_real"]
    df["ganancia_publico"] = df[col_pub] - df["costo_real"]
    df["margen_taller_pct"] = (df["ganancia_taller"] / df["Precio Taller / pieza"] * 100).round(1)
    df["margen_publico_pct"] = (df["ganancia_publico"] / df[col_pub] * 100).round(1)
    df["tramo"] = df["Facturado / pieza"].apply(tramo)

    old_pub = next(c for c in vivo.columns if "blico" in c)
    old = vivo[["REFERENCIA", "Precio Taller / pieza", old_pub]].rename(
        columns={"Precio Taller / pieza": "taller_viejo", old_pub: "publico_viejo"}
    )
    df = df.merge(old, on="REFERENCIA", how="left")

    print("=== INTEGRIDAD: solo cambian precios, resto igual ===")
    print(f"Referencias (filas): vivo {len(vivo)} | actualizado {len(act)} | iguales {len(vivo)==len(act)}")
    print(
        f"Stock total piezas: vivo {int(vivo['STOCK (piezas)'].fillna(0).sum())} | "
        f"actualizado {int(act['STOCK (piezas)'].fillna(0).sum())}"
    )
    refs_vivo = set(vivo["REFERENCIA"].dropna().astype(str))
    refs_act = set(act["REFERENCIA"].dropna().astype(str))
    print(f"Mismas referencias: {refs_vivo == refs_act}")
    if refs_vivo != refs_act:
        print("  solo en vivo:", refs_vivo - refs_act)
        print("  solo en act:", refs_act - refs_vivo)

    print("\n=== MARGEN POR TRAMO (124 refs con facturado) ===")
    order = ["< 30k", "30k - 70k", "> 70k"]
    for t in order:
        sub = df[df["tramo"] == t]
        if sub.empty:
            continue
        print(f"\n{t} — {len(sub)} referencias")
        print(f"  Facturado mediano:      ${sub['Facturado / pieza'].median():,.0f}")
        print(f"  Costo real mediano:     ${sub['costo_real'].median():,.0f}")
        print(
            f"  Precio taller mediano:  ${sub['Precio Taller / pieza'].median():,.0f}  "
            f"(ganancia ${sub['ganancia_taller'].median():,.0f}/pza, "
            f"{sub['margen_taller_pct'].median():.0f}% sobre venta)"
        )
        print(
            f"  Precio público mediano: ${sub[col_pub].median():,.0f}  "
            f"(ganancia ${sub['ganancia_publico'].median():,.0f}/pza, "
            f"{sub['margen_publico_pct'].median():.0f}% sobre venta)"
        )

    print("\n=== vs PRECIOS VIEJOS (solo columnas I y J del Excel) ===")
    df["delta_taller"] = (df["Precio Taller / pieza"] - df["taller_viejo"]) / df["taller_viejo"] * 100
    df["delta_publico"] = (df[col_pub] - df["publico_viejo"]) / df["publico_viejo"] * 100
    print(f"Taller:  promedio {df['delta_taller'].mean():+.1f}%")
    print(f"Público: promedio {df['delta_publico'].mean():+.1f}%")

    print("\n=== 10 REFERENCIAS (verificables en el Excel) ===")
    muestra = [
        "KTR-4016",
        "KBJ-4013",
        "KSL-1005",
        "KTR-5129",
        "KRE-6211",
        "96535081",
        "KSA-HY016",
        "KBJ-4053",
        "KTR-6006",
        "KSL-5151",
    ]
    for ref in muestra:
        row = df[df["REFERENCIA"] == ref]
        if row.empty:
            print(f"  {ref}: sin facturado en hoja")
            continue
        r = row.iloc[0]
        print(
            f"  {ref} | fact ${r['Facturado / pieza']:,.0f} | "
            f"costo_real ${r['costo_real']:,.0f} | "
            f"taller ${r['Precio Taller / pieza']:,.0f} (+${r['ganancia_taller']:,.0f}) | "
            f"público ${r[col_pub]:,.0f} (+${r['ganancia_publico']:,.0f}) | "
            f"stock {int(r['STOCK (piezas)'])}"
        )


if __name__ == "__main__":
    main()
