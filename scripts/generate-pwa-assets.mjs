import sharp from "sharp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { access } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const pwaIconSource = join(root, "src", "assets", "pwa-app-icon-source.png");
const iconSvg = join(root, "public", "icon.svg");
const isotypeSvg = join(root, "src", "assets", "apex-isotype.svg");

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Recorta márgenes blancos del PNG fuente para que el ícono PWA no quede miniatura. */
async function trimmedLogoSource() {
  return sharp(pwaIconSource).trim({ threshold: 12 }).png().toBuffer();
}

/** Ícono cuadrado para instalación PWA (fondo blanco, logo centrado con aire). */
async function renderAppIconFromSource(size, outPath, { maskable = false } = {}) {
  // ~82% en ícono normal (estilo apps como Telegram); ~68% en maskable (recorte circular Android).
  const fillRatio = maskable ? 0.68 : 0.82;
  const logoSide = Math.round(size * fillRatio);
  const trimmed = await trimmedLogoSource();

  const logo = await sharp(trimmed)
    .resize(logoSide, logoSide, { fit: "contain", background: WHITE })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: WHITE,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function renderSvgToPng(svgPath, size, outPath) {
  await sharp(svgPath).resize(size, size).png({ compressionLevel: 9 }).toFile(outPath);
}

if (await fileExists(pwaIconSource)) {
  await renderAppIconFromSource(192, join(root, "public", "icon-192.png"));
  await renderAppIconFromSource(512, join(root, "public", "icon-512.png"));
  await renderAppIconFromSource(180, join(root, "public", "apple-touch-icon.png"));
  await renderAppIconFromSource(512, join(root, "public", "icon-maskable-512.png"), {
    maskable: true,
  });

  const welcomeW = 1080;
  const welcomeH = 1920;
  const trimmed = await trimmedLogoSource();
  const welcomeLogo = await sharp(trimmed)
    .resize(Math.round(welcomeW * 0.62), Math.round(welcomeW * 0.62), {
      fit: "contain",
      background: WHITE,
    })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: welcomeW,
      height: welcomeH,
      channels: 4,
      background: WHITE,
    },
  })
    .composite([{ input: welcomeLogo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(join(root, "public", "pwa-welcome.png"));

  console.log("OK: íconos PWA + pwa-welcome.png desde src/assets/pwa-app-icon-source.png");
} else {
  console.warn("Aviso: falta src/assets/pwa-app-icon-source.png — usando icon.svg");
  await renderSvgToPng(iconSvg, 192, join(root, "public", "icon-192.png"));
  await renderSvgToPng(iconSvg, 512, join(root, "public", "icon-512.png"));
  await renderSvgToPng(iconSvg, 180, join(root, "public", "apple-touch-icon.png"));
}

if (await fileExists(isotypeSvg)) {
  await sharp(isotypeSvg)
    .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(join(root, "src", "assets", "apex-icon.png"));
  console.log("OK: src/assets/apex-icon.png (header)");
}
