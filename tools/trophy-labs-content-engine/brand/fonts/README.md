# Brand font drop-in

The renderer runs offline. It does not download webfonts.

To use the real Trophy Labs faces, drop `.woff2` files here using these exact names:

- `trophy-display.woff2` -> registered as `Trophy Display` (condensed, uppercase headlines)
- `trophy-body.woff2` -> registered as `Trophy Body` (caption and body copy)
- `trophy-mono.woff2` -> registered as `Trophy Mono` (slide index, source marks, metadata)

The renderer base64-embeds any file it finds and falls back to the system stack for any file that is absent. Rendering never fails because a font is missing; `campaign.json` records which faces were embedded so a slide set rendered without the brand faces is identifiable later.

Font binaries are not committed. Add them locally or in the machine that renders approved campaigns.
