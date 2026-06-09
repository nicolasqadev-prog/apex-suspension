/**
 * Auditoría QA post-saneamiento: coherencia PWA ↔ Supabase ↔ JSON.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

let url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "") ?? "";
url = url.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const headers = { apikey: key, Authorization: `Bearer ${key}` };

const catalogo = JSON.parse(
  readFileSync(join(root, "data/inventario-catalogo-completo.json"), "utf8"),
);
const ejemplo = JSON.parse(readFileSync(join(root, "data/inventario.ejemplo.json"), "utf8"));
const vivo = JSON.parse(readFileSync(join(root, "data/inventario-vivo.json"), "utf8"));

const ejSlugs = ejemplo.piezas.map((p) => p.slug);
const catByRef = new Map(catalogo.piezas.map((p) => [p.referencia, p]));
const DESCUENTO = 16.67;

async function rest(path, extraHeaders = {}) {
  const res = await fetch(`${url}/rest/v1${path}`, {
    headers: { ...headers, ...extraHeaders },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { ok: res.ok, status: res.status, json, range: res.headers.get("content-range") };
}

const totalActivos = await rest("/productos?activo=eq.true&select=id&limit=1", {
  Prefer: "count=exact",
});
const totalTodos = await rest("/productos?select=id&limit=1", { Prefer: "count=exact" });
const stockActivo = await rest(
  "/productos?stock_actual=gt.0&activo=eq.true&select=referencia,stock_actual&limit=1",
  { Prefer: "count=exact" },
);
const ktr = await rest(
  "/productos?referencia=eq.KTR-4015&activo=eq.true&select=referencia,precio_lista,stock_actual,marca",
);
const demosActivos = await rest(
  `/productos?slug=in.(${ejSlugs.map((s) => `"${s}"`).join(",")})&activo=eq.true&select=slug`,
);
const demosInactivos = await rest(
  `/productos?slug=in.(${ejSlugs.map((s) => `"${s}"`).join(",")})&activo=eq.false&select=slug`,
);
const columnaPublicado = await rest(
  "/talleres_fidelizados?select=publicado&limit=1",
);
const tieneColumnaPublicado = columnaPublicado.ok;
const talleres = await rest(
  "/talleres_fidelizados?activo=eq.true&select=whatsapp,nombre_taller,descuento_porcentaje,contra_entrega_habilitada,activo",
);
const talleresPublicados = tieneColumnaPublicado
  ? await rest(
      "/talleres_fidelizados?activo=eq.true&publicado=eq.true&select=whatsapp,nombre_taller&limit=1",
      { Prefer: "count=exact" },
    )
  : { ok: false, range: null };
const tallerDemo = await rest(
  `/talleres_fidelizados?whatsapp=eq.573001234567&select=whatsapp,nombre_taller,activo,descuento_porcentaje,contra_entrega_habilitada${tieneColumnaPublicado ? ",publicado" : ""}`,
);
const pedidosTotal = await rest("/pedidos?select=id&limit=1", { Prefer: "count=exact" });
const ksaHy016 = await rest(
  "/productos?referencia=eq.KSA-HY016&activo=eq.true&select=referencia,precio_lista,precio_taller,stock_actual",
);

const catKtr = catByRef.get("KTR-4015");
const ktrDb = ktr.ok && Array.isArray(ktr.json) ? ktr.json[0] : null;
const precioTallerEsperado = catKtr ? Math.round(catKtr.precioLista * (1 - DESCUENTO / 100)) : null;

const talleresList = talleres.ok && Array.isArray(talleres.json) ? talleres.json : [];
const talleresOk = talleresList.every(
  (t) => Math.abs(Number(t.descuento_porcentaje) - DESCUENTO) < 0.02,
);
const demoRow = tallerDemo.ok && Array.isArray(tallerDemo.json) ? tallerDemo.json[0] : null;
const ksaRow = ksaHy016.ok && Array.isArray(ksaHy016.json) ? ksaHy016.json[0] : null;
const ksaPrecioTaller =
  ksaRow?.precio_lista != null
    ? Math.round(Number(ksaRow.precio_lista) * (1 - DESCUENTO / 100))
    : null;

const parseCount = (range) => {
  if (!range) return null;
  const m = range.match(/\/(\d+)$/);
  return m ? Number(m[1]) : null;
};

const checks = {
  supabaseConectado: !!url && !!key,
  productosActivos: parseCount(totalActivos.range),
  productosTotales: parseCount(totalTodos.range),
  stockActivoBodega: parseCount(stockActivo.range),
  stockEsperadoVivo: vivo.piezas.filter((p) => p.stock > 0).length,
  demoVisiblesEnCatalogo: demosActivos.ok ? (demosActivos.json?.length ?? 0) : -1,
  demoDesactivados: demosInactivos.ok ? (demosInactivos.json?.length ?? 0) : -1,
  ktrPrecioCoincide: ktrDb?.precio_lista === catKtr?.precioLista,
  ktrStockCoincide: ktrDb?.stock_actual === catKtr?.stock,
  precioTaller16_67: precioTallerEsperado,
  talleresDescuentoOk: talleresOk,
  talleres: talleresList,
  talleresPublicados: parseCount(talleresPublicados.range),
  pedidosEnBd: parseCount(pedidosTotal.range),
  migracionPublicadoTaller: tieneColumnaPublicado,
  tallerDemoListo: Boolean(
    demoRow?.activo && (tieneColumnaPublicado ? demoRow?.publicado !== false : true),
  ),
  tallerDemo: demoRow,
  ejemploPrecioTaller: ksaRow
    ? {
        referencia: ksaRow.referencia,
        precioPublico: ksaRow.precio_lista,
        precioTallerEsperado: ksaPrecioTaller,
        precioTallerBd: ksaRow.precio_taller,
        stock: ksaRow.stock_actual,
      }
    : null,
};

const fallos = [];
if (checks.demoVisiblesEnCatalogo > 0) fallos.push("Demo activo en catálogo");
if (checks.demoDesactivados !== ejSlugs.length) fallos.push("Demo no desactivado por completo");
if (checks.stockActivoBodega !== checks.stockEsperadoVivo)
  fallos.push(`Stock activo ${checks.stockActivoBodega} != vivo ${checks.stockEsperadoVivo}`);
if (!checks.ktrPrecioCoincide) fallos.push("KTR-4015 precio no coincide JSON/BD");
if (!checks.ktrStockCoincide) fallos.push("KTR-4015 stock no coincide JSON/BD");
if (!checks.talleresDescuentoOk && talleresList.length) fallos.push("Taller sin 16.67%");
if (checks.productosActivos < 5900) fallos.push("Pocos productos activos en BD");
if (!checks.migracionPublicadoTaller)
  fallos.push("Migración pendiente: columna talleres_fidelizados.publicado (bloquea login taller)");
if (!checks.tallerDemoListo) fallos.push("Taller demo 573001234567 no activo");
if (checks.migracionPublicadoTaller && (checks.talleresPublicados ?? 0) < 1)
  fallos.push("Sin talleres publicados para /taller/acceso");

const veredicto =
  fallos.length === 0 ? "APROBADO" : fallos.length <= 2 ? "APROBADO_CON_OBSERVACIONES" : "REVISAR";

console.log(
  JSON.stringify(
    {
      veredicto,
      fallos,
      checks,
      flujo: {
        runtime: "Supabase productos activos → loadCatalogo()",
        catalogoJson: catalogo.piezas.length,
        fallback: "inventario.ejemplo.json (10 SKUs, solo sin Supabase)",
        syncCatalogo: "inventario-catalogo-completo.json — NO pisa stock existente",
        syncStock: "inventario-vivo.json — ajusta stock",
      },
      flujoTaller: {
        rutasPwa: ["/taller/acceso", "/catalogo", "/taller/pedido", "/repuesto/$slug"],
        login: "TallerSessionProvider → iniciarSesionTaller → talleres_fidelizados",
        catalogoTaller: "obtenerCatalogoTaller → loadCatalogoTaller → precio −16,67%",
        carrito: "localStorage apex.taller.carrito + TallerBanner",
        pedido: "enviarPedidoTaller → pedidos + pedido_lineas + enlace WhatsApp",
        tallerPrueba: {
          whatsapp: "573001234567",
          alternativoCorto: "3001234567",
          nombre: "Taller Demo Apex",
        },
        guiaValidacionUi: [
          "1. Ir a /taller/acceso e ingresar 3001234567",
          "2. Debe redirigir a /catalogo con banner verde Modo taller",
          "3. Precios en verde (taller); botón Agregar al pedido en fichas",
          "4. TallerBanner → Pedido: revisar carrito en /taller/pedido",
          "5. Enviar pedido: crea registro en BD y abre WhatsApp con resumen",
        ],
      },
    },
    null,
    2,
  ),
);
