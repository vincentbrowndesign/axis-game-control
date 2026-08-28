import { brand } from './brand.mjs';
import { PRIMITIVES } from './slides.mjs';

export const PILLARS = {
  basketball_film_education: 'Basketball film education - camera position, framing, what makes a moment reviewable.',
  coaching_intelligence: 'Coaching intelligence - what to look for, why one rep is not a pattern, observation vs conclusion. Framed as coaching education unless Trophy Labs can already produce the result being discussed.',
  building_trophy_labs: 'Building Trophy Labs - what film-ready means, why evidence is preserved, why Axis is allowed to abstain.',
  film_breakdowns: 'Film breakdowns - evidence-backed moments from authorized film only. What was visible, what was supported, what stayed unresolved.',
};

/**
 * The drafting contract handed to the model that writes a topic spec.
 * The engine validates whatever comes back; this prompt exists so the draft
 * arrives already inside the boundaries rather than being rejected by the gate.
 */
export function draftingPrompt(input) {
  return `# Trophy Labs campaign drafting task

You are drafting one Instagram carousel campaign for ${brand.profile}, a basketball
film and coaching intelligence account. Return a single JSON object matching the
topic spec below. Return JSON only - no prose, no code fence.

## Input

Type: ${input.type}
${input.url ? `Source URL: ${input.url}\n` : ''}${input.text ? `Source text:\n"""\n${input.text}\n"""\n` : ''}${input.topic ? `Topic: ${input.topic}\n` : ''}
## Your job

1. Identify the central basketball question inside this input.
2. Separate what the source claims from what Trophy Labs actually concludes.
3. Write a Trophy Labs point of view in your own words.
4. Write three hooks. Choose one and record the other two as alternates.
5. Write ${brand.slideCount.min}-${brand.slideCount.max} slides of compact copy, one idea per slide, opening on HOOK and closing on CTA.
6. Write a caption, alt text for every slide, a comment keyword, the resource the post promises, and the ManyChat copy.
7. Record every claim with a status and a basis.

## Slide primitives

${PRIMITIVES.join(', ')}

Fields by primitive: HOOK/BIG_STATEMENT take \`lines\` (short uppercase-ready phrases; BIG_STATEMENT
also takes \`note\`); PROBLEM/FILM_FRAME/COURT_DIAGRAM take \`lines\` of sentence copy;
SEQUENCE takes \`steps\`; CHECKLIST takes \`items\`; COMPARISON takes \`left\`/\`right\`
each \`{label, lines}\`; EVIDENCE_MOMENT takes \`rows\` of \`{label, value}\`; QUOTE takes
\`quote\` and \`attribution\`; CTA takes \`keyword\`, \`resourceLead\`, \`resourceName\`.
Every slide takes \`primitive\`, \`name\`, \`alt\`, and an optional \`eyebrow\`.

## Content pillars

${Object.entries(PILLARS).map(([key, value]) => `- \`${key}\`: ${value}`).join('\n')}

## Hard boundaries

Never:
- copy the source script or reuse its visuals
- imitate another creator's distinctive design
- invent a statistic, a study, or a testimonial
- promise virality, follower counts, or a time-to-result
- claim a Trophy Labs capability that is still experimental: make/miss detection,
  form grades, and canonical shot counts stay at false unless the campaign carries
  an explicit \`capabilityAuthorization\` entry
- publish anything; a person approves and posts every campaign

Banned phrasing: ${brand.bannedLanguage.join(', ')}.
Banned unqualified capability phrasing: ${brand.bannedCapabilityLanguage.join(', ')}.

Every number a reader sees must appear in \`claims\` with status \`SUPPORTED\`
(and a basis that holds) or \`ILLUSTRATIVE\` (a stated example, never a measurement).
If you cannot support a figure, remove it from the copy.

## Voice

Near-black field, white condensed type, basketball-orange signal. Sparse. One idea
per slide. Plain basketball language a coach in a gym would use. No AI language, no
motivational-sports filler, no hype. ${brand.principle}

## Topic spec schema

\`\`\`json
{
  "campaignId": "YYYY-MM-DD-short-slug",
  "date": "YYYY-MM-DD",
  "profile": "${brand.profile}",
  "pillar": "one of the pillar keys above",
  "title": "plain-language campaign title",
  "sourceType": "original_topic | reel_url | transcript | question | product_milestone | film_result | research_insight | coach_problem",
  "sourceReferences": [{ "type": "reel", "url": "", "capturedAt": "", "use": "topic signal only", "note": "" }],
  "centralQuestion": "",
  "pointOfView": "",
  "hooks": { "chosen": "", "alternates": ["", ""] },
  "narrative": "",
  "slides": [],
  "caption": { "body": "", "hashtags": [] },
  "keyword": "ONE UPPERCASE WORD",
  "resource": { "slug": "", "path": "", "title": "", "subtitle": "", "intro": "", "items": [], "closing": [] },
  "manychat": {
    "publicReply": "", "openingDm": "", "openingButton": "",
    "followRequest": { "enabled": true, "optional": true, "copy": "", "skipButton": "" },
    "deliveryDm": "", "followUpDm": ""
  },
  "claims": [{ "claim": "", "status": "SUPPORTED | ILLUSTRATIVE", "basis": "", "sources": [] }],
  "productClaims": { "makeMiss": false, "formGrades": false, "canonicalShotCount": false }
}
\`\`\`

At most ${brand.hashtagMax} hashtags, all genuinely relevant. The delivery DM must contain a
\`[OPEN THE CHECKLIST]\` style link slot. The carousel must remain useful to someone who never
comments or follows - the resource adds depth, it does not withhold the basic answer.
`;
}
