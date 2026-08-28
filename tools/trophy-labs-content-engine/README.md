# Trophy Labs Content Engine

Internal marketing and operations tooling. One basketball topic in, one
approval-gated Instagram carousel campaign package out.

This is **not** part of the Axis app. It adds no route, no screen, and no import
into `src/`. It runs offline from the command line and it never publishes
anything by itself.

```text
BASKETBALL TOPIC / REEL URL / TRANSCRIPT
                  |
        TROPHY LABS POINT OF VIEW
                  |
       FACT + CLAIM VERIFICATION
                  |
       ORIGINAL CAROUSEL PACKAGE
                  |
SLIDES + CAPTION + KEYWORD + DM RESOURCE
                  |
             HUMAN APPROVAL
                  |
       INSTAGRAM + MANYCHAT
                  |
        CAMPAIGN PERFORMANCE
                  |
       BETTER CONTENT NEXT TIME
```

## Requirements

Node 20+. No npm dependencies. Chromium is used for rendering and is found
automatically at `/opt/pw-browsers/chromium`, `/usr/bin/chromium`, or Chrome's
standard macOS location. Override with `TROPHY_LABS_CHROMIUM=/path/to/chrome`.

Without Chromium the engine still composes and gates a campaign; it skips PNG
rendering, the PDF, and the measured layout checks, and says so on the receipt.

## Commands

```bash
node engine/cli.mjs generate 2026-08-28-courtside-film   # build the package
node engine/cli.mjs qa 2026-08-28-courtside-film         # gate only, no render
node engine/cli.mjs draft --url <reel-url>               # write the drafting prompt
node engine/cli.mjs record <id> --from performance.json  # record measured results
node engine/cli.mjs compare                              # rank campaigns by value
node engine/cli.mjs list                                 # topics and packages
node engine/cli.mjs selftest                             # prove the gate still bites
```

`generate` exits non-zero when the quality gate fails, so it can run in CI.

## How a campaign gets made

1. `draft` writes the prompt that hands a model the topic, the boundaries, and the
   topic spec schema. Paste it into the drafting model.
2. Save the JSON the model returns into `topics/<campaignId>.json`.
3. `generate` composes the slides, renders them, builds the resource, runs the gate,
   and writes the package.
4. A person reads `receipt.md`, approves, and posts manually.
5. After a week, `record` stores measured results and scores them.

The engine automates the labor. It does not automate the judgment.

## Output

```text
campaigns/2026-08-28-courtside-film/
├── campaign.json        manifest: slides, claims, product-claim boundary, hashes
├── sources.md           source lineage, originality attestation, claim ledger
├── caption.md           paste-ready caption
├── alt-text.md          per-slide alt text, in carousel order
├── manychat.md          keyword, DMs, and the build checklist
├── resource.html        the promised download, mobile-friendly
├── resource.pdf         the same page, printed
├── performance.json     blank until measured
├── qa.json              every check and its result
├── receipt.md           gate result, artifact hashes, authority
└── slides/              01..08 PNG at 1080x1350
```

## What the gate refuses

Marketing promises (viral, guaranteed, follower counts, time-to-result),
unqualified capability language, any figure a reader sees that is not declared as
a claim, product claims asserted without authorization, six-word runs copied from
a source transcript, film breakdowns without recorded permission, copy that
overflows the safe area or drops below the minimum text size, contrast below WCAG,
off-token colors, missing alt text, and any package that claims publication
authorization.

Run `selftest` to see it catch a deliberately bad campaign.

## Boundaries

The engine never copies a source script, reuses source visuals, imitates another
creator's design, invents a statistic or a testimonial, changes a ManyChat
automation, or publishes to Instagram. `productClaims` for make/miss detection,
form grades, and canonical shot counts stay `false` until Axis can actually
produce that result.

`MAKER UNDERNEATH. BASKETBALL ON TOP.`
