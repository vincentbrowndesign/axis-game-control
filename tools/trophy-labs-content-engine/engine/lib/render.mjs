import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { brand } from './brand.mjs';
import { document_ } from './page.mjs';
import { renderSlide } from './slides.mjs';
import { pad2 } from './util.mjs';

const CHROMIUM_CANDIDATES = [
  process.env.TROPHY_LABS_CHROMIUM,
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export function findChromium() {
  return CHROMIUM_CANDIDATES.find((path) => existsSync(path)) ?? null;
}

const BASE_FLAGS = [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  '--force-color-profile=srgb',
];

function run(binary, args) {
  return execFileSync(binary, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

/** Writes one standalone HTML file per slide and returns their paths plus text layers. */
export function writeSlideHtml(spec, outDir) {
  const total = spec.slides.length;
  return spec.slides.map((slide, position) => {
    const index = position + 1;
    const { html, textLayers } = renderSlide(slide, index, total);
    const base = `${pad2(index)}-${slide.name}`;
    const path = join(outDir, 'build', 'slides-html', `${base}.html`);
    write(path, document_(`${spec.campaignId} ${base}`, html));
    return { index, base, slide, path, textLayers };
  });
}

/**
 * Measures real laid-out geometry in Chromium and returns it to Node through
 * --dump-dom. This is what catches copy that overflows the safe area; the
 * Node-side size heuristic only guesses.
 */
export function measureSlides(binary, prepared, outDir) {
  const total = prepared.length;
  const body = prepared
    .map(({ slide, index }) => renderSlide(slide, index, total).html)
    .join('');
  const script = `
const report = [...document.querySelectorAll('.slide')].map((node) => {
  const pad = node.querySelector('.pad');
  const area = node.querySelector('.body-area');
  const padRect = pad.getBoundingClientRect();
  const textRect = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rect = range.getBoundingClientRect();
    return rect.width > 0 ? rect : el.getBoundingClientRect();
  };
  const rects = [...node.querySelectorAll('.pad *')].map((el) =>
    el.children.length === 0 && el.textContent.trim() ? textRect(el) : el.getBoundingClientRect());
  const escapes = rects.filter((r) => r.width > 0 && (
    r.left < padRect.left - 1 || r.right > padRect.right + 1 ||
    r.top < padRect.top - 1 || r.bottom > padRect.bottom + 1)).length;
  const fitted = [...node.querySelectorAll('[data-fit]')].map((el) => Number(el.dataset.finalSize));
  return {
    slide: node.dataset.slide,
    primitive: node.dataset.primitive,
    contentHeight: Math.round(area.scrollHeight),
    areaHeight: Math.round(area.clientHeight),
    overflowY: area.scrollHeight - area.clientHeight,
    escapes,
    minFontPx: fitted.length ? Math.min(...fitted) : null,
    maxFontPx: fitted.length ? Math.max(...fitted) : null,
  };
});
const sink = document.createElement('div');
sink.id = 'trophy-labs-measure';
sink.textContent = 'MEASURE:' + JSON.stringify(report);
document.body.appendChild(sink);`;
  const path = join(outDir, 'build', 'measure.html');
  write(path, document_(`measure ${prepared.length} slides`, body, script));
  const dom = run(binary, [
    ...BASE_FLAGS,
    `--window-size=${brand.canvas.width},${brand.canvas.height}`,
    '--virtual-time-budget=4000',
    '--dump-dom',
    `file://${path}`,
  ]);
  const match = dom.match(/MEASURE:(\[.*?\])<\/div>/s);
  if (!match) throw new Error('Chromium returned no measurement payload');
  return JSON.parse(match[1]);
}

/** Screenshots each prepared slide at exactly 1080x1350. */
export function renderSlidePngs(binary, prepared, outDir) {
  return prepared.map(({ base, path }) => {
    const png = join(outDir, 'slides', `${base}.png`);
    mkdirSync(dirname(png), { recursive: true });
    run(binary, [
      ...BASE_FLAGS,
      `--window-size=${brand.canvas.width},${brand.canvas.height}`,
      '--virtual-time-budget=3000',
      `--screenshot=${png}`,
      `file://${path}`,
    ]);
    return png;
  });
}

/** Prints an HTML file to PDF (used for the downloadable resource). */
export function renderPdf(binary, htmlPath, pdfPath) {
  mkdirSync(dirname(pdfPath), { recursive: true });
  run(binary, [
    ...BASE_FLAGS,
    '--no-pdf-header-footer',
    '--virtual-time-budget=3000',
    `--print-to-pdf=${pdfPath}`,
    `file://${htmlPath}`,
  ]);
  return pdfPath;
}

/**
 * Measures the resource page at Chromium's narrowest layout width (it clamps
 * the window to 500px) to catch horizontal overflow and copy that has shrunk
 * below a readable size on a phone.
 */
export function measureResource(binary, htmlPath, outDir) {
  const probe = join(outDir, 'build', 'resource-probe.html');
  const source = readFileSync(htmlPath, 'utf8');
  mkdirSync(dirname(probe), { recursive: true });
  const script = `<script>window.addEventListener('load',()=>{
  const root = document.documentElement;
  const sizes = [...document.querySelectorAll('li,p,.loop-step,h1,footer span')]
    .map((el) => parseFloat(getComputedStyle(el).fontSize)).filter(Boolean);
  const sink = document.createElement('div');
  sink.textContent = 'RESOURCE:' + JSON.stringify({
    layoutWidth: root.clientWidth,
    scrollWidth: root.scrollWidth,
    hOverflow: root.scrollWidth - root.clientWidth,
    minFontPx: sizes.length ? Math.min(...sizes) : null,
  });
  document.body.appendChild(sink);
});</script>`;
  writeFileSync(probe, source.replace('</body>', `${script}</body>`));
  const dom = run(binary, [
    ...BASE_FLAGS,
    '--window-size=500,1600',
    '--virtual-time-budget=3000',
    '--dump-dom',
    `file://${probe}`,
  ]);
  const match = dom.match(/RESOURCE:(\{.*?\})</s);
  if (!match) throw new Error('Chromium returned no resource measurement');
  return JSON.parse(match[1]);
}
