/**
 * Smoke test de producción (rutas críticas PWA).
 * Uso: SITE_URL=https://apex-suspension.com.co node scripts/qa-produccion-smoke.mjs
 */
const SITE_URL = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://apex-suspension.com.co")
  .replace(/\/$/, "");

const FAIL_MARKERS = [
  "algo salió mal",
  "algo salio mal",
  "error code: 1102",
  "worker exceeded",
  "exceeded cpu",
  "internal server error",
];

const REQUIRED_MARKERS = {
  "/": ["apex", "suspens"],
  "/catalogo": ["catálogo", "catalogo", "bodega"],
};

async function fetchText(path) {
  const url = `${SITE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "apex-qa-smoke/1.0", Accept: "text/html,application/json" },
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  return { url, status: res.status, text };
}

function assertNoFailureMarkers(label, text) {
  const low = text.toLowerCase();
  for (const m of FAIL_MARKERS) {
    if (low.includes(m)) {
      throw new Error(`${label}: respuesta contiene "${m}"`);
    }
  }
}

function assertRequiredMarkers(label, text, markers) {
  const low = text.toLowerCase();
  const ok = markers.some((m) => low.includes(m.toLowerCase()));
  if (!ok) throw new Error(`${label}: falta contenido esperado (${markers.join(" | ")})`);
}

let fail = 0;
console.log(`=== Smoke producción → ${SITE_URL} ===\n`);

try {
  const health = await fetchText("/api/health");
  if (health.status !== 200) throw new Error(`/api/health → HTTP ${health.status}`);
  const json = JSON.parse(health.text);
  if (!json.ok) throw new Error(`/api/health → ok=false ${JSON.stringify(json.checks)}`);
  console.log(`✓ /api/health → 200 ok=${json.ok}`);
} catch (e) {
  fail++;
  console.log(`✗ /api/health → ${e.message}`);
}

for (const path of Object.keys(REQUIRED_MARKERS)) {
  try {
    const { status, text, url } = await fetchText(path);
    if (status !== 200) throw new Error(`HTTP ${status}`);
    assertNoFailureMarkers(path, text);
    assertRequiredMarkers(path, text, REQUIRED_MARKERS[path]);
    console.log(`✓ ${path} → 200 sin errores`);
  } catch (e) {
    fail++;
    console.log(`✗ ${path} → ${e.message}`);
  }
}

console.log(`\n${fail === 0 ? "SMOKE OK" : `${fail} FALLO(S)`}`);
process.exit(fail > 0 ? 1 : 0);
