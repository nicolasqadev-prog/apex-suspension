import sharp from "sharp";

/**
 * Key out black background into transparency.
 * Designed for logos exported over pure black (#000).
 */
async function matteBlackToAlpha(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = Buffer.from(data);

  // Thresholds tuned for #000 background with antialiased edges.
  const t0 = 8; // below -> fully transparent
  const t1 = 40; // above -> fully opaque
  const span = t1 - t0;

  for (let i = 0; i < out.length; i += 4) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];

    const m = Math.max(r, g, b);
    if (m <= t0) {
      out[i + 3] = 0;
      continue;
    }

    if (m >= t1) {
      out[i + 3] = 255;
      continue;
    }

    // Edge pixels: estimate alpha from distance to black and "un-premultiply" colors.
    const a = (m - t0) / span; // 0..1
    const alpha = Math.round(a * 255);
    out[i + 3] = alpha;

    const invA = 1 / a;
    out[i] = Math.min(255, Math.round(r * invA));
    out[i + 1] = Math.min(255, Math.round(g * invA));
    out[i + 2] = Math.min(255, Math.round(b * invA));
  }

  await sharp(out, { raw: info })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
}

const input =
  process.argv[2] ??
  "C:\\\\Users\\\\Usuario\\\\.cursor\\\\projects\\\\c-Users-Usuario-OneDrive-Escritorio-proyectos-apex-suspension\\\\assets\\\\c__Users_Usuario_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_logo-apex-suspension-14d05b11-8f23-406f-80bf-df455cc0463c.png";
const output =
  process.argv[3] ??
  "C:\\\\Users\\\\Usuario\\\\OneDrive\\\\Escritorio\\\\proyectos\\\\apex-suspension\\\\src\\\\assets\\\\apex-logo-full.png";

await matteBlackToAlpha(input, output);
console.log(`OK: wrote ${output}`);

