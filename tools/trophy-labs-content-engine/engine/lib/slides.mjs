import { brand } from './brand.mjs';
import { esc, pad2 } from './util.mjs';

const { canvas, color, type } = brand;
const INNER_WIDTH = canvas.width - canvas.safeMargin * 2;

export const PRIMITIVES = [
  'HOOK', 'BIG_STATEMENT', 'PROBLEM', 'SEQUENCE', 'COMPARISON',
  'CHECKLIST', 'FILM_FRAME', 'COURT_DIAGRAM', 'EVIDENCE_MOMENT', 'QUOTE', 'CTA',
];

/**
 * Picks a display size that fits the longest line inside the safe area.
 * Condensed uppercase averages ~0.52em of advance per character; the browser
 * QA pass measures the real result and fails the campaign if this is wrong.
 */
function fitDisplay(lines, { max = 168, min = type.minDisplayPx, heightBudget = 900 } = {}) {
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const byWidth = INNER_WIDTH / (0.52 * longest);
  const byHeight = heightBudget / (lines.length * 1.0);
  return Math.max(min, Math.min(max, Math.floor(Math.min(byWidth, byHeight))));
}

/** Body copy sizing: fewer words earn a larger size. */
function fitBody(texts, { max = 62, min = brand.type.minBodyPx } = {}) {
  const characters = texts.join(' ').length;
  const size = characters < 90 ? max : characters < 180 ? 54 : characters < 300 ? 46 : min;
  return Math.max(min, Math.min(max, size));
}

function layer(text, sizePx, fg, kind = 'body', bg = color.field) {
  return { text, sizePx, fg, bg, kind };
}

function chrome(slide, index, total) {
  const left = `${pad2(index)} / ${pad2(total)}`;
  const right = slide.primitive.replace(/_/g, ' ');
  return {
    top: `<div class="chrome-top"><span class="meta">${esc(left)}</span><span class="meta">${esc(right)}</span></div>`,
    bottom: `<div class="chrome-bottom"><span class="meta">${esc(brand.name)}</span><span class="meta signal">${esc(slide.mark || '')}</span></div>`,
    layers: [layer(left, 24, color.inkMeta, 'meta'), layer(right, 24, color.inkMeta, 'meta')],
  };
}

function eyebrow(text, layers) {
  if (!text) return '';
  layers.push(layer(text, 26, color.signal, 'meta'));
  return `<div class="eyebrow">${esc(text)}</div>`;
}

function displayBlock(lines, layers, options) {
  const size = fitDisplay(lines, options);
  for (const line of lines) layers.push(layer(line, size, color.ink, 'display'));
  const html = lines
    .map((line) => `<div class="display" data-fit="line" data-fit-kind="display" data-fit-group="display" style="font-size:${size}px">${esc(line)}</div>`)
    .join('');
  return html;
}

function copyBlock(lines, layers, options) {
  const size = fitBody(lines, options);
  for (const line of lines) layers.push(layer(line, size, color.ink, 'body'));
  return lines
    .map((line) => `<p class="copy" data-fit="block" data-fit-kind="body" style="font-size:${size}px;margin-bottom:${Math.round(size * 0.6)}px">${esc(line)}</p>`)
    .join('');
}

const LAYOUTS = {
  HOOK(slide, layers) {
    const body = displayBlock(slide.lines, layers, { max: 176, heightBudget: 860 });
    return `<div class="body-area bottom">${body}<div class="rule"></div></div>`;
  },

  BIG_STATEMENT(slide, layers) {
    const body = displayBlock(slide.lines, layers, { max: 150, heightBudget: 720 });
    const note = slide.note
      ? (layers.push(layer(slide.note, 44, color.inkSoft, 'body')),
        `<p class="copy soft" data-fit="block" data-fit-kind="body" style="font-size:44px;margin-top:48px">${esc(slide.note)}</p>`)
      : '';
    return `<div class="body-area">${eyebrow(slide.eyebrow, layers)}${body}${note}</div>`;
  },

  PROBLEM(slide, layers) {
    return `<div class="body-area">${eyebrow(slide.eyebrow || 'PROBLEM', layers)}${copyBlock(slide.lines, layers, {})}</div>`;
  },

  SEQUENCE(slide, layers) {
    const size = fitDisplay(slide.steps, { max: 108, heightBudget: 760 });
    const rows = slide.steps
      .map((step, position) => {
        layers.push(layer(step, size, color.ink, 'display'));
        return `<div class="step"><span class="step-num">${pad2(position + 1)}</span>` +
          `<span class="display" data-fit="line" data-fit-kind="display" data-fit-group="steps" style="font-size:${size}px">${esc(step)}</span></div>`;
      })
      .join('');
    return `<div class="body-area">${eyebrow(slide.eyebrow, layers)}<div class="steps">${rows}</div></div>`;
  },

  COMPARISON(slide, layers) {
    const size = fitBody([...slide.left.lines, ...slide.right.lines], { max: 48 });
    const column = (side) => {
      layers.push(layer(side.label, 26, color.signal, 'meta'));
      const lines = side.lines
        .map((line) => {
          layers.push(layer(line, size, color.ink, 'body'));
          return `<p class="copy" data-fit="block" data-fit-kind="body" style="font-size:${size}px">${esc(line)}</p>`;
        })
        .join('');
      return `<div class="col"><div class="eyebrow" style="margin-bottom:20px">${esc(side.label)}</div>${lines}</div>`;
    };
    return `<div class="body-area">${eyebrow(slide.eyebrow, layers)}` +
      `<div class="cols">${column(slide.left)}<div class="divider"></div>${column(slide.right)}</div></div>`;
  },

  CHECKLIST(slide, layers) {
    const size = fitBody(slide.items, { max: 46 });
    const rows = slide.items
      .map((item) => {
        layers.push(layer(item, size, color.ink, 'body'));
        return `<div class="check"><span class="tick"></span>` +
          `<span class="copy" data-fit="block" data-fit-kind="body" style="font-size:${size}px">${esc(item)}</span></div>`;
      })
      .join('');
    const intro = slide.lines?.length ? copyBlock(slide.lines, layers, { max: 46 }) : '';
    return `<div class="body-area">${eyebrow(slide.eyebrow, layers)}${intro}<div class="checks">${rows}</div></div>`;
  },

  FILM_FRAME(slide, layers) {
    const count = slide.frames?.count ?? 6;
    const active = slide.frames?.active ?? [2];
    const strip = Array.from({ length: count }, (_, position) =>
      `<div class="frame${active.includes(position) ? ' on' : ''}"></div>`).join('');
    return `<div class="body-area">${eyebrow(slide.eyebrow, layers)}` +
      `<div class="frames">${strip}</div>${copyBlock(slide.lines, layers, { max: 52 })}</div>`;
  },

  COURT_DIAGRAM(slide, layers) {
    const diagram = `<svg class="court" width="${INNER_WIDTH}" height="420" viewBox="0 0 888 420" fill="none">
<rect x="4" y="4" width="880" height="412" stroke="${color.line}" stroke-width="4"/>
<circle cx="444" cy="4" r="120" stroke="${color.line}" stroke-width="4"/>
<path d="M164 4 L164 190 A280 280 0 0 0 724 190 L724 4" stroke="${color.line}" stroke-width="4"/>
<rect x="364" y="4" width="160" height="230" stroke="${color.line}" stroke-width="4"/>
<circle cx="444" cy="70" r="14" fill="${color.ink}"/>
<circle cx="640" cy="330" r="18" fill="${color.signal}"/>
<path d="M640 330 L470 110" stroke="${color.signal}" stroke-width="4" stroke-dasharray="14 12"/>
</svg>`;
    return `<div class="body-area">${eyebrow(slide.eyebrow, layers)}${diagram}${copyBlock(slide.lines, layers, { max: 52 })}</div>`;
  },

  EVIDENCE_MOMENT(slide, layers) {
    const rows = (slide.rows || [])
      .map((row) => {
        layers.push(layer(row.label, 26, color.signal, 'meta'));
        layers.push(layer(row.value, 44, color.ink, 'body'));
        return `<div style="margin-bottom:44px"><div class="eyebrow" style="margin-bottom:16px">${esc(row.label)}</div>` +
          `<p class="copy" data-fit="block" data-fit-kind="body" style="font-size:44px">${esc(row.value)}</p></div>`;
      })
      .join('');
    return `<div class="body-area">${eyebrow(slide.eyebrow, layers)}${rows}</div>`;
  },

  QUOTE(slide, layers) {
    const size = fitDisplay([slide.quote], { max: 96, heightBudget: 700 });
    layers.push(layer(slide.quote, size, color.ink, 'display'));
    const attribution = slide.attribution
      ? (layers.push(layer(slide.attribution, 26, color.inkMeta, 'meta')),
        `<div class="meta" style="margin-top:48px">${esc(slide.attribution)}</div>`)
      : '';
    return `<div class="body-area"><div class="quote" data-fit="block" data-fit-kind="display" style="font-size:${size}px">${esc(slide.quote)}</div>${attribution}</div>`;
  },

  CTA(slide, layers) {
    layers.push(layer(`COMMENT ${slide.keyword}`, 96, color.signalInk, 'display', color.signal));
    const lead = slide.lines?.length ? copyBlock(slide.lines, layers, { max: 52 }) : '';
    const resourceLines = slide.resourceNameLines?.length ? slide.resourceNameLines : [slide.resourceName];
    const resourceSize = fitDisplay(resourceLines, { max: 88, min: 48, heightBudget: 260 });
    for (const line of resourceLines) layers.push(layer(line, resourceSize, color.ink, 'display'));
    const resourceHtml = resourceLines
      .map((line) => `<div class="display" data-fit="line" data-fit-kind="display" data-fit-group="resource" style="font-size:${resourceSize}px">${esc(line)}</div>`)
      .join('');
    return `<div class="body-area">${eyebrow(slide.eyebrow || 'HOW TO GET IT', layers)}${lead}` +
      `<div style="margin:24px 0 44px"><span class="keyword" data-fit="line" data-fit-kind="display">COMMENT ${esc(slide.keyword)}</span></div>` +
      `<p class="copy soft" data-fit="block" data-fit-kind="body" style="font-size:38px;margin-bottom:20px">${esc(slide.resourceLead || 'and we will send you the')}</p>` +
      resourceHtml + '</div>';
  },
};

/** Renders one slide to markup plus the text layers the QA gate inspects. */
export function renderSlide(slide, index, total) {
  const layout = LAYOUTS[slide.primitive];
  if (!layout) throw new Error(`Unknown slide primitive: ${slide.primitive}`);
  const layers = [];
  const frame = chrome(slide, index, total);
  const body = layout(slide, layers);
  const html = `<div class="slide" data-slide="${pad2(index)}" data-primitive="${esc(slide.primitive)}">` +
    `<div class="pad">${frame.top}${body}${frame.bottom}</div></div>`;
  return { html, textLayers: [...frame.layers, ...layers] };
}
