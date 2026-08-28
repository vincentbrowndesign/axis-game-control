# Trophy Labs Content Engine

Status: ACTIVE - internal operations tooling

Development and operations guidance only. Do not import this file into the app,
expose it through a route, copy it into UI, or place it in `public`.

## What this is

An internal instrument that turns one basketball topic into a complete, original
Instagram campaign for `@trophy.labs`, gated on human approval.

It lives at `tools/trophy-labs-content-engine/`. It is a command line tool with no
npm dependencies. It is not part of the Axis product surface.

## Where it sits

Trophy Labs is the brand and the coach-facing product. Axis is the intelligence
underneath. This engine is neither - it is the marketing and operations layer
alongside them.

```text
Axis            the vision and memory system
Trophy Labs     the coach-facing Film product
Content engine  how Trophy Labs talks about the work
```

It must not appear inside the coach-facing Film experience, and it must not add a
screen, route, dashboard, or provider UI to `/axis`. The architecture rule in
`AGENTS.md` still holds: capabilities plug into the loop, they do not get screens.

## The loop

```text
Input
-> Topic spec (drafted by a model, validated by the engine)
-> Claim ledger + product-claim boundary
-> Rendered carousel + resource + ManyChat copy
-> Quality gate
-> Human approval
-> Manual publication
-> Measured performance
-> Better content next time
```

Inputs the engine accepts: an Instagram Reel URL, a pasted transcript, a
basketball question, a Trophy Labs product milestone, an authorized Film result, a
basketball research insight, or a coach's recurring problem.

## What is automated and what is not

Automated: extracting the topic, holding the point of view, separating source
claims from Trophy Labs conclusions, generating hooks, composing slide copy into a
controlled template, rendering 1080x1350 slides, checking overflow, contrast and
text size, generating the caption, alt text, the promised resource, and the
ManyChat copy, recording claim evidence and source lineage, and exporting a
ready-to-post folder with a machine-checkable receipt.

Never automated: publishing to Instagram, changing ManyChat automations, deciding
that a claim is true, and approving a campaign.

## Product claim boundary

Marketing does not run ahead of Axis. Every campaign manifest records:

```json
"productClaims": {
  "makeMiss": false,
  "formGrades": false,
  "canonicalShotCount": false
}
```

A capability moves to `true` only when Axis can already produce that result and
the campaign carries an explicit `capabilityAuthorization` entry. The quality gate
fails any package that asserts one without it, and it scans the copy for
unqualified capability language regardless of what the flags say.

## Content pillars

1. **Basketball film education** - camera position, framing, what makes a moment
   reviewable, why a stable camera improves the breakdown.
2. **Coaching intelligence** - what to look for around release, why one rep is not
   a pattern, observation versus conclusion, when to hold back rather than guess.
   Framed as coaching education unless Trophy Labs can already produce the result.
3. **Building Trophy Labs** - what "Film ready" means, why evidence is preserved,
   why Axis is allowed to abstain, how one uploaded Film becomes structured
   evidence.
4. **Film breakdowns** - authorized Film only. What was visible, what Trophy Labs
   could support, what stayed unresolved, how better capture would change it.

No athlete Film appears in public content without recorded permission. The gate
enforces this for `sourceType: film_result`.

## Visual system

Near-black field, white condensed typography, basketball-orange signal. Sparse
composition, one idea per slide, large numerical and diagrammatic moments, court
lines and frame strips where they mean something.

No gradients added to signal "AI", no robot imagery, no clutter, no generic
motivational-sports aesthetic. Colors come from `brand/brand.json` only - the gate
fails any text layer using a color outside the token set.

Slide primitives: `HOOK`, `BIG_STATEMENT`, `PROBLEM`, `SEQUENCE`, `COMPARISON`,
`CHECKLIST`, `FILM_FRAME`, `COURT_DIAGRAM`, `EVIDENCE_MOMENT`, `QUOTE`, `CTA`.
Enough variety without becoming a generic design platform.

## Learning loop

After publication, record reach, carousel completion rate, saves, shares, profile
visits, follows, keyword comments, opening DMs sent, DM opt-ins, follow-request
conversion, resource clicks, unfollows, website visits, and Film uploads
attributed to the campaign.

Campaign value is ranked deliberately:

```text
QUALIFIED FILM UPLOADS
        v
RESOURCE CLICKS
        v
KEYWORD CONVERSATIONS
        v
SAVES + SHARES
        v
PROFILE FOLLOWS
        v
RAW REACH
```

Raw reach carries the smallest weight in the score. The point is a basketball
audience that may actually use Trophy Labs, not an impressions number.

## V1 scope

Bounded on purpose:

- one carousel template
- 8 rendered slides, caption, alt text, one resource, ManyChat copy, receipt
- human approves and posts

No Instagram publishing, no OAuth, no Meta permissions, no scheduling. Manual
posting is the review gate, and it keeps the question honest: does the content
work?

Later, once several campaigns exist: multiple templates, performance comparison,
hook testing, publishing through the official integration, ManyChat provisioning,
a topic backlog, reusable lead magnets, and campaign-to-Film-upload attribution.

## Publishing the resource

The engine writes `resource.html` and `resource.pdf` into the campaign folder. It
does not host them. Publishing the resource at a durable URL such as
`https://trophy-labs.com/guides/courtside-film` is a manual step; the host is
configured in `brand/brand.json` and appears in `campaign.json` and the ManyChat
copy so the DM link and the published page cannot drift apart.

## First campaign

`tools/trophy-labs-content-engine/topics/2026-08-28-courtside-film.json` -
"Why your basketball film isn't telling you anything". It says nothing about AI,
Codex, or this engine. The customer cares about basketball film.

It advertises no make/miss detection, no form grades, and no automatic shot
counts, because Axis cannot yet produce them.
