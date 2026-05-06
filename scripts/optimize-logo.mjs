import sharp from "sharp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const input = join(root, "src", "assets", "apex-logo.png");
const outWebp = join(root, "src", "assets", "apex-logo.webp");

const meta = await sharp(input).metadata();
const width = meta.width ? Math.min(meta.width, 640) : 640;

await sharp(input)
  .resize(width, null, { withoutEnlargement: true, fit: "inside" })
  .webp({ quality: 88, effort: 4 })
  .toFile(outWebp);

console.log("Wrote", outWebp);
