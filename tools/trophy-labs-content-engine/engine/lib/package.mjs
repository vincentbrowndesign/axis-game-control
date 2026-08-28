import { brand } from './brand.mjs';
import { pad2, sha256 } from './util.mjs';

export function resourceUrl(spec) {
  return `${brand.resourceHost}/${spec.resource.path}`;
}

export function captionMarkdown(spec) {
  const hashtags = spec.caption.hashtags.join(' ');
  const length = spec.caption.body.length + hashtags.length + 2;
  return `# Caption - ${spec.title}

Paste everything between the rules into the Instagram caption field.

---

${spec.caption.body}

${hashtags}

---

Characters: ${length} / ${brand.captionMaxChars}
Hashtags: ${spec.caption.hashtags.length} / ${brand.hashtagMax}
Comment keyword: ${spec.keyword}
`;
}

export function altTextMarkdown(spec) {
  const rows = spec.slides
    .map((slide, position) => `## Slide ${pad2(position + 1)} - ${slide.primitive}\n\n${slide.alt}\n`)
    .join('\n');
  return `# Alt text - ${spec.title}

Instagram takes alt text per image. Set it while adding each slide to the carousel,
in this order. Write nothing new in the app - paste these.

${rows}`;
}

export function manychatMarkdown(spec) {
  const chat = spec.manychat;
  const follow = chat.followRequest?.enabled
    ? `## 4. Follow request (optional step)

> ${chat.followRequest.copy}

Buttons: \`${chat.openingButton}\` after following, and \`${chat.followRequest.skipButton}\` to continue without following.

ManyChat's comment-to-DM automation can check whether a commenter follows the account and ask
them to follow before it sends the link. That check depends on the Opening DM being enabled -
without the Opening DM, the follow request and some follow-ups are unavailable.
Reference: https://help.manychat.com/hc/en-us/articles/16654065283100-Quick-Automation-Auto-DM-links-from-comments

Trophy Labs policy: the follow request stays skippable. The resource is a fair exchange,
not a follower trap.
`
    : '## 4. Follow request\n\nDisabled for this campaign.\n';

  return `# ManyChat - ${spec.title}

Build this by hand in ManyChat. The engine does not touch live automations.

## 1. Trigger

Comment keyword on this post: \`${spec.keyword}\`

## 2. Public comment reply

> ${chat.publicReply}

## 3. Opening DM

> ${chat.openingDm}

Button: \`${chat.openingButton}\`

${follow}
## 5. Delivery DM

> ${chat.deliveryDm.replace(/\n/g, '\n> ')}

Link target: ${resourceUrl(spec)}

## 6. Follow-up DM (send 24h later if unopened)

> ${chat.followUpDm.replace(/\n/g, '\n> ')}

## Build checklist

- [ ] Keyword \`${spec.keyword}\` attached to the published post only
- [ ] Opening DM enabled (required before the follow step exists)
- [ ] Follow request left skippable
- [ ] Resource link live at ${resourceUrl(spec)}
- [ ] Follow-up scheduled
- [ ] Campaign performance fields recorded after 7 days
`;
}

export function sourcesMarkdown(spec) {
  const references = spec.sourceReferences?.length
    ? spec.sourceReferences
        .map((reference) => `- **${reference.type}** ${reference.url || ''}\n  - captured: ${reference.capturedAt || 'n/a'}\n  - use: ${reference.use || 'topic signal only'}\n  - note: ${reference.note || ''}`)
        .join('\n')
    : '- None. This campaign is an original Trophy Labs topic.';

  const claims = spec.claims
    .map((claim) => `| ${claim.claim} | ${claim.status} | ${claim.basis} |`)
    .join('\n');

  return `# Sources and claims - ${spec.title}

Source type: \`${spec.sourceType}\`

## Source references

${references}

## Originality

- No source script was copied.
- No source visuals were reused.
- No other creator's distinctive design was imitated.
${spec.sourceReferences?.length ? '- Source material was used as a topic signal. The published copy is original Trophy Labs writing.' : ''}

## Central question

${spec.centralQuestion}

## Trophy Labs point of view

${spec.pointOfView}

## Claim ledger

| Claim | Status | Basis |
|---|---|---|
${claims}

Statuses: \`SUPPORTED\` (the claim holds and the basis says why), \`ILLUSTRATIVE\`
(a stated example, never presented as a measurement), \`UNSUPPORTED\` (blocked -
the quality gate refuses to package it).

## Product claim boundary

| Capability | Asserted in this campaign |
|---|---|
${Object.entries(spec.productClaims).map(([key, value]) => `| ${key} | ${value ? 'YES' : 'no'} |`).join('\n')}

Marketing does not run ahead of Axis. A capability moves to \`YES\` only when Axis can
already produce that result and the campaign records an explicit authorization.
`;
}

export function receiptMarkdown(spec, receipt, qa) {
  const findings = qa.findings
    .map((finding) => `| ${finding.level} | ${finding.check} | ${finding.detail} |`)
    .join('\n');
  return `# Campaign receipt - ${spec.campaignId}

Generated: ${receipt.generatedAt}
Engine: ${receipt.engine.name} ${receipt.engine.version}
Renderer: ${receipt.render.renderer}
Brand faces embedded: ${receipt.render.fontsEmbedded.length ? receipt.render.fontsEmbedded.join(', ') : 'none (system fallback stack)'}

## Gate result

**${qa.status}** - ${qa.counts.pass} passed, ${qa.counts.warn} warnings, ${qa.counts.fail} failures.

| Level | Check | Detail |
|---|---|---|
${findings}

## Package contents

${receipt.artifacts.map((artifact) => `- \`${artifact.path}\` (${artifact.bytes} bytes, sha256 ${artifact.sha256.slice(0, 16)})`).join('\n')}

## Authority

- Human approval: **${receipt.humanApproval}**
- Publication authorization: **${receipt.publicationAuthorization ? 'granted' : 'withheld'}**
- Instagram publishing: manual
- ManyChat automation: built by hand, never changed by the engine

Nothing in this folder is published until a person posts it.
`;
}

export function campaignJson(spec, receipt, qa) {
  return {
    campaignId: spec.campaignId,
    profile: spec.profile,
    title: spec.title,
    date: spec.date,
    pillar: spec.pillar,
    sourceType: spec.sourceType,
    sourceReferences: spec.sourceReferences ?? [],
    centralQuestion: spec.centralQuestion,
    pointOfView: spec.pointOfView,
    hooks: spec.hooks,
    narrative: spec.narrative,
    slideCount: spec.slides.length,
    slides: spec.slides.map((slide, position) => ({
      index: position + 1,
      name: slide.name,
      primitive: slide.primitive,
      file: `slides/${pad2(position + 1)}-${slide.name}.png`,
      alt: slide.alt,
    })),
    keyword: spec.keyword,
    resource: {
      slug: spec.resource.slug,
      title: spec.resource.title,
      url: resourceUrl(spec),
      files: ['resource.html', 'resource.pdf'],
    },
    claims: spec.claims.map(({ claim, status, basis, sources }) => ({ claim, status, basis, sources: sources ?? [] })),
    productClaims: spec.productClaims,
    humanApproval: receipt.humanApproval,
    publicationAuthorization: receipt.publicationAuthorization,
    qa: { status: qa.status, ...qa.counts },
    engine: receipt.engine,
    render: receipt.render,
    generatedAt: receipt.generatedAt,
    specHash: sha256(JSON.stringify(spec)),
    performance: null,
  };
}
