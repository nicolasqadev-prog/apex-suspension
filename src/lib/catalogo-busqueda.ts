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

const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "para",
  "con",
  "y",
  "en",
  "un",
  "una",
  "o",
  "al",
  "por",
]);

/** Modelo → marca cuando el catálogo solo trae el modelo (Optra, Kwid…). */
const MARCA_POR_MODELO: Record<string, string> = {
  kwid: "renault",
  sandero: "renault",
  logan: "renault",
  duster: "renault",
  stepway: "renault",
  megane: "renault",
  "megane ii": "renault",
  "megane i": "renault",
  fluence: "renault",
  clio: "renault",
  symbol: "renault",
  onix: "chevrolet",
  tracker: "chevrolet",
  cruze: "chevrolet",
  joy: "chevrolet",
  optra: "chevrolet",
  allegro: "chevrolet",
  aveo: "chevrolet",
  spark: "chevrolet",
  captiva: "chevrolet",
  sail: "chevrolet",
  luv: "chevrolet",
  dmax: "chevrolet",
  "d-max": "chevrolet",
  cerato: "kia",
  sorento: "kia",
  carnival: "kia",
  rio: "kia",
  sportage: "kia",
  picanto: "kia",
  xcite: "kia",
  accent: "hyundai",
  i10: "hyundai",
  i20: "hyundai",
  santa: "hyundai",
  np300: "nissan",
  frontier: "nissan",
  navara: "nissan",
  march: "nissan",
  versa: "nissan",
  sentra: "nissan",
  bt50: "mazda",
  "bt-50": "mazda",
  ranger: "ford",
  b2600: "mazda",
  mazda2: "mazda",
  mazda3: "mazda",
  cx5: "mazda",
  corolla: "toyota",
  hilux: "toyota",
  prado: "toyota",
  fiesta: "ford",
  focus: "ford",
  escape: "ford",
  gol: "volkswagen",
  polo: "volkswagen",
  jetta: "volkswagen",
  c3: "citroen",
  c4: "citroen",
};

const MARCAS_VEHICULO = new Set(
  [
    "chevrolet",
    "renault",
    "kia",
    "hyundai",
    "nissan",
    "mazda",
    "toyota",
    "ford",
    "volkswagen",
    "citroen",
    "honda",
    "suzuki",
    "bmw",
    "jeep",
    "fiat",
    "isuzu",
    "mercedes",
  ].map(normalizarTextoBusqueda),
);

const TIPOS_PIEZA = new Set([
  "bieleta",
  "bieletas",
  "amortiguador",
  "amortiguadores",
  "amort",
  "rotula",
  "rotulas",
  "terminal",
  "terminales",
  "bujes",
  "buje",
  "link",
  "estab",
  "estabilizadora",
  "barra",
  "tijera",
  "tijeras",
  "reten",
  "retenes",
  "soporte",
  "brazo",
  "base",
  "kit",
  "guardapolvo",
  "meseta",
  "mesetas",
  "cremallera",
  "taza",
]);

/** Frases de taller → términos del catálogo (antes de tokenizar). */
export function preprocesarConsultaColoquial(q: string): string {
  let s = normalizarTextoBusqueda(q);

  const reemplazos: Array<[RegExp, string]> = [
    [/\bmonoshock\b/g, "amortiguador"],
    [/\bmonoshocks\b/g, "amortiguador"],
    [/\bshocks?\b/g, "amortiguador"],
    [/\bamortiguadores\b/g, "amortiguador"],
    [/\bamort\b/g, "amortiguador"],
    [/\bbarras?\s+estab\b/g, "bieleta"],
    [/\bbarra\s+estabilizadora\b/g, "bieleta"],
    [/\bestabilizadora\b/g, "bieleta"],
    [/\bestab\b/g, "bieleta"],
    [/\bterminal(?:es)?\s+(?:de\s+)?direccion\b/g, "terminal"],
    [/\bterminal\s+axial\b/g, "terminal"],
    [/\brotula(?:s)?\s+(?:de\s+)?direccion\b/g, "rotula"],
    [/\brotulas?\b/g, "rotula"],
    [/\bbase(?:s)?\s+amortiguador\b/g, "base amortiguador"],
    [/\btaza\s+amortiguador\b/g, "base amortiguador"],
    [/\bguardapolvo(?:s)?\b/g, "guardapolvo"],
    [/\bbujes?\b/g, "buje"],
    [/\bhorquilla(?:s)?\b/g, "tijera"],
    [/\btijera(?:s)?\b/g, "tijera"],
    [/\bmeseta(?:s)?\b/g, "meseta"],
    [/\bcremallera\b/g, "cremallera"],
    [/\bcremaillera\b/g, "cremallera"],
    [/\bchevy\b/g, "chevrolet"],
    [/\bgm\b/g, "chevrolet"],
    [/\bvw\b/g, "volkswagen"],
    [/\bchevrolet\s+aveo\b/g, "aveo"],
    [/\brenault\s+kwid\b/g, "kwid"],
    [/\bmegane\s+2\b/g, "megane ii"],
    [/\bmegane\s+3\b/g, "megane iii"],
    [/\bmegane\s+1\b/g, "megane i"],
    [/\bclio\s+2\b/g, "clio ii"],
    [/\bclio\s+3\b/g, "clio iii"],
    [/\bsandero\s+stepway\b/g, "stepway"],
    [/\brio\s+xcite\b/g, "rio xcite"],
    [/\bluv\s+d-?max\b/g, "dmax"],
    [/\bd\s*-?\s*max\b/g, "dmax"],
    [/\bbt\s*-?\s*50\b/g, "bt50"],
    [/\bbt\s+50\b/g, "bt50"],
    [/\bnp\s*300\b/g, "np300"],
    [/\bsanta\s+fe\b/g, "santa fe"],
    [/\b4x4\b/g, ""],
    [/\b4x2\b/g, ""],
  ];

  for (const [rx, rep] of reemplazos) {
    s = s.replace(rx, rep);
  }

  return s.replace(/\s+/g, " ").trim();
}

export function tokensConsulta(q: string): string[] {
  const norm = preprocesarConsultaColoquial(q);
  return norm
    .split(/[\s,;/+]+/)
    .map((t) => t.trim())
    .filter(
      (t) =>
        t.length >= 2 ||
        /^\d{3,}$/.test(t) ||
        /^i{1,3}$/.test(t) ||
        t === "iv",
    );
}

/** Cilindraje, año u otras pistas que no suelen estar en el catálogo — no bloquean resultados. */
export function tokenEsOpcional(tok: string): boolean {
  const t = tok.toLowerCase();
  if (STOPWORDS.has(t)) return true;
  if (/^(19|20)\d{2}$/.test(t)) return true;
  if (/^\d{1,2}[.,]\d$/.test(t)) return true;
  if (/^\d\.\d$/.test(t)) return true;
  if (/^v6$|^v8$|^tdi$|^dci$|^turb(o)?$/i.test(t)) return true;
  return false;
}

function tokensRequeridos(tokens: string[]): string[] {
  const req = tokens.filter((t) => !tokenEsOpcional(t));
  return req.length > 0 ? req : tokens;
}

function marcasInferidasEnTexto(texto: string): string[] {
  const norm = normalizarTextoBusqueda(texto);
  const marcas = new Set<string>();
  for (const [modelo, marca] of Object.entries(MARCA_POR_MODELO)) {
    const modeloNorm = normalizarTextoBusqueda(modelo);
    if (norm.includes(modeloNorm) || modeloVehiculoCompacto(norm).includes(modeloVehiculoCompacto(modelo))) {
      marcas.add(marca);
    }
  }
  return [...marcas];
}

export function textoBusquedaPieza(p: PiezaInventario): string {
  const ref = p.referencia ?? "";
  const refNorm = normalizarReferenciaBusqueda(ref);
  const refCompact = referenciaCompacta(ref);
  const base = [
    p.marca,
    p.marcaProducto,
    ref,
    refNorm,
    refCompact,
    p.nombre,
    p.aplicacion,
    p.categoria,
    p.categoriaGrupo?.trim() || p.categoria,
  ].join(" ");
  const inferidas = marcasInferidasEnTexto(base).join(" ");
  return normalizarTextoBusqueda(`${base} ${inferidas}`);
}

const GRUPOS_SINONIMOS: string[][] = [
  ["delantero", "delantera", "del", "front"],
  ["trasero", "trasera", "tras", "rear", "posterior"],
  ["izquierdo", "izquierda", "izq", "lh", "left"],
  ["derecho", "derecha", "der", "rh", "right"],
  ["amortiguador", "amort", "shock", "amortiguadores"],
  ["bieleta", "bieletas", "estab", "estabilizadora", "link", "barra"],
  ["rotula", "rotulas", "rótula"],
  ["terminal", "terminales", "axial", "direccion", "dirección"],
  ["guardapolvo", "fuelle", "boot", "goma"],
  ["buje", "bujes", "silentblock", "silent block"],
  ["meseta", "mesetas", "brazo"],
  ["cremallera", "cremaillera", "rack"],
  ["base", "taza", "cazoleta"],
  ["chevrolet", "chevy", "gm"],
  ["renault", "rno"],
  ["ii", "2"],
  ["iii", "3"],
  ["i", "1"],
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

function tokenMarcaCoincide(blob: string, tok: string): boolean {
  const t = normalizarTextoBusqueda(tok);
  if (blob.includes(t)) return true;
  if (MARCA_POR_MODELO[t] && blob.includes(MARCA_POR_MODELO[t]!)) return true;
  for (const [modelo, marca] of Object.entries(MARCA_POR_MODELO)) {
    if (marca === t && (blob.includes(modelo) || blob.includes(normalizarTextoBusqueda(modelo)))) {
      return true;
    }
  }
  const inferidas = marcasInferidasEnTexto(blob);
  return inferidas.includes(t);
}

function tokenCoincideEnPieza(p: PiezaInventario, blob: string, tok: string): boolean {
  if (MARCAS_VEHICULO.has(normalizarTextoBusqueda(tok))) {
    return tokenMarcaCoincide(blob, tok);
  }

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

function coincidenciaPorTokens(p: PiezaInventario, blob: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  if (tokens.length === 1) return tokenCoincideEnPieza(p, blob, tokens[0]!);

  const requeridos = tokensRequeridos(tokens);
  if (requeridos.every((tok) => tokenCoincideEnPieza(p, blob, tok))) return true;

  const matched = tokens.filter((tok) => tokenCoincideEnPieza(p, blob, tok));
  if (matched.length >= Math.max(2, Math.ceil(tokens.length * 0.75))) return true;

  const hasPieza = tokens.some(
    (t) => TIPOS_PIEZA.has(normalizarTextoBusqueda(t)) && tokenCoincideEnPieza(p, blob, t),
  );
  const hasVeh = tokens.some((t) => {
    const tn = normalizarTextoBusqueda(t);
    if (MARCAS_VEHICULO.has(tn)) return tokenMarcaCoincide(blob, t);
    if (MARCA_POR_MODELO[tn]) return tokenCoincideEnPieza(p, blob, t);
    return tokenCoincideEnPieza(p, blob, t) && !TIPOS_PIEZA.has(tn);
  });
  return hasPieza && hasVeh;
}

/** Coincide si la frase completa, la referencia flexible o los tokens clave aparecen. */
export function coincideBusquedaPieza(p: PiezaInventario, consulta: string): boolean {
  const q = consulta.trim();
  if (!q) return true;

  const blob = textoBusquedaPieza(p);
  const qNorm = preprocesarConsultaColoquial(q);
  if (blob.includes(qNorm)) return true;

  const qRefCompact = referenciaCompacta(q);
  const pRefCompact = referenciaCompacta(p.referencia);
  if (qRefCompact.length >= 4 && pRefCompact.includes(qRefCompact)) return true;
  if (qRefCompact.length >= 6 && qRefCompact.includes(pRefCompact)) return true;

  const tokens = tokensConsulta(q);
  if (tokens.length === 0) return blob.includes(qNorm);

  return coincidenciaPorTokens(p, blob, tokens);
}

export function scoreRelevanciaBusqueda(p: PiezaInventario, consulta: string): number {
  const q = preprocesarConsultaColoquial(consulta.trim());
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

  const tokens = tokensConsulta(consulta);
  const blob = textoBusquedaPieza(p);
  const matched = tokens.filter((t) => tokenCoincideEnPieza(p, blob, t)).length;
  if (matched === tokens.length && tokens.length > 0) return 5;
  if (coincideBusquedaPieza(p, consulta)) return 5 + Math.max(0, tokens.length - matched);
  return blob.includes(q) ? 5 : 6;
}
