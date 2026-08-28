import { brand, fontFaces } from './brand.mjs';
import { esc } from './util.mjs';

const { canvas, color, type } = brand;

/**
 * The single controlled Trophy Labs carousel stylesheet.
 * Every primitive composes from these classes. Primitives must not ship
 * their own colors, radii, or spacing - the QA gate reads colors from the
 * token set, so anything inline would go unchecked.
 */
export function stylesheet() {
  const { css } = fontFaces();
  return `${css}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:${color.field}}
.slide{position:relative;width:${canvas.width}px;height:${canvas.height}px;background:${color.field};
  color:${color.ink};overflow:hidden;font-family:${type.bodyStack};-webkit-font-smoothing:antialiased}
.pad{position:absolute;inset:${canvas.safeMargin}px;display:flex;flex-direction:column}
.body-area{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0}
.body-area.bottom{justify-content:flex-end}
.body-area.top{justify-content:flex-start}
.display{font-family:${type.displayStack};font-weight:700;text-transform:uppercase;
  letter-spacing:-0.02em;line-height:0.92;font-stretch:condensed}
.copy{font-family:${type.bodyStack};font-weight:400;line-height:1.28;color:${color.ink}}
.soft{color:${color.inkSoft}}
.meta{font-family:${type.metaStack};font-size:24px;letter-spacing:0.16em;text-transform:uppercase;color:${color.inkMeta}}
.eyebrow{font-family:${type.metaStack};font-size:26px;letter-spacing:0.22em;text-transform:uppercase;
  color:${color.signal};margin-bottom:48px}
.rule{height:8px;width:180px;background:${color.signal};margin-top:56px}
.chrome-top{display:flex;justify-content:space-between;align-items:baseline}
.chrome-bottom{display:flex;justify-content:space-between;align-items:baseline;margin-top:44px}
[data-fit="line"]{white-space:nowrap}
.signal{color:${color.signal}}
.steps{display:flex;flex-direction:column;gap:34px}
.step{display:flex;align-items:baseline;gap:32px}
.step-num{font-family:${type.metaStack};font-size:30px;color:${color.signal};width:56px;flex:none}
.checks{display:flex;flex-direction:column;gap:30px}
.check{display:flex;align-items:flex-start;gap:28px}
.tick{width:26px;height:26px;flex:none;margin-top:12px;border:5px solid ${color.signal}}
.cols{display:flex;gap:56px}
.col{flex:1;display:flex;flex-direction:column;gap:24px}
.divider{width:4px;background:${color.line}}
.frames{display:flex;gap:12px;margin-bottom:56px}
.frame{flex:1;aspect-ratio:3/4;border:4px solid ${color.line};background:${color.fieldRaised}}
.frame.on{border-color:${color.signal}}
.keyword{display:inline-block;background:${color.signal};color:${color.signalInk};
  font-family:${type.displayStack};font-weight:700;text-transform:uppercase;letter-spacing:0.02em;
  padding:22px 40px;font-size:96px;line-height:1}
.quote{font-family:${type.displayStack};font-weight:700;line-height:1.0;letter-spacing:-0.01em}
.court{margin-bottom:56px}`;
}

/** Wraps slide markup in a standalone offline document. */
export function document_(title, bodyHtml, extraScript = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title><style>${stylesheet()}</style></head>
<body>${bodyHtml}<script>${fitScript()}</script>${extraScript ? `<script>${extraScript}</script>` : ''}</body></html>`;
}

/**
 * Fits copy to the safe area in the browser, where the real font metrics live.
 * The Node-side sizing is only a starting point: without the brand condensed
 * faces installed the fallback stack is much wider, and guessed sizes wrap.
 *
 * Elements marked data-fit="line" must never wrap. Elements marked
 * data-fit="block" may wrap but must not push the slide past its safe area.
 * Nothing shrinks below the brand minimum - copy that still does not fit is
 * left overflowing so the quality gate fails it instead of shipping 20px text.
 */
export function fitScript() {
  return `(() => {
  const MIN = ${JSON.stringify({ display: type.minDisplayPx, body: type.minBodyPx, meta: type.minMetaPx })};
  const sizeOf = (el) => parseFloat(getComputedStyle(el).fontSize);
  const textWidth = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getBoundingClientRect().width;
  };
  const minFor = (el) => MIN[el.dataset.fitKind] ?? MIN.body;

  for (const slide of document.querySelectorAll('.slide')) {
    const pad = slide.querySelector('.pad');
    const area = slide.querySelector('.body-area');

    // Pass 1: no marked line may run past the safe area.
    // Measured with a Range because a nowrap block keeps its box width while
    // its text overflows - the element rect would report everything as fitting.
    for (const el of slide.querySelectorAll('[data-fit="line"]')) {
      const floor = minFor(el);
      let size = sizeOf(el);
      for (let guard = 0; guard < 400; guard += 1) {
        const available = pad.getBoundingClientRect().right - el.getBoundingClientRect().left;
        if (textWidth(el) <= available + 0.5 || size <= floor) break;
        size = Math.max(floor, size - 2);
        el.style.fontSize = size + 'px';
      }
    }

    // Pass 1b: lines that belong to one block share one size. Fitting each
    // line independently would set a headline in three different sizes.
    const groups = new Map();
    for (const el of slide.querySelectorAll('[data-fit-group]')) {
      const key = el.dataset.fitGroup;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(el);
    }
    for (const members of groups.values()) {
      const smallest = Math.min(...members.map(sizeOf));
      for (const el of members) el.style.fontSize = smallest + 'px';
    }

    // Pass 2: the composed block must fit the safe area.
    const flexible = [...slide.querySelectorAll('[data-fit]')];
    for (let guard = 0; guard < 200 && area.scrollHeight > area.clientHeight; guard += 1) {
      let shrunk = false;
      for (const el of flexible) {
        const floor = minFor(el);
        const size = sizeOf(el);
        if (size <= floor) continue;
        const next = Math.max(floor, size - Math.max(1, Math.round(size * 0.02)));
        el.style.fontSize = next + 'px';
        if (el.dataset.fitGroup) {
          for (const sibling of groups.get(el.dataset.fitGroup)) sibling.style.fontSize = next + 'px';
        }
        if (el.style.marginBottom) {
          el.style.marginBottom = Math.round(next * 0.6) + 'px';
        }
        shrunk = true;
      }
      if (!shrunk) break;
    }

    for (const el of slide.querySelectorAll('[data-fit]')) {
      el.dataset.finalSize = String(Math.round(sizeOf(el)));
    }
    slide.dataset.fitted = '1';
  }
})();`;
}
