import { brand } from './brand.mjs';
import { PRIMITIVES } from './slides.mjs';
import { contrastRatio } from './util.mjs';

const TOKEN_COLORS = new Set(Object.values(brand.color).map((value) => value.toUpperCase()));

/** Every string a reader could actually see, flattened for language scanning. */
export function readableCopy(spec) {
  const parts = [];
  for (const slide of spec.slides) {
    parts.push(
      ...(slide.lines || []), ...(slide.steps || []), ...(slide.items || []),
      slide.eyebrow, slide.note, slide.quote, slide.attribution, slide.resourceName,
      ...(slide.resourceNameLines || []), slide.resourceLead, slide.alt,
      ...(slide.rows || []).flatMap((row) => [row.label, row.value]),
      ...(slide.left?.lines || []), ...(slide.right?.lines || []),
    );
  }
  parts.push(spec.caption.body, ...(spec.caption.hashtags || []));
  parts.push(spec.resource.title, spec.resource.subtitle, spec.resource.intro,
    ...(spec.resource.items || []), ...(spec.resource.closing || []));
  const manychat = spec.manychat;
  parts.push(manychat.publicReply, manychat.openingDm, manychat.openingButton,
    manychat.deliveryDm, manychat.followUpDm, manychat.followRequest?.copy);
  return parts.filter((part) => typeof part === 'string' && part.length > 0);
}

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function shingles(text, size = 6) {
  const words = normalize(text).split(' ').filter(Boolean);
  const out = new Set();
  for (let index = 0; index + size <= words.length; index += 1) {
    out.add(words.slice(index, index + size).join(' '));
  }
  return out;
}

export function runQa(spec, { textLayers = [], measurements = [], resource = null, source = null } = {}) {
  const findings = [];
  const add = (level, check, detail) => findings.push({ level, check, detail });
  const pass = (check, detail) => add('PASS', check, detail);
  const fail = (check, detail) => add('FAIL', check, detail);
  const warn = (check, detail) => add('WARN', check, detail);
  const copy = readableCopy(spec);
  const haystack = copy.join('\n').toLowerCase();

  // 1. Structure.
  const { min, max } = brand.slideCount;
  const count = spec.slides.length;
  if (count < min || count > max) fail('structure.slide_count', `${count} slides, allowed ${min}-${max}`);
  else pass('structure.slide_count', `${count} slides`);
  if (spec.slides[0]?.primitive !== 'HOOK') fail('structure.opens_on_hook', 'first slide is not a HOOK');
  else pass('structure.opens_on_hook', 'slide 1 is a HOOK');
  if (spec.slides.at(-1)?.primitive !== 'CTA') fail('structure.closes_on_cta', 'last slide is not a CTA');
  else pass('structure.closes_on_cta', `slide ${count} is a CTA`);
  const unknown = spec.slides.filter((slide) => !PRIMITIVES.includes(slide.primitive));
  if (unknown.length) fail('structure.known_primitives', unknown.map((s) => s.primitive).join(', '));
  else pass('structure.known_primitives', 'all slides use approved primitives');
  const hooks = spec.hooks?.alternates?.length ?? 0;
  if (hooks < 2) warn('structure.hook_alternates', `${hooks} alternate hooks recorded, expected at least 2`);
  else pass('structure.hook_alternates', `${hooks} alternate hooks recorded`);

  // 2. Accessibility copy.
  const missingAlt = spec.slides.filter((slide) => !slide.alt?.trim());
  if (missingAlt.length) fail('a11y.alt_text_present', `${missingAlt.length} slide(s) missing alt text`);
  else pass('a11y.alt_text_present', `${count} alt descriptions`);
  const longAlt = spec.slides.filter((slide) => (slide.alt || '').length > brand.altTextMaxChars);
  if (longAlt.length) fail('a11y.alt_text_length', `${longAlt.length} alt description(s) over ${brand.altTextMaxChars} chars`);
  else pass('a11y.alt_text_length', `longest alt ${Math.max(...spec.slides.map((s) => (s.alt || '').length))} chars`);

  // 3. Marketing language boundary.
  const banned = brand.bannedLanguage.filter((phrase) => haystack.includes(phrase.toLowerCase()));
  if (banned.length) fail('language.banned_marketing', banned.join(', '));
  else pass('language.banned_marketing', 'no promise language found');

  // 4. Product capability boundary. Marketing must not run ahead of Axis.
  const overreach = brand.bannedCapabilityLanguage.filter((phrase) => haystack.includes(phrase.toLowerCase()));
  if (overreach.length) fail('claims.capability_boundary', `unqualified capability language: ${overreach.join(', ')}`);
  else pass('claims.capability_boundary', 'no unqualified capability language');
  const enabledClaims = Object.entries(spec.productClaims || {})
    .filter(([, value]) => value === true)
    .map(([key]) => key);
  const authorized = spec.capabilityAuthorization || [];
  const unauthorized = enabledClaims.filter((key) => !authorized.includes(key));
  if (unauthorized.length) fail('claims.product_claims', `asserted without authorization: ${unauthorized.join(', ')}`);
  else pass('claims.product_claims', enabledClaims.length ? `authorized: ${enabledClaims.join(', ')}` : 'all product claims held at false');

  // 5. Figures. Every number a reader sees must be declared as a claim.
  const declared = (spec.claims || []).filter((claim) => ['SUPPORTED', 'ILLUSTRATIVE'].includes(claim.status));
  const declaredText = declared.map((claim) => claim.claim).join(' ');
  const figures = new Set();
  for (const line of copy) {
    for (const match of line.matchAll(/\b\d[\d.,]*\s?(?:%|percent|x)?/g)) {
      const value = match[0].trim();
      if (/^(?:v?\d\b|slide \d)/i.test(value)) continue;
      figures.add(value);
    }
  }
  const undeclared = [...figures].filter((figure) => {
    if (/^\d+$/.test(figure) && Number(figure) <= 10) return false; // slide/step ordinals
    return !declaredText.includes(figure);
  });
  if (undeclared.length) fail('claims.undeclared_figures', `figures with no claim entry: ${undeclared.join(', ')}`);
  else pass('claims.undeclared_figures', `${figures.size} figure(s), all declared`);
  const unsupported = (spec.claims || []).filter((claim) => claim.status === 'UNSUPPORTED');
  if (unsupported.length) fail('claims.unsupported_present', `${unsupported.length} claim(s) marked UNSUPPORTED still in the package`);
  else pass('claims.unsupported_present', 'no unsupported claims in the package');
  const missingBasis = declared.filter((claim) => !claim.basis?.trim());
  if (missingBasis.length) fail('claims.basis_recorded', `${missingBasis.length} claim(s) with no basis`);
  else pass('claims.basis_recorded', `${declared.length} claim(s) carry a basis`);

  // 6. Source lineage and originality.
  const needsSource = ['reel_url', 'transcript', 'film_result'].includes(spec.sourceType);
  if (needsSource && !(spec.sourceReferences || []).length) {
    fail('source.lineage', `sourceType ${spec.sourceType} requires at least one sourceReference`);
  } else pass('source.lineage', `${(spec.sourceReferences || []).length} source reference(s) for ${spec.sourceType}`);
  if (source?.text) {
    const sourceShingles = shingles(source.text);
    const outputShingles = shingles(copy.join(' '));
    const overlap = [...outputShingles].filter((phrase) => sourceShingles.has(phrase));
    if (overlap.length) fail('source.no_verbatim_reuse', `${overlap.length} six-word run(s) copied from source, e.g. "${overlap[0]}"`);
    else pass('source.no_verbatim_reuse', 'no six-word run shared with the source');
  }
  if (spec.sourceType === 'film_result' && !spec.filmPermission) {
    fail('source.film_permission', 'film breakdown without recorded athlete permission');
  }

  // 7. Caption.
  const captionLength = spec.caption.body.length + spec.caption.hashtags.join(' ').length + 2;
  if (captionLength > brand.captionMaxChars) fail('caption.length', `${captionLength} chars, limit ${brand.captionMaxChars}`);
  else pass('caption.length', `${captionLength} chars`);
  if (spec.caption.hashtags.length > brand.hashtagMax) fail('caption.hashtag_count', `${spec.caption.hashtags.length}, limit ${brand.hashtagMax}`);
  else pass('caption.hashtag_count', `${spec.caption.hashtags.length} hashtags`);

  // 8. Keyword reachability. The comment keyword has to appear where people read it.
  const keyword = spec.keyword.toUpperCase();
  const ctaSlide = spec.slides.find((slide) => slide.primitive === 'CTA');
  if (ctaSlide?.keyword?.toUpperCase() !== keyword) fail('keyword.on_cta_slide', `CTA slide keyword does not match "${keyword}"`);
  else pass('keyword.on_cta_slide', `CTA slide asks for ${keyword}`);
  if (!spec.caption.body.toUpperCase().includes(keyword)) fail('keyword.in_caption', `caption never says ${keyword}`);
  else pass('keyword.in_caption', `caption asks for ${keyword}`);

  // 9. Resource promise.
  if (!spec.resource?.items?.length) fail('resource.exists', 'no resource content generated for the promised download');
  else pass('resource.exists', `${spec.resource.items.length}-item resource: ${spec.resource.title}`);
  if (!spec.manychat.deliveryDm?.includes('[OPEN THE CHECKLIST]') && !spec.manychat.deliveryDm?.includes('[OPEN')) {
    warn('resource.delivery_link_slot', 'delivery DM has no link slot placeholder');
  } else pass('resource.delivery_link_slot', 'delivery DM carries the link slot');
  if (spec.manychat.followRequest?.enabled && !spec.manychat.openingDm) {
    fail('manychat.follow_request_requires_opening_dm', 'ManyChat requires an Opening DM before a follow request');
  } else pass('manychat.follow_request_requires_opening_dm', 'opening DM present for the follow step');
  if (spec.manychat.followRequest?.enabled && !spec.manychat.followRequest.optional) {
    warn('manychat.follow_request_optional', 'follow request is mandatory; Trophy Labs policy prefers optional');
  }

  // 10. Legibility: contrast and minimum size, checked against brand tokens.
  const offToken = textLayers.filter((l) => !TOKEN_COLORS.has(l.fg.toUpperCase()) || !TOKEN_COLORS.has(l.bg.toUpperCase()));
  if (offToken.length) fail('visual.token_colors', `${offToken.length} text layer(s) use non-token colors`);
  else if (textLayers.length) pass('visual.token_colors', `${textLayers.length} text layers use brand tokens only`);
  const minimums = { display: brand.type.minDisplayPx, body: brand.type.minBodyPx, meta: brand.type.minMetaPx };
  const tooSmall = textLayers.filter((l) => l.sizePx < minimums[l.kind]);
  if (tooSmall.length) fail('visual.min_text_size', tooSmall.map((l) => `${l.kind} @ ${l.sizePx}px`).join(', '));
  else if (textLayers.length) pass('visual.min_text_size', `smallest ${Math.min(...textLayers.map((l) => l.sizePx))}px`);
  const lowContrast = textLayers
    .map((l) => ({ ...l, ratio: contrastRatio(l.fg, l.bg) }))
    .filter((l) => l.ratio < (l.sizePx >= 48 ? 3 : 4.5));
  if (lowContrast.length) fail('visual.contrast', lowContrast.map((l) => `"${l.text.slice(0, 24)}" ${l.ratio}:1`).join('; '));
  else if (textLayers.length) pass('visual.contrast', `lowest ratio ${Math.min(...textLayers.map((l) => contrastRatio(l.fg, l.bg)))}:1`);

  // 11. Layout: measured in the browser, not guessed.
  const overflowing = measurements.filter((m) => m.overflowY > 1 || m.escapes > 0);
  if (overflowing.length) {
    fail('visual.overflow', overflowing.map((m) => `slide ${m.slide} (${m.primitive}) over by ${m.overflowY}px, ${m.escapes} element(s) outside the safe area`).join('; '));
  } else if (measurements.length) {
    pass('visual.overflow', `${measurements.length} slides fit the safe area`);
  }
  // Sizes after the browser fit pass, which is what actually ships.
  const shrunk = measurements.filter((m) => typeof m.minFontPx === 'number' && m.minFontPx < brand.type.minBodyPx);
  if (shrunk.length) {
    fail('visual.measured_text_size', shrunk.map((m) => `slide ${m.slide} shrank to ${m.minFontPx}px`).join('; '));
  } else if (measurements.length) {
    pass('visual.measured_text_size', `smallest fitted copy ${Math.min(...measurements.map((m) => m.minFontPx ?? Infinity))}px`);
  }

  // 12. Resource page legibility on a phone.
  if (resource) {
    if (resource.hOverflow > 1) fail('resource.mobile_fit', `resource page overflows by ${resource.hOverflow}px at ${resource.layoutWidth}px wide`);
    else pass('resource.mobile_fit', `resource page fits ${resource.layoutWidth}px with no horizontal scroll`);
    if (resource.minFontPx !== null && resource.minFontPx < 12) fail('resource.mobile_text_size', `smallest resource text ${resource.minFontPx}px`);
    else if (resource.minFontPx !== null) pass('resource.mobile_text_size', `smallest resource text ${resource.minFontPx}px`);
  }

  // 13. Authority. V1 never publishes itself.
  if (spec.humanApproval && spec.humanApproval !== 'REQUIRED') fail('authority.human_approval', 'human approval is not marked REQUIRED');
  else pass('authority.human_approval', 'human approval REQUIRED');
  if (spec.publicationAuthorization === true) fail('authority.publication', 'package claims publication authorization; V1 posts manually');
  else pass('authority.publication', 'publication authorization withheld');

  const failed = findings.filter((finding) => finding.level === 'FAIL');
  const warned = findings.filter((finding) => finding.level === 'WARN');
  return {
    status: failed.length ? 'FAILED' : warned.length ? 'PASSED_WITH_WARNINGS' : 'PASSED',
    counts: { pass: findings.length - failed.length - warned.length, warn: warned.length, fail: failed.length },
    findings,
  };
}
