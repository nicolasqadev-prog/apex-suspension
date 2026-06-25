import { metaMarcaProveedor, normalizarMarcaProveedor } from "./marcas-proveedor";
import type { DisponibilidadMostrador } from "./mostrador";
import { normalizeSupabaseUrl, supabaseFetch } from "./supabase-env";

export type { DisponibilidadMostrador };

export type ProductoMostrador = {
  slug: string;
  referencia: string;
  nombre: string;
  aplicacion: string;
  categoria: string;
  marcaVehiculo: string;
  marcaProducto: string;
  precioPublico: number;
  precioTallerRef?: number;
  stock: number;
  disponibilidad: DisponibilidadMostrador;
};

type ProductoRow = {
  slug: string;
  referencia: string;
  nombre: string;
  aplicacion: string | null;
  categoria: string | null;
  marca: string;
  marca_producto: string | null;
  precio_lista: number;
  precio_taller: number | null;
  stock_actual: number;
};

const MARCAS_VENDEMOS = new Set([
  "KTC",
  "STP",
  "WURTEX",
  "YOKOMITSU",
  "CTR",
  "MOBIS",
  "TOYAMA",
  "DMB",
]);

const FUERA_ALCANCE = [
  /\b(motor|culata|pist[oó]n|biela|correa\s+de\s+distribuci[oó]n|empaque\s+de\s+culata)\b/i,
  /\b(transmisi[oó]n|caja\s+de\s+cambios|clutch\s+completo|embrague\s+completo)\b/i,
  /\b(radio|pantalla\s+multimedia|bater[ií]a\s+de\s+carro|alternador|arranque)\b/i,
  /\b(llanta|neum[aá]tico|rin\s+\d{2})\b/i,
  /\b(aire\s+acondicionado|compresor\s+a\/?c)\b/i,
];

const BAJO_ENCARGO = [
  /\b(freno|frenos|frena|pastilla|pastillas|disco|discos|caliper|balata)\b/i,
  /\b(embrague|disco\s+de\s+embrague)\b/i,
];

const EN_ALCANCE = [
  /\b(amortiguador|rotula|r[oó]tula|terminal|bieleta|bujes?|tijera|brazo|suspensi[oó]n|direcci[oó]n)\b/i,
  /\b(kit\s+de\s+suspensi[oó]n|barra\s+estabilizadora)\b/i,
];

const REF_PATTERNS = [
  /\b[A-Z]{2,5}-[A-Z]{0,4}\d{2,6}[A-Z0-9]*\b/gi,
  /\b[A-Z]{2,5}[- ]?\d{3,6}[A-Z0-9]*\b/gi,
  /\b[A-Z0-9]{2,6}(?:-[A-Z0-9]{1,6}){1,4}\b/gi,
  /\b\d{5,12}[A-Z]?\b/gi,
];

function normalizarReferencia(ref: string): string {
  return ref.trim().toUpperCase().replace(/\s+/g, "-");
}

function variantesReferencia(ref: string): string[] {
  const base = normalizarReferencia(ref);
  const sinGuion = base.replace(/-/g, "");
  const conGuion = base.includes("-") ? base : base.replace(/^([A-Z]{2,5})(\d)/, "$1-$2");
  return [...new Set([base, sinGuion, conGuion].filter(Boolean))];
}

function getSupabaseEnv() {
  const rawUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl || !key) return null;
  return { url: normalizeSupabaseUrl(rawUrl), key };
}

function headers(env: { key: string }) {
  return { apikey: env.key, Authorization: `Bearer ${env.key}` };
}

function mapRow(r: ProductoRow): ProductoMostrador {
  const stock = Math.max(0, Math.floor(Number(r.stock_actual ?? 0)));
  const marcaProducto = normalizarMarcaProveedor(r.marca_producto);
  return {
    slug: r.slug,
    referencia: r.referencia,
    nombre: r.nombre,
    aplicacion: r.aplicacion ?? "",
    categoria: r.categoria ?? "",
    marcaVehiculo: r.marca,
    marcaProducto,
    precioPublico: Math.round(Number(r.precio_lista)),
    precioTallerRef: r.precio_taller != null ? Math.round(Number(r.precio_taller)) : undefined,
    stock,
    disponibilidad: stock > 0 ? "bodega" : "bajo_pedido",
  };
}

export type AlcanceMensaje = "en_alcance" | "bajo_encargo" | "fuera_alcance";

export function detectarAlcanceMensaje(texto: string): AlcanceMensaje {
  const t = texto.trim();
  if (!t) return "en_alcance";
  if (FUERA_ALCANCE.some((rx) => rx.test(t))) return "fuera_alcance";
  if (BAJO_ENCARGO.some((rx) => rx.test(t))) return "bajo_encargo";
  if (EN_ALCANCE.some((rx) => rx.test(t))) return "en_alcance";
  return "en_alcance";
}

export function extraerReferencias(texto: string): string[] {
  const found = new Set<string>();
  for (const rx of REF_PATTERNS) {
    for (const m of texto.match(rx) ?? []) {
      found.add(normalizarReferencia(m));
    }
  }
  // Tokens alfanuméricos sueltos (ej. HY07047, NS07493)
  for (const m of texto.match(/\b[A-Z]{1,3}\d{4,8}\b/gi) ?? []) {
    found.add(normalizarReferencia(m));
  }
  // "referencia 399", "ref KSA-NI015"
  for (const m of texto.matchAll(/\b(?:referencia|ref\.?)\s+([A-Z0-9][A-Z0-9./-]{1,24})\b/gi)) {
    found.add(normalizarReferencia(m[1]!));
  }

  const all = [...found];
  return all.filter((ref) => {
    // Evita "6401" suelto cuando ya está "KRE-6401"
    if (/^\d{4,}$/.test(ref)) {
      return !all.some((other) => other !== ref && other.replace(/\D/g, "").endsWith(ref));
    }
    return true;
  });
}

export type ContextoCotizacion = {
  textoCompleto: string;
  pieza?: string;
  vehiculo?: string;
  marcaVehiculo?: string;
  ano?: string;
  lado?: "izquierda" | "derecha";
  posicion?: "delantera" | "trasera";
  listoParaCotizar: boolean;
};

const PIEZAS_RX =
  /\b(?:bieletas?|barra\s+estabilizadora|r[oó]tulas?|terminal(?:es)?(?:\s+axial(?:es)?)?|amortiguador(?:es)?|bujes?|brazos?|tijeras?|links?|guardapolvos?|bases?\s+(?:de\s+)?amortiguador|columnas?|cremallera|punta(?:s)?\s+axial(?:es)?|homocin[eé]ticas?|kit\s+(?:de\s+)?suspensi[oó]n|espirales?|resortes?)\b/i;

function normalizarPiezaMencionada(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const p = raw.toLowerCase().replace("rótula", "rotula");
  if (p.startsWith("amortiguador")) return "amortiguador";
  if (p.startsWith("bieleta")) return "bieleta";
  if (p.startsWith("rotula") || p.startsWith("rótula")) return "rotula";
  if (p.startsWith("terminal")) return "terminal";
  if (p.startsWith("tijera")) return "tijera";
  if (p.startsWith("brazo")) return "brazo";
  if (p.startsWith("buje")) return "buje";
  if (p.startsWith("link")) return "link";
  if (p.startsWith("guardapolvo")) return "guardapolvo";
  if (p.startsWith("columna")) return "columna";
  if (p.startsWith("cremallera")) return "cremallera";
  if (p.startsWith("resorte") || p.startsWith("espiral")) return "resorte";
  return p;
}

const MARCAS_VEH_LISTA = [
  "chevrolet",
  "chevy",
  "renault",
  "kia",
  "hyundai",
  "nissan",
  "mazda",
  "toyota",
  "ford",
  "citroen",
  "citroën",
  "peugeot",
  "suzuki",
  "volkswagen",
  "vw",
  "bmw",
  "mercedes",
  "audi",
  "fiat",
  "honda",
  "mitsubishi",
  "chery",
  "great wall",
  "mg",
];

const MODELOS_VEH_LISTA = [
  "megane",
  "kwid",
  "xcite",
  "allegro",
  "aveo",
  "spark",
  "onix",
  "captiva",
  "logan",
  "sandero",
  "duster",
  "stepway",
  "picanto",
  "rio",
  "sportage",
  "tucson",
  "sail",
  "groove",
  "swift",
  "vitara",
  "sentra",
  "march",
  "versa",
  "c3",
  "c4",
  "berlingo",
  "picasso",
  "xsara",
  "206",
  "207",
  "208",
  "301",
  "308",
  "np300",
  "frontier",
  "navara",
  "elantra",
  "creta",
];

const MARCAS_VEH_RX = new RegExp(`\\b(${MARCAS_VEH_LISTA.join("|")})\\b`, "i");
const VEHICULOS_RX = new RegExp(`\\b(${MODELOS_VEH_LISTA.join("|")})\\b`, "i");

/** Modelo → marca cuando el cliente no la menciona ("los del Kwid"). */
const MARCA_POR_MODELO: Record<string, string> = {
  kwid: "renault",
  sandero: "renault",
  logan: "renault",
  duster: "renault",
  stepway: "renault",
  megane: "renault",
  fluence: "renault",
  clio: "renault",
  symbol: "renault",
  onix: "chevrolet",
  tracker: "chevrolet",
  cruze: "chevrolet",
  joy: "chevrolet",
  cerato: "kia",
  sorento: "kia",
  carnival: "kia",
  accent: "hyundai",
  i10: "hyundai",
  i20: "hyundai",
  santa: "hyundai",
  fe: "hyundai",
  np300: "nissan",
  frontier: "nissan",
  navara: "nissan",
  march: "nissan",
  versa: "nissan",
  sentra: "nissan",
  qashqai: "nissan",
  mazda2: "mazda",
  mazda3: "mazda",
  cx5: "mazda",
  corolla: "toyota",
  hilux: "toyota",
  prado: "toyota",
  fiesta: "ford",
  focus: "ford",
  ranger: "ford",
  escape: "ford",
  gol: "volkswagen",
  polo: "volkswagen",
  jetta: "volkswagen",
  rio: "kia",
  sportage: "kia",
  picanto: "kia",
  xcite: "kia",
  aveo: "chevrolet",
  spark: "chevrolet",
  captiva: "chevrolet",
  sail: "chevrolet",
  c3: "citroen",
  c4: "citroen",
};

function normalizarTextoBusqueda(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/chevy/g, "chevrolet")
    .replace(/citroën/g, "citroen");
}

function blobProducto(p: ProductoMostrador): string {
  return normalizarTextoBusqueda(
    `${p.nombre} ${p.aplicacion} ${p.categoria} ${p.marcaVehiculo}`,
  );
}

/** El producto aplica al vehículo que pidió el cliente (marca + modelo). */
export function productoAplicaAVehiculo(p: ProductoMostrador, ctx: ContextoCotizacion): boolean {
  if (!ctx.marcaVehiculo && !ctx.vehiculo) return true;

  const blob = blobProducto(p);
  const marcaProducto = normalizarTextoBusqueda(p.marcaVehiculo);

  if (ctx.marcaVehiculo) {
    const marca = normalizarTextoBusqueda(ctx.marcaVehiculo);
    const marcaOk = marcaProducto.includes(marca) || blob.includes(marca);
    if (!marcaOk) return false;
  }

  if (ctx.vehiculo) {
    const modelo = normalizarTextoBusqueda(ctx.vehiculo);
    if (blob.includes(modelo)) return true;
    const modeloRx = new RegExp(`\\b${modelo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (modeloRx.test(blob)) return true;
    // Megane II / Megane 2 en catálogo
    if (modelo === "megane" && /\bmegane\b/i.test(blob)) return true;
    return false;
  }

  return true;
}

/** El producto corresponde al tipo de pieza solicitada. */
export function productoAplicaAPieza(p: ProductoMostrador, ctx: ContextoCotizacion): boolean {
  if (!ctx.pieza) return true;
  const pieza = normalizarTextoBusqueda(ctx.pieza.replace("rótula", "rotula"));
  const blob = blobProducto(p);

  if (pieza === "bieleta" || pieza === "link") {
    return /\bbieleta\b|\bestab\b|\blink\b|\bbarra\s+estabilizadora\b/.test(blob);
  }
  if (pieza === "tijera") {
    return /\btijera\b/.test(blob);
  }
  if (pieza === "brazo") {
    return /\bbrazo\b|\btijera\b/.test(blob);
  }
  if (pieza === "amortiguador") {
    if (
      /\b(soporte|base|cazoleta|tope)\b/i.test(blob) &&
      /\bamortiguador\b/i.test(blob) &&
      !/\bamortiguador\s+(delantero|trasero|del|tras)\b/i.test(blob)
    ) {
      return false;
    }
    return /\bamortiguador\b|\bamort\b/.test(blob);
  }
  if (pieza === "guardapolvo") {
    return /\bguardapolvo\b/.test(blob);
  }
  if (pieza === "columna") {
    return /\bcolumna\b/.test(blob);
  }
  if (pieza === "cremallera") {
    return /\bcremallera\b/.test(blob);
  }
  if (pieza === "resorte" || pieza === "espiral") {
    return /\bresorte\b|\bespiral\b/.test(blob);
  }
  return blob.includes(pieza);
}

/**
 * Solo devuelve producto si hay coincidencia confiable pieza + vehículo.
 * Nunca adivina: mejor sin_match que cotizar mal.
 */
export function seleccionarProductoConfiable(
  productos: ProductoMostrador[],
  ctx: ContextoCotizacion,
): ProductoMostrador | null {
  if (!productos.length || !ctx.pieza) return null;
  if (!ctx.marcaVehiculo && !ctx.vehiculo) return null;

  const candidatos = productos.filter(
    (p) => productoAplicaAPieza(p, ctx) && productoAplicaAVehiculo(p, ctx),
  );
  if (!candidatos.length) return null;

  return priorizarProductosPorContexto(candidatos, ctx)[0] ?? null;
}

/** Todos los productos que calzan pieza + vehículo (sin elegir uno solo). */
export function listarCandidatosConfiables(
  productos: ProductoMostrador[],
  ctx: ContextoCotizacion,
): ProductoMostrador[] {
  if (!productos.length || !ctx.pieza) return [];
  if (!ctx.marcaVehiculo && !ctx.vehiculo) return [];

  const candidatos = productos.filter(
    (p) => productoAplicaAPieza(p, ctx) && productoAplicaAVehiculo(p, ctx),
  );
  return priorizarProductosPorContexto(candidatos, ctx);
}

async function recolectarProductosBusqueda(
  mensajeUsuario: string,
  ctx: ContextoCotizacion,
  piezaPrioritaria?: string,
): Promise<ProductoMostrador[]> {
  const refs = extraerReferencias(mensajeUsuario);
  if (
    refs.length === 0 &&
    !piezaPrioritaria?.trim() &&
    !ctx.pieza &&
    !ctx.vehiculo &&
    !ctx.marcaVehiculo
  ) {
    return [];
  }

  const scored = new Map<string, { p: ProductoMostrador; score: number }>();

  const addProducto = (p: ProductoMostrador, puntos: number) => {
    const entry = scored.get(p.slug) ?? { p, score: 0 };
    entry.score += puntos;
    scored.set(p.slug, entry);
  };

  for (const ref of refs) {
    const p = await buscarPorReferenciaExacta(ref);
    if (p) addProducto(p, 10);
  }

  const busquedas = [
    ...terminosBusquedaInteligente(mensajeUsuario),
    piezaPrioritaria?.trim(),
    ctx.pieza && ctx.marcaVehiculo && ctx.vehiculo
      ? `${ctx.pieza} ${ctx.marcaVehiculo} ${ctx.vehiculo}`
      : null,
    ctx.marcaVehiculo && ctx.vehiculo ? `${ctx.marcaVehiculo} ${ctx.vehiculo} ${ctx.pieza ?? ""}` : null,
    ctx.pieza && ctx.vehiculo ? `amortiguador ${ctx.vehiculo}` : null,
    ctx.pieza && ctx.vehiculo === "megane" ? "amortiguador megane renault" : null,
    ctx.pieza && ctx.vehiculo ? `amort ${ctx.vehiculo}` : null,
    ctx.pieza && ctx.vehiculo ? `${ctx.vehiculo} ${ctx.pieza}` : null,
    ctx.pieza,
    ctx.vehiculo,
    ctx.marcaVehiculo,
    ctx.ano,
  ].filter((q): q is string => Boolean(q && q.length >= 2));

  const unicas = [...new Set(busquedas.map((q) => q.toLowerCase()))].slice(0, 6);

  for (const q of unicas) {
    const res = await buscarProductosMostrador(q, 16);
    if (!res.ok) continue;
    for (const p of res.productos) {
      addProducto(p, q.includes(ctx.vehiculo ?? "") ? 5 : 2);
    }
  }

  return [...scored.values()]
    .sort((a, b) => b.score - a.score)
    .map((x) => x.p);
}

export async function resolverCandidatosMostrador(
  mensajeUsuario: string,
  piezaPrioritaria?: string,
): Promise<{ ctx: ContextoCotizacion; candidatos: ProductoMostrador[] }> {
  const ctx = extraerContextoCotizacion(mensajeUsuario);
  if (piezaPrioritaria?.trim()) {
    ctx.pieza = piezaPrioritaria.trim().toLowerCase();
    ctx.listoParaCotizar = Boolean(ctx.pieza && (ctx.vehiculo || ctx.marcaVehiculo));
  }

  const found = await recolectarProductosBusqueda(mensajeUsuario, ctx, piezaPrioritaria);
  const refs = extraerReferencias(mensajeUsuario);

  // Referencia exacta → cualquier ítem activo del catálogo (bodega o bajo pedido)
  if (refs.length > 0) {
    const porRef: ProductoMostrador[] = [];
    for (const ref of refs) {
      const p = await buscarPorReferenciaExacta(ref);
      if (p) porRef.push(p);
    }
    if (porRef.length > 0) {
      return { ctx, candidatos: priorizarProductosPorContexto(porRef, ctx) };
    }
  }

  return { ctx, candidatos: listarCandidatosConfiables(found, ctx) };
}

/** Junta todos los mensajes del cliente en un solo texto de búsqueda. */
export function acumularTextoUsuario(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  return history
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join(" ");
}

/** Variantes cortas para buscar en catálogo (evita perder contexto en mensajes sueltos). */
export function terminosBusquedaInteligente(texto: string): string[] {
  const t = texto.toLowerCase();
  const out = new Set<string>();
  const trimmed = texto.trim();
  if (trimmed) out.add(trimmed);

  const pieza = t.match(PIEZAS_RX)?.[0];
  const vehiculo = t.match(VEHICULOS_RX)?.[0];
  const marca = t.match(MARCAS_VEH_RX)?.[0];

  if (pieza && vehiculo) out.add(`${pieza} ${vehiculo}`);
  if (pieza && marca && vehiculo) out.add(`${pieza} ${marca} ${vehiculo}`);
  if (marca && vehiculo) out.add(`${marca} ${vehiculo}`);
  if (marca && pieza) out.add(`${marca} ${pieza}`);
  if (marca && vehiculo && pieza) out.add(`${marca} ${vehiculo} ${pieza}`);
  if (pieza) out.add(pieza);
  if (vehiculo) out.add(vehiculo);

  return [...out];
}

export function extraerContextoCotizacion(texto: string): ContextoCotizacion {
  const t = texto.toLowerCase();
  const pieza = normalizarPiezaMencionada(texto.match(PIEZAS_RX)?.[0]);
  let marcaVehiculo = texto.match(MARCAS_VEH_RX)?.[0]?.toLowerCase();
  if (marcaVehiculo === "chevy") marcaVehiculo = "chevrolet";
  if (marcaVehiculo === "citroën") marcaVehiculo = "citroen";

  // Megane 2 / Megane II antes del regex genérico de modelos
  let vehiculo: string | undefined;
  if (/\bmegane\s*(?:ii|2|dos)\b/i.test(texto) || /\bmegane\b/i.test(texto)) {
    vehiculo = "megane";
    marcaVehiculo = marcaVehiculo ?? "renault";
  }

  // Nissan NP300 / Frontier
  if (/\bnp\s*-?\s*300\b/i.test(texto)) {
    vehiculo = "np300";
    marcaVehiculo = marcaVehiculo ?? "nissan";
  }

  if (!vehiculo) {
    vehiculo = texto.match(VEHICULOS_RX)?.[0]?.toLowerCase();
  }

  // Kia Rio XCITE → modelo rio (no solo xcite)
  if (/\bkia\b/i.test(t) && /\brio\b/i.test(t)) {
    vehiculo = "rio";
    marcaVehiculo = marcaVehiculo ?? "kia";
  }

  if (!vehiculo && marcaVehiculo) {
    const marcaEsc = marcaVehiculo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const modeloDespuesMarca = texto.match(
      new RegExp(`\\b${marcaEsc}\\s+([a-z0-9][a-z0-9.-]{1,14})\\b`, "i"),
    );
    const candidato = modeloDespuesMarca?.[1]?.toLowerCase();
    if (candidato && !MARCAS_VEH_LISTA.includes(candidato)) {
      vehiculo = candidato;
    }
  }

  // "amortiguadores de un Duster", "bieleta del Onix" (sin marca explícita)
  if (!vehiculo && pieza) {
    const piezaEsc = pieza.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const despuesPieza = texto.match(
      new RegExp(
        `\\b${piezaEsc}s?\\b[\\s\\S]{0,40}?\\b(?:de|del|de la|para)\\s+(?:un|una|el|la)?\\s*([a-z0-9][a-z0-9.-]{2,14})\\b`,
        "i",
      ),
    );
    const candidato = despuesPieza?.[1]?.toLowerCase();
    const stop = new Set([
      "del",
      "tras",
      "delantero",
      "delanteros",
      "trasero",
      "traseros",
      "izquierdo",
      "derecho",
      "izquierda",
      "derecha",
      ...MARCAS_VEH_LISTA,
    ]);
    if (candidato && !stop.has(candidato)) {
      vehiculo = candidato;
      if (!marcaVehiculo && MARCA_POR_MODELO[candidato]) {
        marcaVehiculo = MARCA_POR_MODELO[candidato];
      }
    }
  }

  if (vehiculo && !marcaVehiculo && MARCA_POR_MODELO[vehiculo]) {
    marcaVehiculo = MARCA_POR_MODELO[vehiculo];
  }

  // "los del Kwid" sin marca — siempre Renault (aunque el texto diga "Kia Kwid" por error)
  if (/\bkwid\b/i.test(t)) {
    vehiculo = "kwid";
    marcaVehiculo = "renault";
  }

  const anoMatch = texto.match(/\b(19|20)\d{2}\b/);
  const ano = anoMatch?.[0];
  const lado = /\b(izquierd|izq|left)\b/i.test(t)
    ? ("izquierda" as const)
    : /\b(derech|der|right)\b/i.test(t)
      ? ("derecha" as const)
      : undefined;
  const tieneDel = /\bdelantera?s?\b|\bdelanteros?\b/i.test(t);
  const tieneTras = /\btrasera?s?\b|\btraseros?\b/i.test(t);
  const posicion =
    tieneDel && !tieneTras
      ? ("delantera" as const)
      : tieneTras && !tieneDel
        ? ("trasera" as const)
        : undefined;

  const listoParaCotizar = Boolean(pieza && (vehiculo || marcaVehiculo));

  return normalizarCtxVehiculo({
    textoCompleto: texto,
    pieza,
    vehiculo,
    marcaVehiculo,
    ano,
    lado,
    posicion,
    listoParaCotizar,
  });
}

/** Kwid es siempre Renault (nunca Kia), aunque el texto diga "Kia Kwid" o venga mal del historial. */
export function normalizarCtxVehiculo(ctx: ContextoCotizacion): ContextoCotizacion {
  const t = `${ctx.textoCompleto ?? ""} ${ctx.vehiculo ?? ""} ${ctx.marcaVehiculo ?? ""}`.toLowerCase();
  if (ctx.vehiculo === "kwid" || /\bkwid\b/i.test(t)) {
    ctx.vehiculo = "kwid";
    ctx.marcaVehiculo = "renault";
  }
  return ctx;
}

/** Contexto desde historial: la pieza más reciente manda (no la primera del chat). */
export function extraerContextoDesdeHistorial(
  history: Array<{ role: "user" | "assistant"; content: string }>,
): ContextoCotizacion {
  const userMsgs = history.filter((m) => m.role === "user").map((m) => m.content);
  const textoCompleto = userMsgs.join(" ");
  const ctx = extraerContextoCotizacion(textoCompleto);

  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const p = normalizarPiezaMencionada(userMsgs[i].match(PIEZAS_RX)?.[0]);
    if (p) {
      ctx.pieza = p;
      break;
    }
  }

  for (let i = userMsgs.length - 1; i >= 0; i--) {
    const parcial = extraerContextoCotizacion(userMsgs[i]);
    if (parcial.vehiculo || parcial.marcaVehiculo) {
      ctx.vehiculo = parcial.vehiculo ?? ctx.vehiculo;
      ctx.marcaVehiculo = parcial.marcaVehiculo ?? ctx.marcaVehiculo;
      if (ctx.vehiculo && MARCA_POR_MODELO[ctx.vehiculo]) {
        ctx.marcaVehiculo = MARCA_POR_MODELO[ctx.vehiculo];
      }
      break;
    }
  }

  ctx.textoCompleto = textoCompleto;
  ctx.listoParaCotizar = Boolean(ctx.pieza && (ctx.vehiculo || ctx.marcaVehiculo));
  return normalizarCtxVehiculo(ctx);
}

const NUM_PALABRA: Record<string, number> = {
  un: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
};

/** Cantidad pedida en un segmento ("los dos amortiguadores", "los 4", etc.). */
export function extraerCantidadSolicitada(texto: string): number {
  const t = texto.toLowerCase();
  const m = t.match(
    /\b(?:los|las|el|la|necesito|quiero)\s+(dos|tres|cuatro|cinco|seis|un|una|\d{1,2})\b/,
  );
  if (m) {
    const v = m[1];
    if (NUM_PALABRA[v] != null) return NUM_PALABRA[v];
    const n = Number(v);
    if (n >= 1 && n <= 99) return n;
  }
  return 1;
}

/**
 * Divide un mensaje con varias piezas/vehículos en consultas independientes.
 * Ej.: "los dos amortiguadores del kia rio ... las bieletas del aveo ..."
 */
function normalizarSegmentoConsulta(segmento: string): string {
  const s = segmento.trim().replace(/^\s*y\s+/i, "");
  if (/^los\s+del\s+/i.test(s) && !PIEZAS_RX.test(s)) {
    const resto = s.replace(/^los\s+del\s+/i, "").trim();
    if (/\bkwid\b/i.test(resto)) return `amortiguadores renault kwid ${resto}`;
    if (/\brio\b/i.test(resto) || /\bxcite\b/i.test(resto)) return `amortiguadores kia rio ${resto}`;
    if (/\bmegane\b/i.test(resto)) return `amortiguadores renault megane ${resto}`;
  }
  return s;
}

function quitarIntroCotizacion(texto: string): string {
  const m = texto.match(
    /(?:^|\n)\s*((?:los|las|el|la)\s+(?:dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|un|una|\d{1,2}\b|amortiguador|bieleta|rotula|r[oó]tula|terminal).+)/is,
  );
  return (m?.[1] ?? texto).trim();
}

const SPLIT_LISTA_PRINCIPAL_RX =
  /\s+(?=(?:(?:los|las)\s+(?:dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|un|una|\d{1,2}\b|amortiguador|bieleta|rotula|r[oó]tula|terminal|tijera|buje|brazo|link|barra))|(?:(?<!\bde\s)(?:la|el)\s+(?:dos|tres|cuatro|cinco|seis|un|una|\d{1,2}\b|amortiguador|bieleta|rotula|r[oó]tula|terminal|tijera|buje|brazo|link|barra)))/i;

const SPLIT_ROTULA_Y_TERMINAL_RX =
  /\s+y\s+(?=(?:la|el)\s+(?:rotula|r[oó]tula|terminal|bieleta|amortiguador))/i;

function partirListaPrincipal(texto: string): string[] {
  return texto
    .split(SPLIT_LISTA_PRINCIPAL_RX)
    .map(normalizarSegmentoConsulta)
    .filter((s) => s && PIEZAS_RX.test(s));
}

function expandirRotulaYTerminal(segmentos: string[]): string[] {
  return segmentos.flatMap((seg) => {
    if (!SPLIT_ROTULA_Y_TERMINAL_RX.test(seg)) return [seg];
    return seg
      .split(SPLIT_ROTULA_Y_TERMINAL_RX)
      .map(normalizarSegmentoConsulta)
      .filter((s) => s && PIEZAS_RX.test(s));
  });
}

export function segmentarConsultasPieza(texto: string): string[] {
  const t = quitarIntroCotizacion(texto.trim().replace(/\d+[\.\)]\s*/g, " "));
  if (!t) return [];

  // Seguimiento: "... amortiguadores ... y los del Kwid"
  if (/\s+y\s+(?:los|las)\s+/i.test(t)) {
    const porY = t
      .split(/\s+y\s+(?=(?:los|las)\s+)/i)
      .map(normalizarSegmentoConsulta)
      .filter((s) => s && PIEZAS_RX.test(s));
    if (porY.length > 1) {
      const expandido = expandirRotulaYTerminal(porY);
      return expandido.length > 1 ? expandido : porY;
    }
  }

  const partes = expandirRotulaYTerminal(partirListaPrincipal(t));

  return partes.length > 1 ? partes : PIEZAS_RX.test(t) ? [t] : [];
}

export function esConsultaMultiplePiezas(texto: string): boolean {
  if (segmentarConsultasPieza(texto).length > 1) return true;
  if (/\s+y\s+(?:los|las)\s+(?:del|de)\s+/i.test(texto) && PIEZAS_RX.test(texto)) return true;
  if (
    /\s+y\s+(?:la|el)\s+(?:rotula|r[oó]tula|terminal|bieleta|amortiguador)/i.test(texto) &&
    PIEZAS_RX.test(texto)
  ) {
    return true;
  }
  return false;
}

/** Prioriza productos que calzan con vehículo/pieza mencionados. */
export function priorizarProductosPorContexto(
  productos: ProductoMostrador[],
  ctx: ContextoCotizacion,
): ProductoMostrador[] {
  if (!productos.length) return productos;

  const score = (p: ProductoMostrador): number => {
    const blob = blobProducto(p);
    let s = 0;
    if (ctx.pieza && productoAplicaAPieza(p, ctx)) s += 8;
    if (ctx.vehiculo && blob.includes(normalizarTextoBusqueda(ctx.vehiculo))) s += 10;
    if (ctx.marcaVehiculo) {
      const marca = normalizarTextoBusqueda(ctx.marcaVehiculo);
      if (normalizarTextoBusqueda(p.marcaVehiculo).includes(marca) || blob.includes(marca)) s += 8;
    }
    if (ctx.lado === "izquierda" && /\b(izq|izquierd|left|lh)\b/i.test(blob)) s += 3;
    if (ctx.lado === "derecha" && /\b(der|derech|right|rh)\b/i.test(blob)) s += 3;
    if (ctx.posicion === "delantera" && /\bdelantera?\b/i.test(blob)) s += 2;
    if (ctx.posicion === "trasera" && /\btrasera?\b/i.test(blob)) s += 2;
    if (ctx.vehiculo === "megane" && /\bmegane\s*ii\b/i.test(blob)) s += 8;
    if (
      ctx.vehiculo === "megane" &&
      /\bmegane\s*(?:ii|2|dos)\b/i.test(normalizarTextoBusqueda(ctx.textoCompleto))
    ) {
      if (/\bmegane\s*ii\b/i.test(blob)) s += 12;
      if (/\bmegane\s*i\b/i.test(blob) && !/\bmegane\s*ii\b/i.test(blob)) s -= 8;
    }
    if (p.stock > 0) s += 1;
    return s;
  };

  return [...productos].sort((a, b) => score(b) - score(a));
}

export function extraerMarcasMencionadas(texto: string): string[] {
  const t = texto.toUpperCase();
  const marcas: string[] = [];
  for (const m of MARCAS_VENDEMOS) {
    if (t.includes(m)) marcas.push(m);
  }
  const competidoras = ["MOOG", "CORVEN", "NAKATA", "SABO", "MONROE", "BOSCH", "MANN", "FRAM"];
  for (const c of competidoras) {
    if (t.includes(c)) marcas.push(c);
  }
  return [...new Set(marcas)];
}

export function vendemosMarca(marca: string): boolean {
  const k = marca.trim().toUpperCase();
  return MARCAS_VENDEMOS.has(k);
}

export async function buscarProductosMostrador(
  query: string,
  limit = 8,
): Promise<{ ok: true; productos: ProductoMostrador[] } | { ok: false; reason: string }> {
  const env = getSupabaseEnv();
  if (!env) return { ok: false, reason: "Supabase no configurado" };

  const q = query.trim();
  if (!q) return { ok: true, productos: [] };

  const safe = q
    .replace(/[%_,.()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!safe) return { ok: true, productos: [] };

  const pattern = `%${safe}%`;
  const url = new URL(`${env.url}/rest/v1/productos`);
  url.searchParams.set(
    "select",
    "slug,referencia,nombre,aplicacion,categoria,marca,marca_producto,precio_lista,precio_taller,stock_actual",
  );
  url.searchParams.set("activo", "eq.true");
  url.searchParams.set("limit", String(Math.min(24, Math.max(1, limit))));
  url.searchParams.set(
    "or",
    `(referencia.ilike.${pattern},nombre.ilike.${pattern},aplicacion.ilike.${pattern},categoria.ilike.${pattern},marca.ilike.${pattern},marca_producto.ilike.${pattern})`,
  );
  url.searchParams.set("order", "stock_actual.desc,precio_lista.asc");

  const res = await supabaseFetch(url.toString(), { headers: headers(env) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: `Búsqueda falló (${res.status}) ${text}`.slice(0, 180) };
  }

  const rows = (await res.json()) as ProductoRow[];
  const productos = rows
    .map(mapRow)
    .filter((p) => p.marcaProducto.toUpperCase() !== "DISTRICAMIONES");
  return { ok: true, productos };
}

export async function buscarPorReferenciaExacta(
  referencia: string,
): Promise<ProductoMostrador | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  for (const ref of variantesReferencia(referencia)) {
    const url = new URL(`${env.url}/rest/v1/productos`);
    url.searchParams.set(
      "select",
      "slug,referencia,nombre,aplicacion,categoria,marca,marca_producto,precio_lista,precio_taller,stock_actual",
    );
    url.searchParams.set("activo", "eq.true");
    url.searchParams.set("referencia", `eq.${ref}`);
    url.searchParams.set("limit", "1");

    const res = await supabaseFetch(url.toString(), { headers: headers(env) });
    if (!res.ok) continue;
    const rows = (await res.json()) as ProductoRow[];
    const row = rows[0];
    if (!row) continue;
    const p = mapRow(row);
    if (p.marcaProducto.toUpperCase() === "DISTRICAMIONES") continue;
    return p;
  }

  // Búsqueda flexible (referencias OEM con formato distinto en el mensaje)
  const ref = normalizarReferencia(referencia);
  const url = new URL(`${env.url}/rest/v1/productos`);
  url.searchParams.set(
    "select",
    "slug,referencia,nombre,aplicacion,categoria,marca,marca_producto,precio_lista,precio_taller,stock_actual",
  );
  url.searchParams.set("activo", "eq.true");
  url.searchParams.set("referencia", `ilike.${ref}`);
  url.searchParams.set("limit", "3");

  const res = await supabaseFetch(url.toString(), { headers: headers(env) });
  if (!res.ok) return null;
  const rows = (await res.json()) as ProductoRow[];
  const exacta = rows.find(
    (r) => normalizarReferencia(r.referencia) === ref || variantesReferencia(r.referencia).includes(ref),
  );
  const row = exacta ?? (rows.length === 1 ? rows[0] : undefined);
  if (!row) return null;
  const p = mapRow(row);
  if (p.marcaProducto.toUpperCase() === "DISTRICAMIONES") return null;
  return p;
}

export async function resolverBusquedaMostrador(
  mensajeUsuario: string,
  piezaPrioritaria?: string,
): Promise<ProductoMostrador[]> {
  const { ctx, candidatos } = await resolverCandidatosMostrador(mensajeUsuario, piezaPrioritaria);
  const refs = extraerReferencias(mensajeUsuario);
  if (!candidatos.length) return [];

  const mejor = refs.length > 0 ? candidatos[0] : seleccionarProductoConfiable(candidatos, ctx);
  return mejor ? [mejor] : candidatos.length === 1 ? [candidatos[0]] : [];
}

export function formatoInventarioParaPrompt(productos: ProductoMostrador[]): string {
  if (!productos.length) return "[]";
  return JSON.stringify(
    productos.map((p) => ({
      referencia: p.referencia,
      nombre: p.nombre,
      marca: p.marcaProducto,
      precioPublicoCop: p.precioPublico,
      stock: p.stock,
      disponibilidad: p.disponibilidad,
      categoria: p.categoria,
      aplicacion: p.aplicacion.slice(0, 120),
    })),
    null,
    0,
  );
}

export function marcasQueVendemosTexto(): string {
  return [...MARCAS_VENDEMOS].map((k) => metaMarcaProveedor(k)?.nombre ?? k).join(", ");
}
