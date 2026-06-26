import type { PiezaInventario } from "./inventario";

/** Texto de búsqueda sin tildes ni variantes comunes (chevy → chevrolet). */
export function normalizarTextoBusqueda(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\bchevy\b/g, "chevrolet")
    .replace(/\bcitroën\b/g, "citroen")
    .replace(/[._]+/g, " ");
}

export function normalizarReferenciaBusqueda(ref: string): string {
  return ref.trim().toUpperCase().replace(/\s+/g, "-");
}

/** KSA-RE028 → KSARE028 (para coincidir aunque el usuario no ponga guiones). */
export function referenciaCompacta(ref: string): string {
  return normalizarReferenciaBusqueda(ref).replace(/[^A-Z0-9]/g, "");
}

/** BT-50 / BT 50 → bt50 para que el usuario no tenga que poner el guión. */
export function modeloVehiculoCompacto(s: string): string {
  return normalizarTextoBusqueda(s).replace(/[^a-z0-9]/g, "");
}

export function tokensConsulta(q: string): string[] {
  const norm = normalizarTextoBusqueda(q);
  return norm
    .split(/[\s,;/+]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 || /^\d{3,}$/.test(t));
}

export function textoBusquedaPieza(p: PiezaInventario): string {
  const ref = p.referencia ?? "";
  const refNorm = normalizarReferenciaBusqueda(ref);
  const refCompact = referenciaCompacta(ref);
  return normalizarTextoBusqueda(
    [
      p.marca,
      p.marcaProducto,
      ref,
      refNorm,
      refCompact,
      p.nombre,
      p.aplicacion,
      p.categoria,
      p.categoriaGrupo?.trim() || p.categoria,
    ].join(" "),
  );
}

const GRUPOS_SINONIMOS: string[][] = [
  ["delantero", "delantera", "del", "front"],
  ["trasero", "trasera", "tras", "rear", "posterior"],
  ["izquierdo", "izquierda", "izq", "lh", "left"],
  ["derecho", "derecha", "der", "rh", "right"],
  ["amortiguador", "amort", "shock"],
  ["bieleta", "estab", "estabilizadora", "link"],
  ["rotula", "rotula", "rotulas"],
];

function variantesToken(tok: string): string[] {
  const t = tok.toLowerCase();
  for (const grupo of GRUPOS_SINONIMOS) {
    if (grupo.some((g) => t === g || t.startsWith(g) || g.startsWith(t))) {
      return grupo;
    }
  }
  return [t];
}

function tokenCoincideEnPieza(p: PiezaInventario, blob: string, tok: string): boolean {
  const blobModelo = modeloVehiculoCompacto(blob);
  for (const variant of variantesToken(tok)) {
    if (blob.includes(variant)) return true;
    const modeloCompact = modeloVehiculoCompacto(variant);
    if (modeloCompact.length >= 3 && blobModelo.includes(modeloCompact)) return true;
    const tokCompact = referenciaCompacta(variant);
    if (tokCompact.length >= 3) {
      const pRefCompact = referenciaCompacta(p.referencia);
      if (pRefCompact.includes(tokCompact)) return true;
    }
  }
  const tokModelo = modeloVehiculoCompacto(tok);
  if (tokModelo.length >= 3 && blobModelo.includes(tokModelo)) return true;
  const tokCompact = referenciaCompacta(tok);
  if (tokCompact.length >= 3) {
    const pRefCompact = referenciaCompacta(p.referencia);
    if (pRefCompact.includes(tokCompact) || tokCompact.includes(pRefCompact)) return true;
  }
  return false;
}

/** Coincide si la frase completa, la referencia flexible o todos los tokens aparecen. */
export function coincideBusquedaPieza(p: PiezaInventario, consulta: string): boolean {
  const q = consulta.trim();
  if (!q) return true;

  const blob = textoBusquedaPieza(p);
  const qNorm = normalizarTextoBusqueda(q);
  if (blob.includes(qNorm)) return true;

  const qRefCompact = referenciaCompacta(q);
  const pRefCompact = referenciaCompacta(p.referencia);
  if (qRefCompact.length >= 4 && pRefCompact.includes(qRefCompact)) return true;
  if (qRefCompact.length >= 6 && qRefCompact.includes(pRefCompact)) return true;

  const tokens = tokensConsulta(q);
  if (tokens.length === 0) return blob.includes(qNorm);
  if (tokens.length === 1) return tokenCoincideEnPieza(p, blob, tokens[0]!);

  return tokens.every((tok) => tokenCoincideEnPieza(p, blob, tok));
}

export function scoreRelevanciaBusqueda(p: PiezaInventario, consulta: string): number {
  const q = normalizarTextoBusqueda(consulta.trim());
  if (!q) return 5;

  const ref = normalizarTextoBusqueda(p.referencia);
  const refCompact = referenciaCompacta(p.referencia);
  const qCompact = referenciaCompacta(consulta);

  if (ref === q || refCompact === qCompact) return 0;
  if (ref.startsWith(q) || refCompact.startsWith(qCompact)) return 1;
  if (ref.includes(q) || refCompact.includes(qCompact)) return 2;

  const nom = normalizarTextoBusqueda(p.nombre);
  if (nom.startsWith(q)) return 3;
  if (nom.includes(q)) return 4;

  const blob = textoBusquedaPieza(p);
  if (coincideBusquedaPieza(p, consulta)) return 5;
  return blob.includes(q) ? 5 : 6;
}
