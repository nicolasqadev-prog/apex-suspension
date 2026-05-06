import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const src = "src/assets/apex-logo-source.png";

await mkdir("public", { recursive: true });

// Header mark (clean crop; no full wordmark to avoid background artifacts).
await sharp(src)
  .extract({ left: 0, top: 90, width: 420, height: 620 })
  .trim({ threshold: 10 })
  .resize(128, 128, { fit: "inside", withoutEnlargement: true })
  .webp({ quality: 92, effort: 4 })
  .toFile("src/assets/apex-mark.webp");

// Generate PWA icons: rounded white badge on brand background.
async function roundedRectMask(size, r) {
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="white"/>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function makeIcon(size, filename) {
  const badgeSize = Math.round(size * 0.78);
  const pad = Math.round((size - badgeSize) / 2);
  const r = Math.round(badgeSize * 0.22);
  const badgeBase = await roundedRectMask(badgeSize, r);

  const { data: logoForBadge, info: logoInfo } = await sharp(src)
    .trim({ threshold: 10 })
    .resize(badgeSize - Math.round(size * 0.14), badgeSize - Math.round(size * 0.14), {
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  const top = Math.max(0, Math.round((badgeSize - logoInfo.height) / 2));
  const left = Math.max(0, Math.round((badgeSize - logoInfo.width) / 2));

  const badge = await sharp(badgeBase)
    .composite([{ input: logoForBadge, top, left }])
    .png()
    .toBuffer();

  await sharp({ create: { width: size, height: size, channels: 4, background: "#0f172a" } })
    .composite([{ input: badge, top: pad, left: pad }])
    .png({ compressionLevel: 9 })
    .toFile(`public/${filename}`);
}

await makeIcon(192, "icon-192.png");
await makeIcon(512, "icon-512.png");
await makeIcon(180, "apple-touch-icon.png");

console.log("Generated brand assets (wordmark + PWA icons).");
