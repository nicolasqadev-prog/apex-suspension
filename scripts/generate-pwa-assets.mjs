import sharp from "sharp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const iconSvg = join(root, "public", "icon.svg");
const isotypeSvg = join(root, "src", "assets", "apex-isotype.svg");

async function renderSvgToPng(svgPath, size, outPath) {
  await sharp(svgPath).resize(size, size).png({ compressionLevel: 9 }).toFile(outPath);
}

// PNG transparente para el header (sin cuadrícula ni fondo blanco).
await sharp(isotypeSvg)
  .resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toFile(join(root, "src", "assets", "apex-icon.png"));

// Iconos de instalación PWA (fondo navy del SVG completo).
await renderSvgToPng(iconSvg, 192, join(root, "public", "icon-192.png"));
await renderSvgToPng(iconSvg, 512, join(root, "public", "icon-512.png"));
await renderSvgToPng(iconSvg, 180, join(root, "public", "apple-touch-icon.png"));

console.log("OK: src/assets/apex-icon.png + public/icon-*.png + apple-touch-icon.png");
