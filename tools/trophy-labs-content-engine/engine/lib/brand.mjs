import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJson } from './util.mjs';

export const brand = readJson(join(ROOT, 'brand', 'brand.json'));

const FACES = [
  { file: 'trophy-display.woff2', family: 'Trophy Display', weight: 700 },
  { file: 'trophy-body.woff2', family: 'Trophy Body', weight: 400 },
  { file: 'trophy-mono.woff2', family: 'Trophy Mono', weight: 400 },
];

/**
 * Embeds any brand font present in brand/fonts as a base64 @font-face.
 * Absent faces fall back to the system stack rather than failing the render,
 * and the caller records which faces were embedded on the campaign receipt.
 */
export function fontFaces() {
  const css = [];
  const embedded = [];
  for (const face of FACES) {
    const path = join(ROOT, 'brand', 'fonts', face.file);
    if (!existsSync(path)) continue;
    const data = readFileSync(path).toString('base64');
    css.push(
      `@font-face{font-family:'${face.family}';font-weight:${face.weight};font-display:block;` +
        `src:url(data:font/woff2;base64,${data}) format('woff2');}`,
    );
    embedded.push(face.family);
  }
  return { css: css.join('\n'), embedded };
}
