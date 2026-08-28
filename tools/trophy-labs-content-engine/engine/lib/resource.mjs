import { brand, fontFaces } from './brand.mjs';
import { esc } from './util.mjs';

const { color, type } = brand;

/**
 * The promised download, as one mobile-friendly page that also prints cleanly.
 * The carousel has to stand on its own, so this resource adds depth rather
 * than withholding the basic answer.
 */
export function resourceHtml(spec) {
  const { resource } = spec;
  const { css } = fontFaces();
  const items = resource.items
    .map((item) => `<li><span class="tick"></span><span>${esc(item)}</span></li>`)
    .join('');
  const closing = resource.closing.map((line) => `<div class="loop-step">${esc(line)}</div>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(resource.title)} - ${esc(brand.name)}</title>
<style>${css}
@page{size:letter;margin:14mm}
*{margin:0;padding:0;box-sizing:border-box}
body{background:${color.field};color:${color.ink};font-family:${type.bodyStack};
  line-height:1.5;padding:40px 24px 72px;-webkit-font-smoothing:antialiased}
.wrap{max-width:680px;margin:0 auto}
.eyebrow{font-family:${type.metaStack};font-size:13px;letter-spacing:0.22em;text-transform:uppercase;color:${color.signal}}
h1{font-family:${type.displayStack};font-weight:700;text-transform:uppercase;letter-spacing:-0.02em;
  line-height:0.95;font-size:clamp(40px,9vw,64px);margin:16px 0 12px;font-stretch:condensed}
.sub{font-size:19px;color:${color.inkSoft};margin-bottom:28px}
.intro{font-size:17px;color:${color.inkSoft};border-left:4px solid ${color.signal};padding-left:18px;margin-bottom:40px}
ul{list-style:none;display:flex;flex-direction:column;gap:18px}
li{display:flex;gap:16px;align-items:flex-start;font-size:18px;break-inside:avoid}
.tick{width:16px;height:16px;flex:none;margin-top:6px;border:3px solid ${color.signal}}
.loop{margin-top:48px;border-top:2px solid ${color.line};padding-top:32px;
  display:flex;flex-direction:column;gap:10px}
.loop-step{font-family:${type.displayStack};font-weight:700;text-transform:uppercase;
  letter-spacing:0.01em;font-size:clamp(24px,5.5vw,34px);font-stretch:condensed}
.loop-step:last-child{color:${color.signal}}
footer{margin-top:48px;font-family:${type.metaStack};font-size:12px;letter-spacing:0.16em;
  text-transform:uppercase;color:${color.inkMeta};display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
@media print{body{background:#fff;color:#111}.sub,.intro{color:#444}
  footer{color:#666}.loop{border-color:#ddd}}
</style></head><body><div class="wrap">
<div class="eyebrow">${esc(brand.name)} &middot; Film capture</div>
<h1>${esc(resource.title)}</h1>
<p class="sub">${esc(resource.subtitle)}</p>
<p class="intro">${esc(resource.intro)}</p>
<ul>${items}</ul>
<div class="loop">${closing}</div>
<footer><span>${esc(brand.profile)}</span><span>${esc(brand.principle)}</span></footer>
</div></body></html>`;
}
