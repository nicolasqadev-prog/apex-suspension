import sharp from "sharp";

const navy = "#0f172a";
const W = 1200;
const H = 630;

function taglineSvg(text) {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="120">
      <style>
        .t { font: 600 44px system-ui,-apple-system,Segoe UI,Roboto,Arial; fill: #ffffff; letter-spacing: -0.01em; }
      </style>
      <text x="${W / 2}" y="70" text-anchor="middle" class="t">${escaped}</text>
    </svg>`,
  );
}

const out = "public/og-image.png";
const logo = "src/assets/apex-logo-full.png";

const canvas = sharp({
  create: { width: W, height: H, channels: 4, background: navy },
});

const logoBuf = await sharp(logo).resize(720, null, { fit: "inside" }).png().toBuffer();
const accent = await sharp({
  create: { width: 520, height: 6, channels: 4, background: { r: 244, g: 121, b: 32, alpha: 1 } },
})
  .png()
  .toBuffer();
const taglineBuf = await sharp(taglineSvg("El impulso exacto para no detenerte")).png().toBuffer();

await canvas
  .composite([
    { input: logoBuf, left: Math.round((W - 720) / 2), top: 150 },
    { input: accent, left: Math.round((W - 520) / 2), top: 420 },
    { input: taglineBuf, left: 0, top: 440 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(out);

console.log(`OK: ${out}`);
