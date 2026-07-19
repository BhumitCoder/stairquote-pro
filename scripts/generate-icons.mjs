// Run once: node scripts/generate-icons.mjs
// Generates PWA icon PNGs from public/logo.png using sharp (if available)
// or copies logo.png as a fallback.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const iconsDir = join(root, 'public', 'icons');

mkdirSync(iconsDir, { recursive: true });

const logo = join(root, 'public', 'logo.png');
const sizes = [192, 512];

// Try sharp; fall back to raw copy
try {
  const { default: sharp } = await import('sharp');
  for (const size of sizes) {
    await sharp(logo).resize(size, size, { fit: 'contain', background: '#ffffff' })
      .png().toFile(join(iconsDir, `icon-${size}.png`));
    // maskable: 20% padding (icon fills 60% of canvas)
    const inner = Math.round(size * 0.6);
    const pad = Math.round(size * 0.2);
    await sharp(logo).resize(inner, inner, { fit: 'contain', background: '#b91c1c' })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: '#b91c1c' })
      .png().toFile(join(iconsDir, `icon-maskable-${size}.png`));
    console.log(`✓ ${size}px icons generated`);
  }
} catch {
  // sharp not available — copy logo as placeholder
  for (const size of sizes) {
    copyFileSync(logo, join(iconsDir, `icon-${size}.png`));
    copyFileSync(logo, join(iconsDir, `icon-maskable-${size}.png`));
  }
  console.log('sharp not found — copied logo.png as placeholder icons');
}
